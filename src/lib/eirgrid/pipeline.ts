import { createHash } from "node:crypto";
import { FatalError } from "workflow";
import { blobReadbackError, fitsInline, putImmutable, readUntilPresent } from "@/lib/blob-readback";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueDatasetId,
  catalogueReleaseId,
  ingestionRunSchema,
  sourceReleaseSchema,
  type IngestionRun,
  type IngestionRunStatus,
  type SourceRelease,
} from "@/lib/catalogue/schema";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { areaPublishedAt, bundleHasNiDemand, releaseFromBundle } from "@/lib/eirgrid/build";
import {
  NI_CATALOGUE_RELEASES_PATH,
  NI_CATALOGUE_RUNS_PATH,
  NI_LATEST_PATH,
  NI_PREVIOUS_PATH,
  niImmutablePut,
  niMutablePut,
  niRawPath,
  niReleasePath,
  niStore,
  parseNiPointer,
} from "@/lib/eirgrid/blob";
import { EIRGRID_MAX_RETRIES, type EirgridStepStatus } from "@/lib/eirgrid/budget";
import {
  EIRGRID_PART_IDS,
  failedPartIds,
  fetchEirgridBundle,
  valuedFeedRows,
  type EirgridFetchBundle,
  type EirgridFetchOptions,
  type EirgridPartFailure,
  type EirgridPartId,
} from "@/lib/eirgrid/fetch";
import { parseMarketFeed, parseSnspDocument } from "@/lib/eirgrid/parse";
import { revalidateNiPaths } from "@/lib/eirgrid/revalidate";
import { niReleaseSchema, type NiRelease } from "@/lib/eirgrid/release";
import { CHART_AREAS, EIRGRID_SERIES } from "@/lib/eirgrid/spec";

/** The market page publishes a sterling column. It is removed before the raw extract is stored. */
export function stripMarketSterling(market: string): string {
  const field = String.raw`\\?"IMBALANCE_SETTLEMENT_PRICE_GBP\\?"\s*:\s*(?:-?\d+(?:\.\d+)?|null|"(?:\\.|[^"\\])*")`;
  return market.replace(new RegExp(`,(\\s*)${field}`, "g"), "").replace(new RegExp(`${field}\\s*,`, "g"), "");
}

function partFailures(bundle: EirgridFetchBundle): EirgridPartFailure[] {
  if (!Array.isArray(bundle.part_failures)) {
    return failedPartIds(bundle).map((part) => ({ part, reason: "request failed" }));
  }
  return bundle.part_failures.filter(
    (failure): failure is EirgridPartFailure =>
      Boolean(failure) &&
      typeof failure.reason === "string" &&
      (EIRGRID_PART_IDS as readonly string[]).includes(failure.part),
  );
}

/** Valued rows that the parser drops (wrong region, unknown field) must not replace the previous series. */
function noteFilteredEmpty(
  bundle: EirgridFetchBundle,
  part: EirgridPartId,
  body: string,
  parse: (body: string) => { series: readonly { points: readonly { value: number | null }[] }[] },
): void {
  if (failedPartIds(bundle).includes(part) || valuedFeedRows(body) == null) {
    return;
  }
  const kept = parse(body).series.some((series) => series.points.some((point) => point.value != null));
  if (kept) {
    return;
  }
  bundle.failed_parts = [...failedPartIds(bundle), part];
  bundle.part_failures = [...partFailures(bundle), { part, reason: "zero rows" }];
}

export type NiFetchResult = EirgridStepStatus & {
  /** Stripped bundle when it fits in the step result. Later steps must not read it back. */
  bundle?: EirgridFetchBundle;
};

export async function fetchNiBundle(now: Date, options?: EirgridFetchOptions): Promise<NiFetchResult> {
  const bundle = await fetchEirgridBundle(now, options);
  noteFilteredEmpty(bundle, "snsp", bundle.snsp, parseSnspDocument);
  noteFilteredEmpty(bundle, "market", bundle.market, parseMarketFeed);
  const failed = partFailures(bundle);
  if (failed.length > 0) {
    console.warn("[eirgrid] partial fetch", { failed });
  }
  for (const failure of failed) {
    if (failure.reason === "zero rows") {
      console.warn("[eirgrid] zero rows", { part: failure.part });
    }
  }
  const stripped: EirgridFetchBundle = { ...bundle, market: stripMarketSterling(bundle.market) };
  const body = JSON.stringify(stripped);
  const bytes = Buffer.byteLength(body);
  const hash = sha256Text(body);
  await putIfAbsent(niRawPath(hash.slice("sha256:".length)), body, "application/json");
  const result: NiFetchResult = { ok: true, rows: 0, bytes, hash, releaseId: "" };
  if (fitsInline(bytes)) {
    result.bundle = stripped;
  } else {
    console.warn("[eirgrid] extract left in blob", { bytes });
  }
  return result;
}

