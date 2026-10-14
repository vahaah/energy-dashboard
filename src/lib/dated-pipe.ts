import {
  getGenerationQueryParams,
  getInterconnectorQueryParams,
  getPricesQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";
import { isValidDashboardDate } from "@/lib/dashboard-search-params";
import { getLondonDate } from "@/lib/london-time";
import { getRedis, peekThroughCache, redisKeyFor, redisTtlSeconds } from "@/lib/redis-cache";
import { reserveTinybirdOp } from "@/lib/tinybird-ops";
import {
  getTinybirdCachePolicy,
  historicalCachePolicy,
  tinybirdLogicalCacheKey,
} from "@/lib/tinybird-cache";
import type { CommodityRange, TinybirdTimeRange } from "@/lib/types";
import { londonDayInsideWarmWindow, sliceLondonDay } from "@/lib/warm-window";

const GRID_RANGES = ["24h", "7d", "30d", "90d", "1y"] as const satisfies readonly TinybirdTimeRange[];
const PRICE_RANGES = ["30d", "90d", "1y"] as const satisfies readonly CommodityRange[];

type DatedPipe =
  | "snapshots_range"
  | "generation_5min_range"
  | "interconnector_flows"
  | "prices_range";

export function isPastLondonDay(date: string, now: Date): boolean {
  return isValidDashboardDate(date) && date < getLondonDate(now);
}

function isDatedPipe(pipeName: string): pipeName is DatedPipe {
  switch (pipeName) {
    case "snapshots_range":
    case "generation_5min_range":
    case "interconnector_flows":
    case "prices_range":
      return true;
    default:
      return false;
  }
}

function warmedRanges(pipeName: DatedPipe): readonly TinybirdTimeRange[] {
  switch (pipeName) {
    case "snapshots_range":
    case "generation_5min_range":
      return GRID_RANGES;
    case "interconnector_flows":
      return ["24h", "7d"];
    case "prices_range":
      return PRICE_RANGES;
    default: {
      const exhaustive: never = pipeName;
      return exhaustive;
    }
  }
}

function warmedParams(
  pipeName: DatedPipe,
  range: TinybirdTimeRange,
  now: Date
): Record<string, string> {
  switch (pipeName) {
    case "snapshots_range":
      return getSnapshotsQueryParams(range, now);
    case "generation_5min_range":
      return getGenerationQueryParams(range, now);
    case "interconnector_flows":
      return getInterconnectorQueryParams(range === "24h" ? "24h" : "7d", now);
    case "prices_range":
      return getPricesQueryParams(priceRange(range), now);
    default: {
      const exhaustive: never = pipeName;
      return exhaustive;
    }
  }
}

function priceRange(range: TinybirdTimeRange): CommodityRange {
  switch (range) {
    case "30d":
    case "90d":
    case "1y":
      return range;
    case "24h":
    case "7d":
      return "30d";
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

function boundedParams(pipeName: string, date: string, now: Date): Record<string, string> {
  if (!isDatedPipe(pipeName)) {
    return getSnapshotsQueryParams("24h", now, date);
  }
  switch (pipeName) {
    case "snapshots_range":
      return getSnapshotsQueryParams("24h", now, date);
    case "generation_5min_range":
      return getGenerationQueryParams("24h", now, date);
    case "interconnector_flows":
      return getInterconnectorQueryParams("24h", now, date);
    case "prices_range":
      return { start: date, end: date };
    default: {
      const exhaustive: never = pipeName;
      return exhaustive;
    }
  }
}

function sliceDay<T>(rows: T[], date: string, now: Date): T[] {
  const first = rows[0];
  if (first && typeof first === "object" && "timestamp" in first) {
    return sliceLondonDay(rows as Array<T & { timestamp: string }>, date, now);
  }
  return rows.filter((row) => {
    if (!row || typeof row !== "object" || !("date" in row)) {
      return false;
    }
    const value = (row as { date: unknown }).date;
    return typeof value === "string" && value.slice(0, 10) === date;
  });
}

async function peekWarmedRange<T>(
  pipeName: DatedPipe,
  range: TinybirdTimeRange,
  now: Date
): Promise<T[] | null> {
  const params = warmedParams(pipeName, range, now);
  const policy = getTinybirdCachePolicy({ pipeName, params, range, now });
  const logicalKey = tinybirdLogicalCacheKey({
    pipeName,
    range,
    date: "",
    params,
    revalidateSeconds: policy.revalidateSeconds,
  });
  return peekThroughCache<T[]>(logicalKey, policy);
}

function historicalKey(pipeName: string, date: string): string {
  return `tb:hist-day:${pipeName}:${date}`;
}

/**
 * A past London day is sliced from the narrowest warmed envelope that contains
 * it. A day outside every warmed window, or a window whose envelope is missing,
 * is one civil-day pipe read, counted on the daily budget and kept for the
 * historical TTL.
 */
export async function readDatedPipe<T>(
  pipeName: string,
  date: string,
  now: Date,
  fetchRows: (params: Record<string, string>) => Promise<T[]>
): Promise<T[]> {
  if (isDatedPipe(pipeName)) {
    for (const range of warmedRanges(pipeName)) {
      if (!londonDayInsideWarmWindow(date, range, now)) {
        continue;
      }
      const rows = await peekWarmedRange<T>(pipeName, range, now);
      if (rows) {
        return sliceDay(rows, date, now);
      }
    }
  }

  const policy = historicalCachePolicy();
  const logicalKey = historicalKey(pipeName, date);
  const cached = await peekThroughCache<T[]>(logicalKey, policy);
  if (cached) {
    return cached;
  }

  await reserveTinybirdOp(now);
  const rows = await fetchRows(boundedParams(pipeName, date, now));
  const redis = getRedis();
  if (redis) {
    const key = await redisKeyFor(logicalKey, policy.tier);
    await redis.set(
      key,
      { data: rows, cachedAt: Date.now(), freshFor: policy.revalidateSeconds },
      { ex: redisTtlSeconds(policy) }
    );
  }
  return rows;
}
