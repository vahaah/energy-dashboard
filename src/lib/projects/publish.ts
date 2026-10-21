import { createHash } from "node:crypto";
import { FatalError, RetryableError } from "workflow";
import { blobReadbackError, fitsInlineResult, putImmutable, readUntilPresent } from "@/lib/blob-readback";
import { canonicalJson, sha256Bytes, sha256Prefixed } from "@/lib/catalogue/canonical";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueReleaseId,
  type IngestionRun,
  type SourceRelease,
} from "@/lib/catalogue/schema";
import { NESO_MIN_GAP_MS } from "@/lib/constraints/budget";
import { ckanInstant, paceNeso, selectNesoResource, type NesoResource } from "@/lib/constraints/neso";
import { TEC_MAX_RETRIES, type TecStepStatus } from "@/lib/projects/budget";
import {
  TEC_CATALOGUE_RELEASES_PATH,
  TEC_CATALOGUE_RUNS_PATH,
  TEC_LATEST_PATH,
  TEC_PREVIOUS_PATH,
  TEC_QUARANTINE_DAYS,
  parseTecPointer,
  tecImmutablePut,
  tecMetaPath,
  tecMutablePut,
  tecQuarantinePath,
  tecRawPath,
  tecReleasePath,
  tecStore,
} from "@/lib/projects/blob";
import { revalidateProjectPaths } from "@/lib/projects/revalidate";
import { TEC_DATASET_ID } from "@/lib/projects/schema";
import type { SourceProject } from "@/lib/projects/source";
import { parseTecProjects } from "@/lib/projects/tec";

export const TEC_PACKAGE_URL =
  "https://api.neso.energy/api/3/action/package_show?id=transmission-entry-capacity-tec-register";
export const TEC_RESOURCE_NAME = "TEC Register";

const FETCH_TIMEOUT_MS = 90_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export type FetchMeta = {
  source_url: string;
  issued_at: string;
  resource_name: string;
};

export type TecReleaseDocument = {
  catalogue_schema_version: 1;
  dataset_id: typeof TEC_DATASET_ID;
  published_at: string;
  extract_sha256: string;
  bytes: number;
  rows: SourceProject[];
};

function sha256Text(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function tecStepError(error: unknown, attempt: number): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }
  const status = error instanceof TecHttpError ? error.status : 0;
  const retryable = RETRYABLE.has(status);
  const message = error instanceof Error ? error.message : "NESO request failed";
  if (!retryable || attempt > TEC_MAX_RETRIES) {
    return new FatalError(message);
  }
  const base = attempt <= 1 ? 30_000 : 120_000;
  const jitter = Math.floor(Math.random() * 10_000);
  return new RetryableError(message, { retryAfter: new Date(Date.now() + base + jitter) });
}

class TecHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`NESO HTTP ${status}`);
    this.name = "TecHttpError";
    this.status = status;
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new TecHttpError(response.status);
  }
  return response.text();
}

export function tecBlobReleaseId(document: Omit<TecReleaseDocument, "bytes"> & { bytes: number }): string {
  return sha256Prefixed({
    dataset_id: document.dataset_id,
    published_at: document.published_at,
    extract_sha256: document.extract_sha256,
    rows: document.rows,
  }).slice("sha256:".length);
}

export type TecFetchResult = TecStepStatus & {
  /** CSV and fetch meta when they fit in the step result. */
  raw?: string;
  meta?: FetchMeta;
};

