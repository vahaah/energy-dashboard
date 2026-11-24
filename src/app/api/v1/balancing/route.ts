import { NextResponse } from "next/server";
import { scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { cdnCacheHeaders } from "@/lib/api-route";
import { balancingRangeSeries, buildBalancingPage } from "@/lib/balancing/page-model";
import { readBalancingRelease } from "@/lib/balancing/load";
import { BALANCING_RANGES, type BalancingRange } from "@/lib/balancing/types";

/**
 * GET /api/v1/balancing
 *
 * Prepared balancing release. Dynamic so scope checks see the query string. No Tinybird query.
 * `scope` and `geography` must be GB when present.
 */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["scope", "geography", "range"]);
const RANGE_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

function isRange(value: string): value is BalancingRange {
  return (BALANCING_RANGES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = scopeRejection(params);
  if (scope) {
    return NextResponse.json(scope.body, { status: scope.status });
  }
  const filter = unsupportedFilter(params, ALLOWED);
  if (filter) {
    return NextResponse.json(filter.body, { status: filter.status });
  }
  const range = params.get("range");
  if (range !== null && (!isRange(range) || params.getAll("range").length > 1)) {
    return NextResponse.json({ error: "unsupported filter" }, { status: 400 });
  }
  const release = await readBalancingRelease();
  const model = buildBalancingPage(release, new Date());
  if (!model.available || !release) {
    return NextResponse.json(
      { error: "The source is unavailable. The last published data is still returned where Grid holds it." },
      { status: 503 },
    );
  }
  if (range && isRange(range)) {
    const series = balancingRangeSeries(model, range);
    return NextResponse.json(
      {
        range,
        daily: series.daily,
        monthly: series.monthly,
        trade_months: series.trade,
        sources: ["neso-open-data", "elexon-bmrs"],
      },
      { headers: cdnCacheHeaders(RANGE_CACHE) },
    );
  }
  return NextResponse.json({
    latest: model.latest,
    financial_year: model.financialYear,
    fy_pence: model.fyPence,
    constraints_share: model.constraintsShare,
    tariff_gbp_per_mwh: model.tariff?.gbpPerMwh ?? null,
    household_pence: model.householdPence,
    days: release.days,
    trade_months: release.trade_months,
    sources: ["neso-open-data", "elexon-bmrs"],
  });
}
