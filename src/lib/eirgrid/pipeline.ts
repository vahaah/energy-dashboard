import { createHash } from "node:crypto";
import { FatalError } from "workflow";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueDatasetId,
  catalogueReleaseId,
  ingestionRunSchema,
  sourceReleaseSchema,
  type IngestionRun,
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
} from "@/lib/eirgrid/blob";
import type { EirgridStepStatus } from "@/lib/eirgrid/budget";
import { fetchEirgridBundle } from "@/lib/eirgrid/fetch";
import { revalidateNiPaths } from "@/lib/eirgrid/revalidate";
import type { NiRelease } from "@/lib/eirgrid/release";
import { EIRGRID_SERIES } from "@/lib/eirgrid/spec";

/** The market page publishes a sterling column. It is removed before the raw extract is stored. */
export function stripMarketSterling(market: string): string {
  const field = String.raw`\\?"IMBALANCE_SETTLEMENT_PRICE_GBP\\?"\s*:\s*(?:-?\d+(?:\.\d+)?|null|"(?:\\.|[^"\\])*")`;
  return market.replace(new RegExp(`,(\\s*)${field}`, "g"), "").replace(new RegExp(`${field}\\s*,`, "g"), "");
}

export async function fetchNiBundle(now: Date, attempt: number): Promise<EirgridStepStatus> {
  const bundle = await fetchEirgridBundle(now, attempt);
  const body = JSON.stringify({ ...bundle, market: stripMarketSterling(bundle.market) });
  const hash = sha256Text(body);
  await putIfAbsent(niRawPath(hash.slice("sha256:".length)), body, "application/json");
  return { ok: true, rows: 0, bytes: Buffer.byteLength(body), hash, releaseId: "" };
}

export async function validateNiBundle(hash: string): Promise<EirgridStepStatus> {
  const raw = await niStore().get(niRawPath(hash.slice("sha256:".length)), false);
  if (!raw) {
    throw new FatalError("EirGrid extract is missing");
  }
  const release = releaseFromBundle(JSON.parse(raw.body) as Parameters<typeof releaseFromBundle>[0]);
  if (!bundleHasNiDemand(release)) {
    throw new FatalError("EirGrid Northern Ireland demand is missing");
  }
  return {
    ok: true,
    rows: release.series.reduce((sum, series) => sum + series.points.length, 0),
    bytes: raw.size,
    hash,
    releaseId: release.release_id,
  };
}

export async function publishNiBundle(hash: string, now: Date): Promise<EirgridStepStatus> {
  const raw = await niStore().get(niRawPath(hash.slice("sha256:".length)), false);
  if (!raw) {
    throw new FatalError("EirGrid extract is missing");
  }
  const bundle = JSON.parse(raw.body) as Parameters<typeof releaseFromBundle>[0];
  const release = releaseFromBundle(bundle);
  if (!bundleHasNiDemand(release)) {
    throw new FatalError("EirGrid Northern Ireland demand is missing");
  }
  const path = niReleasePath(release.release_id);
  const existing = await niStore().get(path, false);
  if (!existing) {
    await niStore().put(path, JSON.stringify(release), niImmutablePut("application/json"));
  }
  const previous = await niStore().get(NI_LATEST_PATH, false);
  await recordCatalogue(release, bundle, now);
  revalidateNiPaths();
  if (previous) {
    await niStore().put(NI_PREVIOUS_PATH, previous.body, niMutablePut("application/json"));
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

async function recordCatalogue(
  release: NiRelease,
  bundle: Parameters<typeof releaseFromBundle>[0],
  now: Date,
): Promise<void> {
  const stamps = areaPublishedAt(bundle);
  const areas = [...new Set(release.series.map((series) => seriesArea(series.metric_id)))];
  for (const area of areas) {
    const metricIds = EIRGRID_SERIES.filter((series) => series.area === area).map((series) => series.metric_id);
    const publishedAt = stamps.get(area) ?? null;
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
      status: "succeeded",
    };
    sourceReleaseSchema.parse(sourceRelease);
    ingestionRunSchema.parse(run);
    await appendLine(NI_CATALOGUE_RELEASES_PATH, JSON.stringify(sourceRelease));
    await appendLine(NI_CATALOGUE_RUNS_PATH, JSON.stringify(run));
  }
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
  const existing = await niStore().get(pathname, false);
  if (existing) {
    return;
  }
  await niStore().put(pathname, body, niImmutablePut(contentType));
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
