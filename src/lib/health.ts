import { parseUtcDateTime } from "@/lib/london-time";

export const STALE_AFTER_MS = {
  snapshots: 2.5 * 60 * 60 * 1000,
  generation: 20 * 60 * 1000,
  embedded: 90 * 60 * 1000,
  prices: 4 * 24 * 60 * 60 * 1000,
} as const;

export type StreamFreshness = {
  stream: string;
  latest: string | null;
  ageMs: number | null;
  staleAfterMs: number;
  stale: boolean;
  critical: boolean;
};

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

export function healthHttpStatus(streams: StreamFreshness[]): number {
  return streams.some((stream) => stream.critical && stream.stale) ? 503 : 200;
}
