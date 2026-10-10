import { parseUtcDateTime } from "@/lib/london-time";

export function chartTimeMs(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return parseUtcDateTime(value).getTime();
}

export function chartTimeDomain(times: Array<string | number>): [number, number] | null {
  if (times.length === 0) {
    return null;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const time of times) {
    const ms = chartTimeMs(time);
    if (ms < min) {
      min = ms;
    }
    if (ms > max) {
      max = ms;
    }
  }
  return [min, max];
}

export function evenTimeTicks(minMs: number, maxMs: number, count: number): number[] {
  if (maxMs <= minMs) {
    return [minMs];
  }

  const safeCount = Math.max(2, count);
  const step = (maxMs - minMs) / (safeCount - 1);
  const ticks: number[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    ticks.push(minMs + step * index);
  }
  return ticks;
}

export function timeTickCount(spanMs: number, compact: boolean): number {
  if (compact) {
    return 3;
  }
  if (spanMs <= 36 * 60 * 60 * 1000) {
    return 5;
  }
  if (spanMs <= 8 * 24 * 60 * 60 * 1000) {
    return 6;
  }
  return 7;
}

export function firstDefinedSeriesMs<T extends { time: string; ts?: number }>(
  points: T[],
  value: (point: T) => number | null | undefined
): number | null {
  for (const point of points) {
    if (value(point) != null) {
      return point.ts ?? chartTimeMs(point.time);
    }
  }
  return null;
}