export async function validateNiBundle(hash: string, carried?: EirgridFetchBundle): Promise<EirgridStepStatus> {
  const stored = await loadStoredBundle(hash, carried);
  const previous = await previousFor(stored.bundle);
  const release = releaseFromBundle(stored.bundle, previous);
  if (!bundleHasNiDemand(release)) {
    throw new FatalError("EirGrid Northern Ireland demand is missing");
  }
  return {
    ok: true,
    rows: release.series.reduce((sum, series) => sum + series.points.length, 0),
    bytes: stored.bytes,
    hash,
    releaseId: release.release_id,
  };
}

export async function publishNiBundle(
  hash: string,
  now: Date,
  carried?: EirgridFetchBundle,
): Promise<EirgridStepStatus> {
  const stored = await loadStoredBundle(hash, carried);
  const pointerFile = await niStore().get(NI_LATEST_PATH, false);
  const previous = await previousFor(stored.bundle);
  const release = releaseFromBundle(stored.bundle, previous);
  if (!bundleHasNiDemand(release)) {
    throw new FatalError("EirGrid Northern Ireland demand is missing");
  }
  const bundle = stored.bundle;
  const path = niReleasePath(release.release_id);
  await putIfAbsent(path, JSON.stringify(release), "application/json");
  const failed = failedPartIds(bundle);
  await recordCatalogue(release, bundle, now, failed.length > 0 ? "partial" : "succeeded", previous);
  revalidateNiPaths();
  if (pointerFile) {
    await niStore().put(NI_PREVIOUS_PATH, pointerFile.body, niMutablePut("application/json"));
  }
  const pointer = { release_id: release.release_id, generated_at: now.toISOString() };
  await niStore().put(NI_LATEST_PATH, JSON.stringify(pointer), niMutablePut("application/json"));
  return {
    ok: true,
    rows: release.series.reduce((sum, series) => sum + series.points.length, 0),
    bytes: Buffer.byteLength(JSON.stringify(release)),
    hash,
    releaseId: release.release_id,
  };
}

async function loadStoredBundle(
  hash: string,
  carried?: EirgridFetchBundle,
): Promise<{ bundle: EirgridFetchBundle; bytes: number }> {
  if (carried) {
    return { bundle: carried, bytes: Buffer.byteLength(JSON.stringify(carried)) };
  }
  const path = niRawPath(hash.slice("sha256:".length));
  const raw = await readUntilPresent(
    () => niStore().get(path, false),
    (attempt) => {
      console.warn("[eirgrid] extract is missing", { attempt });
    },
  );
  if (!raw) {
    throw blobReadbackError("EirGrid extract is missing", EIRGRID_MAX_RETRIES);
  }
  return { bundle: JSON.parse(raw.body) as EirgridFetchBundle, bytes: raw.size };
}

async function previousFor(bundle: EirgridFetchBundle): Promise<NiRelease | null> {
  if (failedPartIds(bundle).length === 0) {
    return null;
  }
  const pointerFile = await niStore().get(NI_LATEST_PATH, false);
  const pointer = pointerFile ? parseNiPointer(pointerFile.body) : null;
  if (!pointer) {
    return null;
  }
  const file = await niStore().get(niReleasePath(pointer.release_id), false);
  if (!file) {
    return null;
  }
  const parsed = niReleaseSchema.safeParse(JSON.parse(file.body));
  return parsed.success ? parsed.data : null;
}

