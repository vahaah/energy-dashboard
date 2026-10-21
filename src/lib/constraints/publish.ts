import { FatalError } from "workflow";
import { blobReadbackError, fitsInline, putImmutable, readUntilPresent } from "@/lib/blob-readback";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueReleaseId,
  ingestionRunSchema,
  sourceReleaseSchema,
  type IngestionRun,
  type SourceRelease,
} from "@/lib/catalogue/schema";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { CONSTRAINTS_MAX_RETRIES, type ConstraintsStepStatus } from "@/lib/constraints/budget";
import {
  CONSTRAINTS_CATALOGUE_RELEASES_PATH,
  CONSTRAINTS_CATALOGUE_RUNS_PATH,
  CONSTRAINTS_LATEST_PATH,
  CONSTRAINTS_PREVIOUS_PATH,
  CONSTRAINTS_QUARANTINE_DAYS,
  constraintsBundlePointerPath,
  constraintsBundlePreviousPath,
  constraintsImmutablePut,
  constraintsMetaPath,
  constraintsMutablePut,
  constraintsQuarantinePath,
  constraintsRawPath,
  constraintsReleasePath,
  constraintsStore,
  type ConstraintsPointer,
} from "@/lib/constraints/blob";
import { buildRelease } from "@/lib/constraints/build";
import { readConstraintsPointer } from "@/lib/constraints/load";
import {
  ConstraintsHttpError,
  constraintsStepError,
  ckanInstant,
  isRetryableConstraintsStatus,
  packageUrl,
  paceNeso,
  resourceNameFor,
  selectNesoResource,
  type NesoResource,
} from "@/lib/constraints/neso";
import { nesoFinancialYear, sha256Text } from "@/lib/constraints/parse";
import { revalidateConstraintPaths } from "@/lib/constraints/revalidate";
import {
  constraintReleaseId,
  type ConstraintRelease,
  type ConstraintsBundle,
  type FetchMeta,
} from "@/lib/constraints/release";

const FETCH_TIMEOUT_MS = 90_000;

export type PreparedConstraints = {
  release: ConstraintRelease;
  releaseId: string;
  hash: string;
  bytes: number;
  rows: number;
};

export type ConstraintsFetchResult = ConstraintsStepStatus & {
  /** CSV and fetch meta when they fit in the step result. */
  raw?: string;
  meta?: FetchMeta;
};

export async function fetchConstraintsBundle(
  bundle: ConstraintsBundle,
  now: Date,
  attempt: number,
  gapMs?: number,
): Promise<ConstraintsFetchResult> {
  try {
    await paceNeso(gapMs);
    const listed = await fetchNesoJson(packageUrl(bundle));
    const resources = readResources(listed);
    const selected = selectNesoResource(resources, resourceNameFor(bundle, now));
    if (!selected) {
      throw new FatalError("NESO constraint resource is missing");
    }
    const issued = ckanInstant(selected.last_modified ?? "");
    if (!issued || !selected.url.startsWith("https://api.neso.energy/")) {
      throw new FatalError("NESO constraint resource is missing a publication time");
    }
    await paceNeso(gapMs);
    const csv = await fetchNesoText(selected.url);
    const hash = sha256Text(csv);
    const hex = hash.slice("sha256:".length);
    const meta: FetchMeta = {
      bundle,
      source_url: selected.url,
      issued_at: issued,
      financial_year: bundle === "breakdown" ? nesoFinancialYear(now) : null,
      resource_name: selected.name,
    };
    const bytes = Buffer.byteLength(csv);
    await putIfAbsent(constraintsRawPath(hex), csv, "text/csv");
    await putIfAbsent(constraintsMetaPath(hex), `${JSON.stringify(meta)}\n`, "application/json");
    const result: ConstraintsFetchResult = {
      ok: true,
      rows: 0,
      bytes,
      hash,
      releaseId: "",
    };
    if (fitsInline(bytes)) {
      result.raw = csv;
      result.meta = meta;
    } else {
      console.warn("[constraints] raw body left in blob", { bundle, bytes });
    }
    return result;
  } catch (error) {
    throw constraintsStepError(error, attempt, CONSTRAINTS_MAX_RETRIES);
  }
}

export async function validateConstraintsBundle(
  hash: string,
  bundle: ConstraintsBundle,
  now: Date,
  raw?: string,
  meta?: FetchMeta,
): Promise<ConstraintsStepStatus> {
  const prepared = await prepareRelease(hash, bundle, now, raw, meta);
  return {
    ok: true,
    rows: prepared.rows,
    bytes: prepared.bytes,
    hash,
    releaseId: prepared.releaseId,
  };
}

