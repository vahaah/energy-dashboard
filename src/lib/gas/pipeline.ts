import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FatalError, RetryableError } from "workflow";
import { sha256Bytes, sha256Prefixed } from "@/lib/catalogue/canonical";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueDatasetId,
  catalogueReleaseId,
  ingestionRunSchema,
  sourceReleaseSchema,
  type IngestionRun,
  type SourceRelease,
} from "@/lib/catalogue/schema";
import {
  GAS_CATALOGUE_RELEASES_PATH,
  GAS_CATALOGUE_RUNS_PATH,
  GAS_CATALOGUE_STAMP_PATH,
  GAS_LATEST_PATH,
  GAS_POINTER_KEY,
  GAS_POINTER_TTL_SECONDS,
  GAS_PREVIOUS_PATH,
  GAS_QUARANTINE_DAYS,
  gasDayPointerPath,
  gasQuarantinePath,
  gasRawPath,
  gasReleasePath,
  gasSeriesPath,
  gasStore,
  immutablePut,
  mutablePut,
  parsePointer,
  type GasPointer,
} from "@/lib/gas/blob";
import {
  GAS_MAX_RETRIES,
  type GasStepStatus,
} from "@/lib/gas/budget";
import { revalidateGasPaths } from "@/lib/gas/revalidate";
import {
  GAS_CATALOGUE_URL,
  gasBundleCsvUrl,
  gasBundlePublicationIds,
  gasBundleWindow,
  type GasBundle,
} from "@/lib/ingest/national-gas/bundles";
import {
  NATIONAL_GAS_CATALOGUE_SHA256,
  loadNationalGasCatalogue,
} from "@/lib/ingest/national-gas/catalogue";
import { parseGasCsvTable } from "@/lib/ingest/national-gas/csv";
import { gasDayContaining } from "@/lib/ingest/national-gas/gas-day";
import { parseGasCsv } from "@/lib/ingest/national-gas/parse";
import { buildGasRelease, gasReleaseSchema, type GasRelease } from "@/lib/ingest/national-gas/release";
import { addUtcDays } from "@/lib/london-time";
import { getRedis } from "@/lib/redis-cache";

export {
  emptyGasStatus,
  GAS_COMPLETED_DAY_RUNS_PER_DAY,
  GAS_INTRADAY_RUNS_PER_DAY,
  GAS_MAX_RETRIES,
  GAS_TINYBIRD_OPS,
  GAS_WORKFLOW_EVENTS_PER_DAY,
  GAS_WORKFLOW_EVENTS_PER_RUN,
  GAS_WORKFLOW_STEPS,
  type GasStepStatus,
} from "@/lib/gas/budget";

const RETRY_BASE_MS = [30_000, 120_000] as const;
const RETRY_JITTER_MS = 10_000;
const CSV_TIMEOUT_MS = 20_000;
const CATALOGUE_TIMEOUT_MS = 30_000;

export class GasHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`National Gas HTTP ${status}`);
    this.name = "GasHttpError";
    this.status = status;
  }
}

type CatalogueStamp = {
  sha256: string | null;
  fetched_at: string;
};

type PreparedRelease = {
  release: GasRelease;
  releaseId: string;
  hash: string;
  bytes: number;
  rows: number;
};

export function gasRetryAfter(attempt: number, now = Date.now()): Date {
  const index = Math.min(Math.max(attempt, 1), RETRY_BASE_MS.length) - 1;
  const base = RETRY_BASE_MS[index] ?? RETRY_BASE_MS[RETRY_BASE_MS.length - 1];
  const jitter = Math.floor(Math.random() * RETRY_JITTER_MS);
  return new Date(now + base + jitter);
}

export function gasStepError(error: unknown, attempt: number): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }
  const retryable = isRetryableGasError(error);
  const message = error instanceof GasHttpError ? error.message : "National Gas request failed";
  if (!retryable) {
    return new FatalError(message);
  }
  if (attempt > GAS_MAX_RETRIES) {
    return new FatalError(message);
  }
  return new RetryableError(message, { retryAfter: gasRetryAfter(attempt) });
}

export function gasReleaseId(release: GasRelease): string {
  const stable = {
    ...release,
    components: release.components.map((component) => ({
      ...component,
      retrieved_at: "1970-01-01T00:00:00.000Z",
    })),
  };
  return sha256Prefixed(stable).slice("sha256:".length);
}

