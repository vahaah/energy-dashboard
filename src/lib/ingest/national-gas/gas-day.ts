import { addUtcDays, getLondonDateTimeParts, getTimeZoneOffsetMs, londonDateTimeToUtc } from "@/lib/london-time";

export type GasDay = {
  label: string;
  start: string;
  end: string;
};

const LONDON = "Europe/London";
const WALL_TIME =
  /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):(\d{2}))?)?$/;

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Minutes east of UTC when the portal string states one. */
  offsetMinutes: number | null;
};

/** Gas day `label` is [05:00 Europe/London, next 05:00). Clock-change days are 23h or 25h. */
export function gasDayFromLabel(label: string): GasDay {
  const bounds = gasDayBounds(label);
  if (!bounds) {
    throw new Error(`gas day label ${label} is not a real YYYY-MM-DD`);
  }
  return bounds;
}

/** Null when `label` is not a real calendar date. */
export function gasDayBounds(label: string): GasDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDate(year, month, day)) {
    return null;
  }
  const start = londonDateTimeToUtc(year, month, day, 5, 0, 0);
  const next = addUtcDays(label, 1);
  const nextMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(next);
  if (!nextMatch?.[1] || !nextMatch[2] || !nextMatch[3]) {
    return null;
  }
  const end = londonDateTimeToUtc(Number(nextMatch[1]), Number(nextMatch[2]), Number(nextMatch[3]), 5, 0, 0);
  if (!wallMatches(start, year, month, day, 5, 0, 0) || start.getTime() >= end.getTime()) {
    return null;
  }
  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/** Gas day containing `instant`. 05:00 belongs to the day that is starting. */
export function gasDayContaining(instant: Date): GasDay {
  const parts = getLondonDateTimeParts(instant);
  const calendar = isoDate(parts.year, parts.month, parts.day);
  const label = parts.hour < 5 ? addUtcDays(calendar, -1) : calendar;
  return gasDayFromLabel(label);
}

/**
 * One London wall time. An ambiguous fallback hour returns null; use
 * `resolveLondonWallSequence` so both occurrences survive.
 */
export function parseLondonWallTime(value: string): Date | null {
  const candidates = londonWallCandidates(value);
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

/**
 * Instants whose London wall clock is `value`. The fallback hour on a 25-hour
 * day returns both the BST and GMT occurrences. A stated offset returns one.
 * Impossible dates, the missing spring hour, and out-of-range h/m/s return none.
 */
export function londonWallCandidates(value: string): Date[] {
  const wall = readWall(value);
  if (!wall) {
    return [];
  }
  if (wall.offsetMinutes != null) {
    const instant = instantAtOffset(wall, wall.offsetMinutes);
    return accepts(instant, wall, wall.offsetMinutes) ? [instant] : [];
  }
  const found: Date[] = [];
  for (const offsetMinutes of [0, 60]) {
    const instant = instantAtOffset(wall, offsetMinutes);
    if (accepts(instant, wall, offsetMinutes)) {
      found.push(instant);
    }
  }
  return found;
}

/**
 * Resolve a column in file order. Unambiguous stamps stay, including duplicates.
 * The repeated fallback hour keeps both instants: a stated offset wins, otherwise
 * the choice that stays strictly monotonic with the surrounding rows. Portal
 * extracts are newest-first, so a descending assignment is preferred when both
 * directions fit.
 */
export function resolveLondonWallSequence(values: readonly string[]): (Date | null)[] {
  const output: (Date | null)[] = values.map(() => null);
  let start = 0;
  for (let index = 0; index <= values.length; index += 1) {
    const candidates = index < values.length ? londonWallCandidates(values[index] ?? "") : [];
    if (index < values.length && candidates.length > 0) {
      continue;
    }
    if (index > start) {
      resolveSegment(values.slice(start, index)).forEach((instant, offset) => {
        output[start + offset] = instant;
      });
    }
    start = index + 1;
  }
  return output;
}

/** `DD/MM/YYYY` gas-day label, ignoring a trailing clock. Impossible dates are null. */
export function gasDayLabelFromWall(value: string): string | null {
  const wall = readWall(value);
  if (!wall) {
    return null;
  }
  return isoDate(wall.year, wall.month, wall.day);
}

function readWall(value: string): WallClock | null {
  const match = WALL_TIME.exec(value.trim());
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hasTime = match[4] != null;
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  const second = Number(match[6] ?? "0");
  if (!isRealDate(year, month, day)) {
    return null;
  }
  if (hasTime && (hour > 23 || minute > 59 || second > 59)) {
    return null;
  }
  let offsetMinutes: number | null = null;
  if (value.trim().endsWith("Z")) {
    offsetMinutes = 0;
  } else if (match[7] && match[8] && match[9]) {
    const magnitude = Number(match[8]) * 60 + Number(match[9]);
    if (Number(match[8]) > 23 || Number(match[9]) > 59) {
      return null;
    }
    offsetMinutes = match[7] === "-" ? -magnitude : magnitude;
  }
  return { year, month, day, hour, minute, second, offsetMinutes };
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1) {
    return false;
  }
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function instantAtOffset(wall: WallClock, offsetMinutes: number): Date {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - offsetMinutes * 60_000);
}