async function recordCatalogue(
  release: NiRelease,
  bundle: EirgridFetchBundle,
  now: Date,
  status: IngestionRunStatus,
  previous: NiRelease | null,
): Promise<void> {
  const stamps = areaPublishedAt(bundle);
  const failed = failedPartIds(bundle);
  const carriedStamps = await previousAreaStamps(previous);
  const areas = [...new Set(release.series.map((series) => seriesArea(series.metric_id)))];
  for (const area of areas) {
    const metricIds = EIRGRID_SERIES.filter((series) => series.area === area).map((series) => series.metric_id);
    const stamped = stamps.get(area) ?? null;
    const publishedAt = stamped ?? (areaKeepsPreviousStamp(area, failed) ? (carriedStamps.get(area) ?? null) : null);
    const content = {
      area,
      release_id: release.release_id,
      published_at: publishedAt,
      metric_ids: metricIds,
    };
    const contentHash = sha256Prefixed(content);
    const datasetId = catalogueDatasetId("eirgrid-group", area);
    const sourceReleaseId = catalogueReleaseId(datasetId, publishedAt, contentHash);
    const sourceRelease: SourceRelease = {
      catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
      source_release_id: sourceReleaseId,
      dataset_id: datasetId,
      published_at: publishedAt,
      content_hash: contentHash,
      content,
    };
    const run: IngestionRun = {
      catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
      ingestion_run_id: `run:${datasetId}:${now.toISOString()}:${release.release_id.slice(0, 12)}`,
      dataset_id: datasetId,
      source_release_id: sourceReleaseId,
      started_at: now.toISOString(),
      finished_at: now.toISOString(),
      status,
    };
    sourceReleaseSchema.parse(sourceRelease);
    ingestionRunSchema.parse(run);
    await appendLine(NI_CATALOGUE_RELEASES_PATH, JSON.stringify(sourceRelease));
    await appendLine(NI_CATALOGUE_RUNS_PATH, JSON.stringify(run));
  }
}

function areaKeepsPreviousStamp(area: string, failed: readonly EirgridPartId[]): boolean {
  const missed = new Set<string>(failed);
  if ((CHART_AREAS as readonly string[]).includes(area)) {
    return everyPart(missed, ["chart:NI", "chart:ROI", "chart:ALL"]);
  }
  switch (area) {
    case "interconnection":
      return everyPart(missed, ["interconnection:NI", "interconnection:ROI", "interconnection:ALL"]);
    case "fuelmix":
      return everyPart(missed, ["fuel:NI", "fuel:ROI", "fuel:ALL"]);
    case "SnspAll":
      return missed.has("snsp");
    case "marketPricing":
      return false;
    default:
      return false;
  }
}

function everyPart(failed: ReadonlySet<string>, parts: readonly EirgridPartId[]): boolean {
  return parts.every((part) => failed.has(part));
}

/** Per-area publisher time already recorded for the release whose series we carried. */
async function previousAreaStamps(previous: NiRelease | null): Promise<ReadonlyMap<string, string | null>> {
  const stamps = new Map<string, string | null>();
  if (!previous) {
    return stamps;
  }
  const file = await niStore().get(NI_CATALOGUE_RELEASES_PATH, false);
  const text = file?.body ?? "";
  for (const line of text.split("\n")) {
    const row = catalogueAreaStamp(line, previous.release_id);
    if (!row) {
      continue;
    }
    stamps.set(row.area, row.publishedAt);
  }
  return stamps;
}

function catalogueAreaStamp(line: string, releaseId: string): { area: string; publishedAt: string | null } | null {
  if (line.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const row = parsed as { published_at?: unknown; content?: unknown };
  if (!row.content || typeof row.content !== "object") {
    return null;
  }
  const content = row.content as { area?: unknown; release_id?: unknown };
  if (content.release_id !== releaseId || typeof content.area !== "string") {
    return null;
  }
  return { area: content.area, publishedAt: typeof row.published_at === "string" ? row.published_at : null };
}

function seriesArea(metricId: string): string {
  return EIRGRID_SERIES.find((series) => series.metric_id === metricId)?.area ?? "demandactual";
}

async function appendLine(pathname: string, line: string): Promise<void> {
  const existing = await niStore().get(pathname, false);
  const text = existing?.body ?? "";
  if (text.split("\n").includes(line)) {
    return;
  }
  const next = text.length === 0 || text.endsWith("\n") ? `${text}${line}\n` : `${text}\n${line}\n`;
  await niStore().put(pathname, next, niMutablePut("application/x-ndjson"));
}

async function putIfAbsent(pathname: string, body: string, contentType: string): Promise<void> {
  await putImmutable(
    () => niStore().put(pathname, body, niImmutablePut(contentType)),
    async () => (await niStore().get(pathname, false)) != null,
  );
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