export async function fetchGasBundle(bundle: GasBundle, now: Date, attempt: number): Promise<GasStepStatus> {
  try {
    await ensureCatalogueHash(now, attempt);
    await pruneQuarantine(now);
  } catch (error) {
    throw gasStepError(error, attempt);
  }

  const ids = gasBundlePublicationIds(bundle);
  const window = gasBundleWindow(bundle, now);
  const url = gasBundleCsvUrl(ids, window.from, window.to);
  let body: string;
  try {
    body = await fetchGasText(url, CSV_TIMEOUT_MS);
  } catch (error) {
    throw gasStepError(error, attempt);
  }
  const hash = sha256Text(body);
  const hex = hash.slice("sha256:".length);
  await putIfAbsent(gasRawPath(hex), body, "text/csv");
  return {
    ok: true,
    rows: parseGasCsvTable(body).rows.length,
    bytes: Buffer.byteLength(body),
    hash,
    releaseId: "",
  };
}

export async function validateGasBundle(hash: string, bundle: GasBundle, now: Date): Promise<GasStepStatus> {
  const prepared = await prepareRelease(hash, bundle, now);
  return {
    ok: true,
    rows: prepared.rows,
    bytes: prepared.bytes,
    hash,
    releaseId: prepared.releaseId,
  };
}

export async function publishGasBundle(
  hash: string,
  bundle: GasBundle,
  now: Date,
  catalogueDir?: string,
): Promise<GasStepStatus> {
  const prepared = await prepareRelease(hash, bundle, now);
  const { release, releaseId, bytes, rows } = prepared;
  const path = gasReleasePath(releaseId);
  const existing = await gasStore().get(path, true);
  const pointer = await readPointer(GAS_LATEST_PATH);
  if (existing && pointer?.release_id === releaseId) {
    return { ok: true, rows, bytes: existing.size, hash, releaseId };
  }
  if (!existing) {
    await putIfAbsent(path, `${JSON.stringify(release)}\n`, "application/json");
  }
  if (pointer?.release_id === releaseId) {
    return { ok: true, rows, bytes, hash, releaseId };
  }
  if (pointer && existing && !(await releaseIsNewer(release, pointer))) {
    return { ok: true, rows, bytes: existing.size, hash, releaseId };
  }
  await recordCatalogue(bundle, release, releaseId, hash, bytes, now, catalogueDir);
  await mergeSeries(release);
  const next: GasPointer = { release_id: releaseId, generated_at: now.toISOString() };
  if (pointer) {
    await gasStore().put(GAS_PREVIOUS_PATH, `${JSON.stringify(pointer)}\n`, mutablePut("application/json"));
  }
  await gasStore().put(
    gasDayPointerPath(release.gas_day.label),
    `${JSON.stringify(next)}\n`,
    mutablePut("application/json"),
  );
  await gasStore().put(GAS_LATEST_PATH, `${JSON.stringify(next)}\n`, mutablePut("application/json"));
  await writeCachedPointer(next);
  revalidateGasPaths();
  return { ok: true, rows, bytes, hash, releaseId };
}

async function prepareRelease(hash: string, bundle: GasBundle, now: Date): Promise<PreparedRelease> {
  const hex = hash.startsWith("sha256:") ? hash.slice("sha256:".length) : hash;
  const raw = await gasStore().get(gasRawPath(hex), true);
  if (!raw) {
    throw new FatalError("National Gas raw body is missing");
  }
  const parsed = normaliseGasCsv(raw.body, bundle, now);
  if (!parsed.ok) {
    await quarantineRaw(now, hex, raw.body);
    throw new FatalError("National Gas CSV kept the previous release");
  }
  return {
    release: parsed.release,
    releaseId: gasReleaseId(parsed.release),
    hash,
    bytes: raw.size,
    rows: parsed.release.components.length,
  };
}

function normaliseGasCsv(
  text: string,
  bundle: GasBundle,
  now: Date,
): { ok: true; release: GasRelease } | { ok: false } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed.length === 0 || trimmed.startsWith("<")) {
    return { ok: false };
  }
  const table = parseGasCsvTable(text);
  const header = new Set(table.header);
  if (![...["Applicable At", "Applicable For", "Data Item", "Value", "Generated Time"]].every((column) => header.has(column))) {
    return { ok: false };
  }
  let catalogue;
  try {
    catalogue = loadNationalGasCatalogue();
  } catch {
    return { ok: false };
  }
  const parsed = parseGasCsv(text, catalogue);
  const label = chooseGasDay(bundle, parsed.observations, now);
  if (!label) {
    return { ok: false };
  }
  let release: GasRelease;
  try {
    release = buildGasRelease({
      catalogue,
      observations: parsed.observations,
      quarantine: parsed.quarantine,
      gasDayLabel: label,
      retrievedAt: now.toISOString(),
    });
  } catch {
    return { ok: false };
  }
  const checked = gasReleaseSchema.safeParse(release);
  if (!checked.success) {
    return { ok: false };
  }
  return { ok: true, release: checked.data };
}