function accepts(instant: Date, wall: WallClock, offsetMinutes: number): boolean {
  return wallMatches(instant, wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second) && londonOffsetMinutes(instant) === offsetMinutes;
}

function wallMatches(
  instant: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  const parts = getLondonDateTimeParts(instant);
  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === second
  );
}

function londonOffsetMinutes(instant: Date): number {
  return Math.round(getTimeZoneOffsetMs(instant, LONDON) / 60_000);
}

function resolveSegment(values: readonly string[]): (Date | null)[] {
  const sets = values.map((value) => londonWallCandidates(value));
  const fixed: (Date | null)[] = sets.map((set) => (set.length === 1 ? (set[0] ?? null) : null));
  const direction = sequenceDirection(fixed);
  if (direction !== 0) {
    fillAmbiguous(sets, fixed, direction);
    return fixed;
  }
  if (!sets.some((set) => set.length > 1)) {
    return fixed;
  }
  const descending = assignDirection(sets, -1);
  const ascending = assignDirection(sets, 1);
  if (descending && ascending && assignmentsDisagree(descending, ascending) && !repeatsWallClock(values)) {
    return fixed;
  }
  return descending ?? ascending ?? fixed;
}

function assignmentsDisagree(left: readonly Date[], right: readonly Date[]): boolean {
  return left.some((instant, index) => instant.getTime() !== right[index]?.getTime());
}

function repeatsWallClock(values: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const wall = readWall(value);
    if (!wall || londonWallCandidates(value).length < 2) {
      continue;
    }
    const key = `${wall.year}-${wall.month}-${wall.day}-${wall.hour}-${wall.minute}-${wall.second}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

function assignDirection(sets: readonly Date[][], direction: -1 | 1): Date[] | null {
  const chosen: Date[] = [];
  const walk = (index: number): boolean => {
    if (index === sets.length) {
      return true;
    }
    const set = sets[index] ?? [];
    const options = [...set].sort((left, right) => direction * (left.getTime() - right.getTime()));
    const previous = chosen[chosen.length - 1];
    for (const candidate of options) {
      const step = previous ? direction * (candidate.getTime() - previous.getTime()) : 1;
      if (set.length > 1 && step <= 0) {
        continue;
      }
      if (set.length === 1 && previous && step < 0) {
        return false;
      }
      chosen.push(candidate);
      if (walk(index + 1)) {
        return true;
      }
      chosen.pop();
    }
    return false;
  };
  return walk(0) ? chosen : null;
}

function sequenceDirection(chosen: readonly (Date | null)[]): -1 | 0 | 1 {
  let previous: Date | null = null;
  for (const instant of chosen) {
    if (!instant || !previous) {
      previous = instant ?? previous;
      continue;
    }
    const delta = instant.getTime() - previous.getTime();
    if (delta < 0) {
      return -1;
    }
    if (delta > 0) {
      return 1;
    }
    previous = instant;
  }
  return 0;
}

function fillAmbiguous(sets: readonly Date[][], chosen: (Date | null)[], direction: -1 | 1): void {
  for (let guard = 0; guard < sets.length; guard += 1) {
    let progressed = false;
    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index];
      if (!set || chosen[index] || set.length < 2) {
        continue;
      }
      const pick = pickBetween(set, nearest(chosen, index, -1), nearest(chosen, index, 1), direction);
      if (!pick) {
        continue;
      }
      chosen[index] = pick;
      progressed = true;
    }
    if (!progressed) {
      return;
    }
  }
}

function pickBetween(candidates: readonly Date[], previous: Date | null, next: Date | null, direction: -1 | 1): Date | null {
  let pool = candidates.filter((candidate) => {
    if (previous && direction * (candidate.getTime() - previous.getTime()) <= 0) {
      return false;
    }
    if (next && direction * (next.getTime() - candidate.getTime()) <= 0) {
      return false;
    }
    return true;
  });
  if (pool.length === 0) {
    return null;
  }
  if (pool.length === 1) {
    return pool[0] ?? null;
  }
  const anchor = previous ?? next;
  if (!anchor) {
    return null;
  }
  pool = [...pool].sort((left, right) => Math.abs(left.getTime() - anchor.getTime()) - Math.abs(right.getTime() - anchor.getTime()));
  return pool[0] ?? null;
}

function nearest(chosen: readonly (Date | null)[], index: number, step: -1 | 1): Date | null {
  for (let cursor = index + step; cursor >= 0 && cursor < chosen.length; cursor += step) {
    const instant = chosen[cursor];
    if (instant) {
      return instant;
    }
  }
  return null;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
