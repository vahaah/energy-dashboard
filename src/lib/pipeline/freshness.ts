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
 * Publication day is catalogue `published_at`, the day DESNZ published the extract.
 * For the Q2 2026 edition that is 3 Aug 2026. Record Last Updated is a different date
 * and is not this clock.
 */
export function pipelinePublicationDay(edition: { published_at: string; edition_day: string }): string {
  const published = edition.published_at.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(published) || published !== edition.edition_day) {
    throw new Error("pipeline edition day is the publication date");
  }
  return published;
}

/**
 * Not updated once 120 days have passed since the publication date.
 * 3 Aug 2026 is flagged from 1 Dec 2026.
 */
export function pipelineEditionStale(editionDay: string, now: Date): boolean {
  const limit = addUtcDays(editionDay, PIPELINE_STALE_DAYS);
  if (limit === null) {
    return true;
  }
  const today = now.toISOString().slice(0, 10);
  return today >= limit;
}
