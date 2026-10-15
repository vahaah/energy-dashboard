import { addUtcDays, getLondonDateTimeParts, londonDateTimeToUtc } from "@/lib/london-time";

export type GasDay = {
  label: string;
  start: string;
  end: string;
};

const WALL_TIME = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/;

/** Gas day `label` is [05:00 Europe/London, next 05:00). Clock-change days are 23h or 25h. */
export function gasDayFromLabel(label: string): GasDay {
  const start = londonWall(label, 5, 0, 0);
  const end = londonWall(addUtcDays(label, 1), 5, 0, 0);
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

export function parseLondonWallTime(value: string): Date | null {
  const match = WALL_TIME.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  const second = Number(match[6] ?? "0");
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return londonDateTimeToUtc(year, month, day, hour, minute, second);
}

/** `DD/MM/YYYY` gas-day label, ignoring a trailing clock. */
export function gasDayLabelFromWall(value: string): string | null {
  const match = WALL_TIME.exec(value.trim());
  if (!match?.[3] || !match[2] || !match[1]) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function londonWall(label: string, hour: number, minute: number, second: number): Date {
  const [year, month, day] = label.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`gas day label ${label} is not YYYY-MM-DD`);
  }
  return londonDateTimeToUtc(year, month, day, hour, minute, second);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
