import { getLondonDate, getLondonDateTimeParts, parseUtcDateTime } from "@/lib/london-time";
import { isValidDashboardDate } from "@/lib/dashboard-search-params";

export const TINYBIRD_CACHE_SECONDS = {
  live: 300,
  health: 900,
  long: 1_800,
  longYear: 3_600,
  historical: 86_400,
} as const;

export const TINYBIRD_LIMIT_RETRY_AFTER_SECONDS = 300;

const LATEST_PIPES = new Set(["latest_snapshot", "latest_generation", "latest_prices"]);

export type TinybirdCacheTier = "historical" | "live" | "long" | "health";

export type TinybirdCachePurpose = "dashboard" | "health";

export type KnownQueryRange = "24h" | "7d" | "30d" | "90d" | "1y";

export type TinybirdCachePolicy = {
  tier: TinybirdCacheTier;
  revalidateSeconds: number;
  sMaxAge: number;
  staleWhileRevalidate: number;
};

export type TinybirdCacheInput = {
  pipeName: string;
  range?: string | null;
  date?: string | null;
  params?: Record<string, string>;
  now?: Date;
  purpose?: TinybirdCachePurpose;
};

export class TinybirdLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = TINYBIRD_LIMIT_RETRY_AFTER_SECONDS) {
    super(message);
    this.name = "TinybirdLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const lastGoodByKey = new Map<string, unknown[]>();

export function getTinybirdLastGood<T>(key: string): T[] | undefined {
  return lastGoodByKey.get(key) as T[] | undefined;
}

export function setTinybirdLastGood<T>(key: string, data: T[]): void {
  lastGoodByKey.set(key, data);
}

export function clearTinybirdLastGood(): void {
  lastGoodByKey.clear();
}

export function serializePipeParams(params?: Record<string, string>): string {
  if (!params) {
    return "";
  }

  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function deserializePipeParams(paramsKey: string): Record<string, string> | undefined {
  if (paramsKey === "") {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (const pair of paramsKey.split("&")) {
    const eq = pair.indexOf("=");
    params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return params;
}

export function dateForTinybirdCacheKey(
  range: string | null | undefined,
  date: string | null | undefined
): string {
  if (!date || (range && range !== "24h")) {
    return "";
  }

  return date;
}

export function tinybirdLogicalCacheKey(input: {
  pipeName: string;
  range?: string | null;
  date?: string | null;
  params?: Record<string, string>;
  revalidateSeconds: number;
}): string {
  const extras = ["granularity", "commodity"]
    .filter((key) => input.params?.[key])
    .map((key) => `${key}=${input.params?.[key]}`)
    .join("&");
  const date = dateForTinybirdCacheKey(input.range, input.date);

  return `tb:${input.pipeName}:${input.range ?? ""}:${date}:${extras}:ttl=${input.revalidateSeconds}`;
}

export function tinybirdCacheControl(policy: TinybirdCachePolicy): string {
  return `public, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`;
}

export function isTinybirdLimitError(status: number, body: string): boolean {
  if (status === 429) {
    return true;
  }

  const lower = body.toLowerCase();
  return (
    lower.includes("daily request limit exceeded") ||
    lower.includes("organization daily request limit")
  );
}

export function resolveTinybirdPipeFailure<T>(
  status: number,
  body: string,
  lastGood: T[] | undefined,
  retryAfterSeconds = TINYBIRD_LIMIT_RETRY_AFTER_SECONDS
): T[] {
  if (!isTinybirdLimitError(status, body)) {
    throw new Error(`Tinybird query error (${status}): ${body}`);
  }

  if (lastGood) {
    return lastGood;
  }

  throw new TinybirdLimitError(`Tinybird query error (${status}): ${body}`, retryAfterSeconds);
}

export function getTinybirdCachePolicy(input: TinybirdCacheInput): TinybirdCachePolicy {
  const now = input.now ?? new Date();
  const purposePolicy = policyForPurpose(input.purpose);
  if (purposePolicy) {
    return purposePolicy;
  }

  if (LATEST_PIPES.has(input.pipeName)) {
    return livePolicy();
  }

  if (isHistoricalQuery(input, now)) {
    return historicalPolicy();
  }

  const range = asKnownRange(input.range);
  if (range) {
    return policyForRange(range);
  }

  if (input.params && (input.params.granularity === "day" || isDateOnlyWindow(input.params))) {
    return longPolicy(longSecondsForParams(input.params));
  }

  return livePolicy();
}

function policyForPurpose(purpose: TinybirdCachePurpose | undefined): TinybirdCachePolicy | null {
  if (purpose == null || purpose === "dashboard") {
    return null;
  }

  switch (purpose) {
    case "health":
      return healthPolicy();
    default: {
      const exhaustive: never = purpose;
      return exhaustive;
    }
  }
}

function policyForRange(range: KnownQueryRange): TinybirdCachePolicy {
  switch (range) {
    case "24h":
    case "7d":
      return livePolicy();
    case "30d":
      return longPolicy(TINYBIRD_CACHE_SECONDS.long);
    case "90d":
    case "1y":
      return longPolicy(TINYBIRD_CACHE_SECONDS.longYear);
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

function asKnownRange(range: string | null | undefined): KnownQueryRange | null {
  switch (range) {
    case "24h":
    case "7d":
    case "30d":
    case "90d":
    case "1y":
      return range;
    default:
      return null;
  }
}

function livePolicy(): TinybirdCachePolicy {
  return {
    tier: "live",
    revalidateSeconds: TINYBIRD_CACHE_SECONDS.live,
    sMaxAge: TINYBIRD_CACHE_SECONDS.live,
    staleWhileRevalidate: 3_600,
  };
}

function healthPolicy(): TinybirdCachePolicy {
  return {
    tier: "health",
    revalidateSeconds: TINYBIRD_CACHE_SECONDS.health,
    sMaxAge: TINYBIRD_CACHE_SECONDS.health,
    staleWhileRevalidate: 86_400,
  };
}

function longPolicy(seconds: number): TinybirdCachePolicy {
  return {
    tier: "long",
    revalidateSeconds: seconds,
    sMaxAge: seconds,
    staleWhileRevalidate: 86_400,
  };
}

function historicalPolicy(): TinybirdCachePolicy {
  return {
    tier: "historical",
    revalidateSeconds: TINYBIRD_CACHE_SECONDS.historical,
    sMaxAge: TINYBIRD_CACHE_SECONDS.historical,
    staleWhileRevalidate: 604_800,
  };
}

function isHistoricalQuery(input: TinybirdCacheInput, now: Date): boolean {
  const date = input.date;
  if (date && isValidDashboardDate(date)) {
    return date < getLondonDate(now) && (!input.range || input.range === "24h");
  }

  return isCompletedCalendarWindow(input.params, now);
}

function isCompletedCalendarWindow(
  params: Record<string, string> | undefined,
  now: Date
): boolean {
  if (!params?.start || !params?.end || params.granularity) {
    return false;
  }

  if (!/:59:59$/.test(params.end)) {
    return false;
  }

  const start = parseUtcDateTime(params.start);
  const end = parseUtcDateTime(params.end);
  if (end.getTime() >= now.getTime()) {
    return false;
  }

  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  if (hours < 20 || hours > 26) {
    return false;
  }

  const londonStart = getLondonDateTimeParts(start);
  return londonStart.hour === 0 && londonStart.minute === 0 && londonStart.second === 0;
}

function isDateOnlyWindow(params: Record<string, string>): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(params.end ?? "");
}

function longSecondsForParams(params: Record<string, string>): number {
  if (!params.start || !params.end) {
    return TINYBIRD_CACHE_SECONDS.long;
  }

  const start = parseUtcDateTime(params.start);
  const end = parseUtcDateTime(params.end);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return days >= 60 ? TINYBIRD_CACHE_SECONDS.longYear : TINYBIRD_CACHE_SECONDS.long;
}