export async function fetchTecRegister(now: Date, attempt: number, gapMs = NESO_MIN_GAP_MS): Promise<TecFetchResult> {
  try {
    await paceNeso(gapMs, now.getTime());
    const listed = JSON.parse(await fetchText(TEC_PACKAGE_URL)) as { result?: { resources?: NesoResource[] } };
    const resources = listed.result?.resources ?? [];
    const selected = selectNesoResource(resources, TEC_RESOURCE_NAME);
    if (!selected) {
      throw new FatalError("NESO TEC resource is missing");
    }
    const issued = ckanInstant(selected.last_modified ?? "");
    if (!issued || !selected.url.startsWith("https://api.neso.energy/")) {
      throw new FatalError("NESO TEC resource is missing a publication time");
    }
    await paceNeso(gapMs);
    const csv = await fetchText(selected.url);
    const hash = sha256Text(csv);
    const hex = hash.slice("sha256:".length);
    const meta: FetchMeta = { source_url: selected.url, issued_at: issued, resource_name: selected.name };
    const bytes = Buffer.byteLength(csv);
    await putIfAbsent(tecRawPath(hex), csv, "text/csv");
    await putIfAbsent(tecMetaPath(hex), `${JSON.stringify(meta)}\n`, "application/json");
    const result: TecFetchResult = { ok: true, rows: 0, bytes, hash, releaseId: "" };
    const inlined: TecFetchResult = { ...result, raw: csv, meta };
    if (fitsInlineResult(inlined)) {
      return inlined;
    }
    console.warn("[tec] raw body left in blob", { bytes });
    return result;
  } catch (error) {
    throw tecStepError(error, attempt);
  }
}

export async function validateTecRegister(
  hash: string,
  now: Date,
  raw?: string,
  meta?: FetchMeta,
): Promise<TecStepStatus> {
  const prepared = await prepare(hash, now, raw, meta);
  return { ok: true, rows: prepared.rows, bytes: prepared.bytes, hash, releaseId: prepared.releaseId };
}

export async function publishTecRegister(
  hash: string,
  now: Date,
  raw?: string,
  meta?: FetchMeta,
): Promise<TecStepStatus> {
  const prepared = await prepare(hash, now, raw, meta);
  const path = tecReleasePath(prepared.releaseId);
  const existing = await tecStore().get(path, false);
  if (!existing) {
    await putIfAbsent(path, `${JSON.stringify(prepared.document)}\n`, "application/json");
  }
  await recordCatalogue(prepared, now);
  const pointer = parseTecPointer((await tecStore().get(TEC_LATEST_PATH, false))?.body ?? "");
  if (pointer?.release_id === prepared.releaseId) {
    return { ok: true, rows: prepared.rows, bytes: existing?.size ?? prepared.bytes, hash, releaseId: prepared.releaseId };
  }
  if (pointer && pointer.release_id !== prepared.releaseId) {
    await tecStore().put(TEC_PREVIOUS_PATH, `${JSON.stringify(pointer)}\n`, tecMutablePut("application/json"));
  }
  const next = { release_id: prepared.releaseId, generated_at: now.toISOString() };
  await tecStore().put(TEC_LATEST_PATH, `${JSON.stringify(next)}\n`, tecMutablePut("application/json"));
  revalidateProjectPaths();
  return { ok: true, rows: prepared.rows, bytes: prepared.bytes, hash, releaseId: prepared.releaseId };
}

async function prepare(hash: string, now: Date, rawText?: string, carriedMeta?: FetchMeta): Promise<{
  document: TecReleaseDocument;
  releaseId: string;
  rows: number;
  bytes: number;
  issuedAt: string;
}> {
  const hex = hash.startsWith("sha256:") ? hash.slice("sha256:".length) : hash;
  const carried = carriedExtract(hash, rawText, carriedMeta);
  const loaded = carried ?? (await loadStoredExtract(hex));
  if (!loaded) {
    throw blobReadbackError("NESO TEC raw body is missing", TEC_MAX_RETRIES);
  }
  const parsed = parseTecProjects(loaded.body, {
    publishedAt: loaded.meta.issued_at,
    releaseId: `${TEC_DATASET_ID}:${loaded.meta.issued_at}`,
  });
  if (!parsed.ok) {
    await quarantine(now, hex, loaded.body);
    throw new FatalError("NESO TEC file kept the previous release");
  }
  const document: TecReleaseDocument = {
    catalogue_schema_version: 1,
    dataset_id: TEC_DATASET_ID,
    published_at: loaded.meta.issued_at,
    extract_sha256: sha256Bytes(Buffer.from(loaded.body)),
    bytes: loaded.size,
    rows: parsed.rows,
  };
  return {
    document,
    releaseId: tecBlobReleaseId(document),
    rows: parsed.rows.length,
    bytes: loaded.size,
    issuedAt: loaded.meta.issued_at,
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
    throw new FatalError("NESO TEC raw body does not match the hash");
  }
  return { body: rawText, size: Buffer.byteLength(rawText), meta };
}