export async function publishConstraintsBundle(
  hash: string,
  bundle: ConstraintsBundle,
  now: Date,
  raw?: string,
  meta?: FetchMeta,
): Promise<ConstraintsStepStatus> {
  const prepared = await prepareRelease(hash, bundle, now, raw, meta);
  const { release, releaseId, bytes, rows } = prepared;
  const path = constraintsReleasePath(releaseId);
  const existing = await constraintsStore().get(path, false);
  if (!existing) {
    await putIfAbsent(path, `${JSON.stringify(release)}\n`, "application/json");
  }
  await recordCatalogue(release, releaseId, now);
  const pointer = await readConstraintsPointer(constraintsBundlePointerPath(bundle));
  if (pointer?.release_id === releaseId) {
    return { ok: true, rows, bytes: existing?.size ?? bytes, hash, releaseId };
  }
  const next: ConstraintsPointer = {
    release_id: releaseId,
    bundle,
    generated_at: now.toISOString(),
  };
  if (pointer && pointer.release_id !== releaseId) {
    await constraintsStore().put(
      constraintsBundlePreviousPath(bundle),
      `${JSON.stringify(pointer)}\n`,
      constraintsMutablePut("application/json"),
    );
  }
  await constraintsStore().put(
    constraintsBundlePointerPath(bundle),
    `${JSON.stringify(next)}\n`,
    constraintsMutablePut("application/json"),
  );
  const global = await readConstraintsPointer(CONSTRAINTS_LATEST_PATH);
  if (global && global.release_id !== releaseId) {
    await constraintsStore().put(
      CONSTRAINTS_PREVIOUS_PATH,
      `${JSON.stringify(global)}\n`,
      constraintsMutablePut("application/json"),
    );
  }
  await constraintsStore().put(CONSTRAINTS_LATEST_PATH, `${JSON.stringify(next)}\n`, constraintsMutablePut("application/json"));
  revalidateConstraintPaths();
  return { ok: true, rows, bytes, hash, releaseId };
}

async function prepareRelease(
  hash: string,
  bundle: ConstraintsBundle,
  now: Date,
  rawText?: string,
  carriedMeta?: FetchMeta,
): Promise<PreparedConstraints> {
  const hex = hash.startsWith("sha256:") ? hash.slice("sha256:".length) : hash;
  const carried = carriedExtract(hash, rawText, carriedMeta);
  const loaded = carried ?? (await loadStoredExtract(hex));
  if (!loaded) {
    throw blobReadbackError("NESO constraint raw body is missing", CONSTRAINTS_MAX_RETRIES);
  }
  const { body: rawBody, size: rawSize, meta } = loaded;
  if (meta.bundle !== bundle) {
    throw new FatalError("NESO constraint bundle does not match the stored extract");
  }
  const built = buildRelease(rawBody, meta, now, rawSize);
  if (!built.ok) {
    await quarantineRaw(now, hex, rawBody);
    throw new FatalError("NESO constraint file kept the previous release");
  }
  const releaseId = constraintReleaseId(built.release);
  return {
    release: built.release,
    releaseId,
    hash: built.release.extract_sha256,
    bytes: rawSize,
    rows: built.release.row_count,
  };
}

function carriedExtract(
  hash: string,
  rawText: string | undefined,
  meta: FetchMeta | undefined,
): { body: string; size: number; meta: FetchMeta } | null {
  if (rawText == null || meta == null) {
    return null;
  }
  const digest = sha256Text(rawText);
  if (hash !== digest && hash !== digest.slice("sha256:".length)) {
    throw new FatalError("NESO constraint raw body does not match the hash");
  }
  return { body: rawText, size: Buffer.byteLength(rawText), meta };
}

async function loadStoredExtract(
  hex: string,
): Promise<{ body: string; size: number; meta: FetchMeta } | null> {
  const loaded = await readUntilPresent(
    async () => {
      const raw = await constraintsStore().get(constraintsRawPath(hex), false);
      const metaFile = await constraintsStore().get(constraintsMetaPath(hex), false);
      if (!raw || !metaFile) {
        return null;
      }
      return { raw, metaFile };
    },
    (attempt) => {
      console.warn("[constraints] raw body is missing", { attempt });
    },
  );
  if (!loaded) {
    return null;
  }
  return {
    body: loaded.raw.body,
    size: loaded.raw.size,
    meta: JSON.parse(loaded.metaFile.body) as FetchMeta,
  };
}

