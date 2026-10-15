import { EIRGRID_GROUP_LICENCE_READ_ON, EIRGRID_GROUP_LICENCE_URL } from "@/lib/attribution";
import { resolveLondonWallSequence } from "@/lib/ingest/national-gas/gas-day";
import type { EirgridFetchBundle } from "@/lib/eirgrid/fetch";
import { eirgridStampToWall, mergeParseReports, parseChartDocument, parseFuelMixDocument, parseMarketPricingDocument, parseSnspDocument } from "@/lib/eirgrid/parse";
import { buildNiRelease, type NiRelease } from "@/lib/eirgrid/release";

export function releaseFromBundle(bundle: EirgridFetchBundle): NiRelease {
  const reports = [
    ...Object.values(bundle.charts).map(parseChartDocument),
    ...Object.values(bundle.interconnection).map(parseChartDocument),
    ...Object.values(bundle.fuel).map(parseFuelMixDocument),
    parseSnspDocument(bundle.snsp),
    parseMarketPricingDocument(bundle.market),
  ];
  const merged = mergeParseReports(reports);
  const published = newestStamp(Object.values(bundle.charts)) ?? bundle.retrieved_at;
  return buildNiRelease(
    {
      published_at: published,
      licence_url: EIRGRID_GROUP_LICENCE_URL,
      licence_read_on: EIRGRID_GROUP_LICENCE_READ_ON,
      series: merged.series,
    },
    bundle.retrieved_at,
  );
}

export function bundleHasNiDemand(release: NiRelease): boolean {
  return release.series.some(
    (series) => series.metric_id === "elec.ni.demand.system" && series.points.some((point) => point.value != null),
  );
}

function newestStamp(bodies: readonly string[]): string | null {
  let newest: Date | null = null;
  for (const body of bodies) {
    let lastUpdated = "";
    try {
      const parsed = JSON.parse(body) as { LastUpdated?: unknown };
      lastUpdated = typeof parsed.LastUpdated === "string" ? parsed.LastUpdated : "";
    } catch {
      continue;
    }
    const wall = eirgridStampToWall(lastUpdated);
    const instant = wall ? resolveLondonWallSequence([wall])[0] : null;
    if (instant && (!newest || instant.getTime() > newest.getTime())) {
      newest = instant;
    }
  }
  return newest ? newest.toISOString() : null;
}
