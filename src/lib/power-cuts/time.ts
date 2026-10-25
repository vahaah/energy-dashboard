import { londonDateTimeToUtc } from "@/lib/london-time";

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/;
const NIE_TIME =
  /^(\d{1,2}):(\d{2})\s*(AM|PM),\s*(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?$/i;

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** ODS and CSV timestamps. A zone-less value is UTC. Years before 2000 are dropped. */
export function parseUtcTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  let text = trimmed.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (NAIVE.test(text)) {
    const fraction = text.split(".")[1];
    text = fraction == null ? `${text}.000Z` : `${text.replace(/\.(\d{1,9})$/, (_, digits: string) => `.${digits.padEnd(3, "0").slice(0, 3)}`)}Z`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2000) {
    return null;
  }
  return parsed.toISOString();
}

function londonYear(now: Date): number {
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(now);
  return Number(year);
}

/**
 * NIE display strings. "1:32 PM, 24 Oct" takes the year from `now` in London,
 * and rolls back a year when that instant is more than two days ahead.
 * "Not available - Update to follow" is null.
 */
export function parseNieTimestamp(value: unknown, now: Date): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || /not available/i.test(trimmed)) {
    return null;
  }
  const match = NIE_TIME.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = (match[3] ?? "").toUpperCase();
  const day = Number(match[4]);
  const month = MONTHS[(match[5] ?? "").slice(0, 3).toLowerCase()];
  const statedYear = match[6] ? Number(match[6]) : null;
  if (!month || hour12 < 1 || hour12 > 12 || minute > 59 || day < 1 || day > 31) {
    return null;
  }
  let hour = hour12 % 12;
  if (ampm === "PM") {
    hour += 12;
  }
  const year = statedYear ?? londonYear(now);
  const instant = londonDateTimeToUtc(year, month, day, hour, minute, 0);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  if (statedYear == null && instant.getTime() - now.getTime() > 2 * 24 * 60 * 60 * 1000) {
    return londonDateTimeToUtc(year - 1, month, day, hour, minute, 0).toISOString();
  }
  return instant.toISOString();
}