function chooseGasDay(
  bundle: GasBundle,
  observations: readonly { gas_day: { label: string } }[],
  now: Date,
): string | null {
  const current = gasDayContaining(now).label;
  const labels = [...new Set(observations.map((row) => row.gas_day.label))].sort();
  switch (bundle) {
    case "intraday":
      return labels.includes(current) ? current : null;
    case "completed-day": {
      const finished = labels.filter((label) => label < current);
      return finished[finished.length - 1] ?? null;
    }
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

async function ensureCatalogueHash(now: Date, attempt: number): Promise<void> {
  const stamp = await readStamp();
  const today = now.toISOString().slice(0, 10);
  if (stamp && stamp.fetched_at.slice(0, 10) === today) {
    if (stamp.sha256 && stamp.sha256 !== NATIONAL_GAS_CATALOGUE_SHA256) {
      throw new FatalError("National Gas catalogue hash changed");
    }
    return;
  }
  let body: string;
  try {
    body = await fetchGasText(GAS_CATALOGUE_URL, CATALOGUE_TIMEOUT_MS);
  } catch (error) {
    const classified = gasStepError(error, attempt);
    if (classified instanceof FatalError) {
      await writeStamp({ sha256: null, fetched_at: now.toISOString() });
    }
    throw classified;
  }
  const sha256 = sha256Bytes(Buffer.from(body));
  await writeStamp({ sha256, fetched_at: now.toISOString() });
  if (sha256 !== NATIONAL_GAS_CATALOGUE_SHA256) {
    throw new FatalError("National Gas catalogue hash changed");
  }
}

async function quarantineRaw(now: Date, hex: string, body: string): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await putIfAbsent(gasQuarantinePath(day, hex), body, "text/csv");
}

export async function pruneQuarantine(now: Date): Promise<number> {
  const cutoff = addUtcDays(now.toISOString().slice(0, 10), -GAS_QUARANTINE_DAYS);
  let listed: Array<{ pathname: string }>;
  try {
    listed = await gasStore().list("quarantine/");
  } catch {
    return 0;
  }
  const stale = listed
    .filter((blob) => {
      const day = quarantineDay(blob.pathname);
      return day != null && day < cutoff;
    })
    .map((blob) => blob.pathname);
  if (stale.length === 0) {
    return 0;
  }
  await gasStore().del(stale);
  return stale.length;
}

function quarantineDay(pathname: string): string | null {
  const match = /^quarantine\/(\d{4}-\d{2}-\d{2})\//.exec(pathname);
  return match?.[1] ?? null;
}

async function releaseIsNewer(release: GasRelease, pointer: GasPointer): Promise<boolean> {
  const current = await gasStore().get(gasReleasePath(pointer.release_id), true);
  if (!current) {
    return true;
  }
  let parsed: GasRelease;
  try {
    parsed = gasReleaseSchema.parse(JSON.parse(current.body));
  } catch {
    return true;
  }
  return newestPublishedAt(release) > newestPublishedAt(parsed);
}

function newestPublishedAt(release: GasRelease): string {
  return release.components.reduce((max, component) => (component.published_at > max ? component.published_at : max), "");
}

type GasPoint = {
  applicable_at: string;
  published_at: string;
  gas_day: string;
  value: number | null;
};

async function mergeSeries(release: GasRelease): Promise<void> {
  const byMetric = new Map<string, { unit: string; points: GasPoint[] }>();
  for (const component of release.components) {
    const bucket = byMetric.get(component.metric_id) ?? { unit: component.unit, points: [] };
    bucket.points.push({
      applicable_at: component.applicable_at,
      published_at: component.published_at,
      gas_day: release.gas_day.label,
      value: component.value,
    });
    byMetric.set(component.metric_id, bucket);
  }
  for (const [metricId, bucket] of byMetric) {
    const path = gasSeriesPath(metricId);
    const existing = await readSeries(path);
    const points = dedupePoints([...existing, ...bucket.points]);
    await gasStore().put(
      path,
      `${JSON.stringify({ metric_id: metricId, unit: bucket.unit, points })}\n`,
      mutablePut("application/json"),
    );
  }
}

async function readSeries(path: string): Promise<GasPoint[]> {
  const stored = await gasStore().get(path, false);
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored.body) as { points?: GasPoint[] };
    return Array.isArray(parsed.points) ? parsed.points : [];
  } catch {
    return [];
  }
}

