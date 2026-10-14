import { parseUtcDateTime } from "@/lib/london-time";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** /api/cron is hourly. Allow one missed run plus Vercel jitter. */
export const HOURLY_CRON_STALE_MS = 2.5 * HOUR_MS;

/** /api/cron-prices is every 6h; EIA also gaps over weekends. */
export const PRICE_CRON_STALE_MS = 4 * DAY_MS;

export const STALE_AFTER_MS = {
  snapshots: HOURLY_CRON_STALE_MS,
  generation: HOURLY_CRON_STALE_MS,
  embedded: HOURLY_CRON_STALE_MS,
  prices: PRICE_CRON_STALE_MS,
} as const;

export type StreamFreshness = {
  stream: string;
  latest: string | null;
  ageMs: number | null;
  staleAfterMs: number;
  stale: boolean;
  critical: boolean;
};

export function unprobedStream(stream: string, staleAfterMs: number): StreamFreshness {
  return {
    stream,
    latest: null,
    ageMs: null,
    staleAfterMs,
    stale: false,
    critical: false,
  };
}

export function streamFreshness(
  stream: string,
  latest: string | null | undefined,
  now: Date,
  staleAfterMs: number,
  critical: boolean
): StreamFreshness {
  if (!latest) {
    return {
      stream,
      latest: null,
      ageMs: null,
      staleAfterMs,
      stale: true,
      critical,
    };
  }

  const ageMs = now.getTime() - parseUtcDateTime(latest).getTime();
  return {
    stream,
    latest,
    ageMs,
    staleAfterMs,
    stale: ageMs > staleAfterMs,
    critical,
  };
}

/** Older of the two embedded feeds. A missing feed has no timestamp, so the caller flags it. */
export function olderEmbeddedTimestamp(wind: string | null, solar: string | null): string | null {
  if (!wind || !solar) {
    return null;
  }
  return parseUtcDateTime(wind).getTime() <= parseUtcDateTime(solar).getTime() ? wind : solar;
}

export function latestObservedTimestamp(
  values: Array<string | null | undefined>,
  now: Date
): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const ms = parseUtcDateTime(value).getTime();
    if (Number.isNaN(ms) || ms > now.getTime()) {
      continue;
    }

    if (ms > latestMs) {
      latest = value;
      latestMs = ms;
    }
  }

  return latest;
}

export function healthHttpStatus(streams: StreamFreshness[]): number {
  return streams.some((stream) => stream.critical && stream.stale) ? 503 : 200;
}