async function quarantineRaw(now: Date, hex: string, body: string): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await putIfAbsent(constraintsQuarantinePath(day, hex), body, "text/csv");
  await pruneQuarantine(now);
}

async function pruneQuarantine(now: Date): Promise<void> {
  const listed = await constraintsStore().list("quarantine/neso-constraints/");
  const cutoff = now.getTime() - CONSTRAINTS_QUARANTINE_DAYS * 24 * 60 * 60 * 1000;
  const stale = listed.filter((blob) => blob.uploadedAt.getTime() < cutoff).map((blob) => blob.pathname);
  if (stale.length > 0) {
    await constraintsStore().del(stale);
  }
}

async function recordCatalogue(release: ConstraintRelease, releaseId: string, now: Date): Promise<void> {
  const content = {
    bundle: release.bundle,
    period_key: release.period_key,
    financial_year: release.financial_year,
    extract_sha256: release.extract_sha256,
    bytes: release.bytes,
    rows: release.row_count,
    release_id: releaseId,
  };
  const contentHash = sha256Prefixed(content);
  const datasetId = release.dataset_id;
  const sourceReleaseId = catalogueReleaseId(datasetId, release.issued_at, contentHash);
  const sourceRelease: SourceRelease = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    source_release_id: sourceReleaseId,
    dataset_id: datasetId,
    published_at: release.issued_at,
    content_hash: contentHash,
    content,
  };
  const generatedAt = now.toISOString();
  const run: IngestionRun = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    ingestion_run_id: `run:${datasetId}:${generatedAt}:${releaseId.slice(0, 12)}`,
    dataset_id: datasetId,
    source_release_id: sourceReleaseId,
    started_at: generatedAt,
    finished_at: generatedAt,
    status: "succeeded",
  };
  sourceReleaseSchema.parse(sourceRelease);
  ingestionRunSchema.parse(run);
  await appendBlobLine(CONSTRAINTS_CATALOGUE_RELEASES_PATH, JSON.stringify(sourceRelease));
  await appendBlobLine(CONSTRAINTS_CATALOGUE_RUNS_PATH, JSON.stringify(run));
}

async function appendBlobLine(pathname: string, line: string): Promise<void> {
  const existing = await constraintsStore().get(pathname, false);
  const text = existing?.body ?? "";
  if (text.split("\n").includes(line)) {
    return;
  }
  const next = text.length === 0 || text.endsWith("\n") ? `${text}${line}\n` : `${text}\n${line}\n`;
  await constraintsStore().put(pathname, next, constraintsMutablePut("application/x-ndjson"));
}

async function putIfAbsent(pathname: string, body: string, contentType: string): Promise<void> {
  await putImmutable(
    () => constraintsStore().put(pathname, body, constraintsImmutablePut(contentType)),
    async () => (await constraintsStore().get(pathname, false)) != null,
  );
}

async function fetchNesoText(url: string): Promise<string> {
  const response = await fetchNeso(url);
  return response.text();
}

async function fetchNesoJson(url: string): Promise<unknown> {
  const response = await fetchNeso(url);
  return response.json();
}

async function fetchNeso(url: string): Promise<Response> {
  if (!url.startsWith("https://api.neso.energy/")) {
    throw new FatalError("NESO URL is not on api.neso.energy");
  }
  const response = await fetch(url, {
    headers: { accept: "application/json,text/csv,*/*", "user-agent": "grid-constraints/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ConstraintsHttpError(response.status);
  }
  return response;
}

function readResources(payload: unknown): NesoResource[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const result = (payload as { result?: { resources?: unknown[] } }).result;
  if (!result || !Array.isArray(result.resources)) {
    return [];
  }
  const resources: NesoResource[] = [];
  for (const resource of result.resources) {
    if (!resource || typeof resource !== "object") {
      continue;
    }
    const row = resource as { name?: unknown; format?: unknown; url?: unknown; last_modified?: unknown };
    if (typeof row.name !== "string" || typeof row.format !== "string" || typeof row.url !== "string") {
      continue;
    }
    resources.push({
      name: row.name,
      format: row.format,
      url: row.url,
      last_modified: typeof row.last_modified === "string" ? row.last_modified : null,
    });
  }
  return resources;
}

export function constraintsHttpRetryable(status: number): boolean {
  return isRetryableConstraintsStatus(status);
}