function dedupePoints(points: readonly GasPoint[]): GasPoint[] {
  const seen = new Map<string, GasPoint>();
  for (const point of points) {
    const key = `${point.applicable_at}\t${point.published_at}`;
    if (!seen.has(key)) {
      seen.set(key, point);
    }
  }
  return [...seen.values()].sort(
    (left, right) =>
      left.applicable_at.localeCompare(right.applicable_at) ||
      left.published_at.localeCompare(right.published_at),
  );
}

function spinePublication(bundle: GasBundle): string {
  switch (bundle) {
    case "intraday":
      return "PUBOB2042";
    case "completed-day":
      return "PUBOB637";
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

async function recordCatalogue(
  bundle: GasBundle,
  release: GasRelease,
  releaseId: string,
  extractHash: string,
  bytes: number,
  now: Date,
  catalogueDir?: string,
): Promise<void> {
  const content = {
    bundle,
    gas_day: release.gas_day.label,
    extract_sha256: extractHash,
    bytes,
    release_id: releaseId,
    publication_ids: [...gasBundlePublicationIds(bundle)],
  };
  const contentHash = sha256Prefixed(content);
  const datasetId = catalogueDatasetId("national-gas", spinePublication(bundle));
  const sourceReleaseId = catalogueReleaseId(datasetId, null, contentHash);
  const sourceRelease: SourceRelease = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    source_release_id: sourceReleaseId,
    dataset_id: datasetId,
    published_at: null,
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
  const releaseLine = JSON.stringify(sourceRelease);
  const runLine = JSON.stringify(run);
  await appendBlobLine(GAS_CATALOGUE_RELEASES_PATH, releaseLine);
  await appendBlobLine(GAS_CATALOGUE_RUNS_PATH, runLine);
  if (catalogueDir) {
    appendCatalogueLine(catalogueDir, "source_releases.ndjson", releaseLine);
    appendCatalogueLine(catalogueDir, "ingestion_runs.ndjson", runLine);
  }
}

async function appendBlobLine(pathname: string, line: string): Promise<void> {
  const existing = await gasStore().get(pathname, false);
  const text = existing?.body ?? "";
  if (text.split("\n").includes(line)) {
    return;
  }
  const next = text.length === 0 || text.endsWith("\n") ? `${text}${line}\n` : `${text}\n${line}\n`;
  await gasStore().put(pathname, next, mutablePut("application/x-ndjson"));
}

export function appendCatalogueLine(dir: string, file: "source_releases.ndjson" | "ingestion_runs.ndjson", line: string): void {
  const path = join(dir, file);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (text.split("\n").includes(line)) {
    return;
  }
  const prefix = text.length === 0 || text.endsWith("\n") ? "" : "\n";
  appendFileSync(path, `${prefix}${line}\n`);
}

async function readStamp(): Promise<CatalogueStamp | null> {
  const stored = await gasStore().get(GAS_CATALOGUE_STAMP_PATH, false);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored.body) as CatalogueStamp;
    if (typeof parsed.fetched_at !== "string") {
      return null;
    }
    if (parsed.sha256 != null && typeof parsed.sha256 !== "string") {
      return null;
    }
    return { sha256: parsed.sha256 ?? null, fetched_at: parsed.fetched_at };
  } catch {
    return null;
  }
}

async function writeStamp(stamp: CatalogueStamp): Promise<void> {
  await gasStore().put(GAS_CATALOGUE_STAMP_PATH, `${JSON.stringify(stamp)}\n`, mutablePut("application/json"));
}

export async function readPointer(pathname: string): Promise<GasPointer | null> {
  const stored = await gasStore().get(pathname, false);
  if (!stored) {
    return null;
  }
  return parsePointer(stored.body);
}

async function writeCachedPointer(pointer: GasPointer): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.set(GAS_POINTER_KEY, pointer, { ex: GAS_POINTER_TTL_SECONDS });
}

async function putIfAbsent(pathname: string, body: string, contentType: string): Promise<void> {
  const existing = await gasStore().get(pathname, true);
  if (existing) {
    return;
  }
  try {
    await gasStore().put(pathname, body, immutablePut(contentType));
  } catch {
    const again = await gasStore().get(pathname, false);
    if (!again) {
      throw new FatalError("National Gas blob write failed");
    }
  }
}

async function fetchGasText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new GasHttpError(response.status);
  }
  return response.text();
}

function sha256Text(value: string): string {
  return sha256Bytes(Buffer.from(value));
}

function isRetryableGasError(error: unknown): boolean {
  if (error instanceof GasHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }
  return error instanceof TypeError;
}

export function rawHash(body: string): string {
  return sha256Text(body);
}