async function loadStoredExtract(hex: string): Promise<{ body: string; size: number; meta: FetchMeta } | null> {
  const loaded = await readUntilPresent(
    async () => {
      const raw = await tecStore().get(tecRawPath(hex), false);
      const metaFile = await tecStore().get(tecMetaPath(hex), false);
      if (!raw || !metaFile) {
        return null;
      }
      return { raw, metaFile };
    },
    (attempt) => {
      console.warn("[tec] raw body is missing", { attempt });
    },
  );
  if (!loaded) {
    return null;
  }
  return { body: loaded.raw.body, size: loaded.raw.size, meta: JSON.parse(loaded.metaFile.body) as FetchMeta };
}

async function quarantine(now: Date, hex: string, body: string): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await putIfAbsent(tecQuarantinePath(day, hex), body, "text/csv");
  const listed = await tecStore().list("quarantine/tec/");
  const cutoff = now.getTime() - TEC_QUARANTINE_DAYS * 24 * 60 * 60 * 1000;
  const stale = listed.filter((blob) => blob.uploadedAt.getTime() < cutoff).map((blob) => blob.pathname);
  if (stale.length > 0) {
    await tecStore().del(stale);
  }
}

async function recordCatalogue(
  prepared: { document: TecReleaseDocument; releaseId: string; issuedAt: string },
  now: Date,
): Promise<void> {
  const content = {
    edition: "TEC register",
    published_at: prepared.issuedAt,
    download_url: TEC_PACKAGE_URL,
    extract_sha256: prepared.document.extract_sha256,
    bytes: prepared.document.bytes,
    rows: prepared.document.rows.length,
    gate_column_since: "2025-11-21",
    blob_release_id: prepared.releaseId,
  };
  const contentHash = sha256Prefixed(content);
  const sourceReleaseId = catalogueReleaseId(TEC_DATASET_ID, prepared.issuedAt, contentHash);
  const sourceRelease: SourceRelease = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    source_release_id: sourceReleaseId,
    dataset_id: TEC_DATASET_ID,
    published_at: prepared.issuedAt,
    content_hash: contentHash,
    content,
  };
  const generatedAt = now.toISOString();
  const run: IngestionRun = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    ingestion_run_id: `run:${TEC_DATASET_ID}:${generatedAt}:${prepared.releaseId.slice(0, 12)}`,
    dataset_id: TEC_DATASET_ID,
    source_release_id: sourceReleaseId,
    started_at: generatedAt,
    finished_at: generatedAt,
    status: "succeeded",
  };
  await appendLine(TEC_CATALOGUE_RELEASES_PATH, canonicalJson(sourceRelease));
  await appendLine(TEC_CATALOGUE_RUNS_PATH, canonicalJson(run));
}

async function appendLine(path: string, line: string): Promise<void> {
  const existing = await tecStore().get(path, false);
  const body = existing?.body ?? "";
  if (body.includes(line)) {
    return;
  }
  const next = `${body}${body.endsWith("\n") || body.length === 0 ? "" : "\n"}${line}\n`;
  await tecStore().put(path, next, tecMutablePut("application/x-ndjson"));
}

async function putIfAbsent(path: string, body: string, contentType: string): Promise<void> {
  await putImmutable(
    () => tecStore().put(path, body, tecImmutablePut(contentType)),
    async () => (await tecStore().get(path, false)) != null,
  );
}
