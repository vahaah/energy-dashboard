import { EIRGRID_GROUP_LICENCE_READ_ON, EIRGRID_GROUP_LICENCE_URL } from "@/lib/attribution";
import { resolveLondonWallSequence } from "@/lib/ingest/national-gas/gas-day";
import { failedPartIds, type EirgridFetchBundle, type EirgridPartId } from "@/lib/eirgrid/fetch";
import { eirgridStampToWall, mergeParseReports, parseChartDocument, parseFuelMixDocument, parseMarketFeed, parseSnspDocument } from "@/lib/eirgrid/parse";
import { buildNiRelease, type NiRelease } from "@/lib/eirgrid/release";
import { CHART_AREAS, EIRGRID_SERIES, geographyFromFeedRegion, type EirgridSeriesSpec } from "@/lib/eirgrid/spec";

export function metricIdsForEirgridPart(part: EirgridPartId): string[] {
  switch (part) {
    case "chart:NI":
    case "chart:ROI":
    case "chart:ALL":
      return idsFor(geographyFromFeedRegion(part.slice("chart:".length)), "chart");
    case "interconnection:NI":
    case "interconnection:ROI":
    case "interconnection:ALL":
      return idsFor(geographyFromFeedRegion(part.slice("interconnection:".length)), "interconnection");
    case "fuel:NI":
    case "fuel:ROI":
    case "fuel:ALL":
      return idsFor(geographyFromFeedRegion(part.slice("fuel:".length)), "fuel");
    case "snsp":
      return EIRGRID_SERIES.filter((series) => series.area === "SnspAll").map((series) => series.metric_id);
    case "market":
      return EIRGRID_SERIES.filter((series) => series.area === "marketPricing").map((series) => series.metric_id);
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}

export function releaseFromBundle(bundle: EirgridFetchBundle, previous: NiRelease | null = null): NiRelease {
  const reports = [
    ...Object.values(bundle.charts).map(parseChartDocument),
    ...Object.values(bundle.interconnection).map(parseChartDocument),
    ...Object.values(bundle.fuel).map(parseFuelMixDocument),
    parseSnspDocument(bundle.snsp),
    parseMarketFeed(bundle.market),
  ];
  const merged = mergeParseReports(reports);
  const carryIds = new Set(failedPartIds(bundle).flatMap((part) => metricIdsForEirgridPart(part)));
  const fresh = merged.series.filter((series) => !carryIds.has(series.metric_id));
  const carried = previous?.series.filter((series) => carryIds.has(series.metric_id)) ?? [];
  const chartStamp = newestStamp(Object.values(bundle.charts));
  const published = chartStamp ?? (carried.length > 0 && previous ? previous.published_at : bundle.retrieved_at);
  return buildNiRelease(
    {
      published_at: published,
      licence_url: EIRGRID_GROUP_LICENCE_URL,
      licence_read_on: EIRGRID_GROUP_LICENCE_READ_ON,
      series: [...fresh, ...carried],
    },
    bundle.retrieved_at,
  );
}

function idsFor(geography: EirgridSeriesSpec["geography_id"] | null, kind: "chart" | "interconnection" | "fuel"): string[] {
  if (!geography) {
    return [];
  }
  return EIRGRID_SERIES.filter((series) => series.geography_id === geography && areaMatches(series.area, kind)).map(
    (series) => series.metric_id,
  );
}

function areaMatches(area: string, kind: "chart" | "interconnection" | "fuel"): boolean {
  switch (kind) {
    case "chart":
      return (CHART_AREAS as readonly string[]).includes(area);
    case "interconnection":
      return area === "interconnection";
    case "fuel":
      return area === "fuelmix";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** Publisher time for each catalogue area. Market pricing has none, so its release id is the content hash. */
export function areaPublishedAt(bundle: EirgridFetchBundle): ReadonlyMap<string, string | null> {
  const stamps = new Map<string, string | null>();
  const chart = newestStamp(Object.values(bundle.charts));
  for (const area of CHART_AREAS) {
    stamps.set(area, chart);
  }
  stamps.set("interconnection", newestStamp(Object.values(bundle.interconnection)));
  stamps.set("fuelmix", newestStamp(Object.values(bundle.fuel)));
  stamps.set("SnspAll", newestStamp([bundle.snsp]));
  stamps.set("marketPricing", null);
  return stamps;
}

export function bundleHasNiDemand(release: NiRelease): boolean {
  return release.series.some(
    (series) => series.metric_id === "elec.ni.demand.system" && series.points.some((point) => point.value != null),
  );
}

function newestStamp(bodies: readonly string[]): string | null {
  let newest: Date | null = null;
  for (const body of bodies) {
    const instant = newestDataInstant(body);
    if (instant && (!newest || instant.getTime() > newest.getTime())) {
      newest = instant;
    }
  }
  return newest ? newest.toISOString() : null;
}

/** `LastUpdated` when the feed sends it. Otherwise the newest valued row, so a chart body still moves the stamp. */
function newestDataInstant(body: string): Date | null {
  let parsed: { LastUpdated?: unknown; Rows?: unknown };
  try {
    parsed = JSON.parse(body) as { LastUpdated?: unknown; Rows?: unknown };
  } catch {
    return null;
  }
  const updated = typeof parsed.LastUpdated === "string" ? wallInstant(parsed.LastUpdated) : null;
  if (updated) {
    return updated;
  }
  if (!Array.isArray(parsed.Rows)) {
    return null;
  }
  let newest: Date | null = null;
  for (const row of parsed.Rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const value = (row as { Value?: unknown }).Value;
    const stamp = (row as { EffectiveTime?: unknown }).EffectiveTime;
    if (typeof value !== "number" || !Number.isFinite(value) || typeof stamp !== "string") {
      continue;
    }
    const instant = wallInstant(stamp);
    if (instant && (!newest || instant.getTime() > newest.getTime())) {
      newest = instant;
    }
  }
  return newest;
}

function wallInstant(stamp: string): Date | null {
  const wall = eirgridStampToWall(stamp);
  return wall ? (resolveLondonWallSequence([wall])[0] ?? null) : null;
}
