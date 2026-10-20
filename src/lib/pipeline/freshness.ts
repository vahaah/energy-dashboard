import { PIPELINE_STALE_DAYS } from "@/lib/pipeline/copy";

/** Calendar addition in UTC. Month and year overflow is left to Date. */
export function addUtcDays(day: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  if (Number.isNaN(shifted.getTime())) {
    return null;
  }
  return shifted.toISOString().slice(0, 10);
}

/**
 * Not updated once 120 days have passed since the edition day.
 * The edition day is the catalogue published_at date.
 */
export function pipelineEditionStale(editionDay: string, now: Date): boolean {
  const limit = addUtcDays(editionDay, PIPELINE_STALE_DAYS);
  if (limit === null) {
    return true;
  }
  const today = now.toISOString().slice(0, 10);
  return today >= limit;
}
