const LONDON_TIME_ZONE = "Europe/London";

const londonDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const londonDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const londonOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatTinybirdDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getLondonDate(date: Date): string {
  return londonDateFormatter.format(date);
}

export function getLondonDateTimeParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = londonDateTimeFormatter.formatToParts(date);
  return {
    year: Number(partValue(parts, "year")),
    month: Number(partValue(parts, "month")),
    day: Number(partValue(parts, "day")),
    hour: Number(partValue(parts, "hour")),
    minute: Number(partValue(parts, "minute")),
    second: Number(partValue(parts, "second")),
  };
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const asUtc = Date.UTC(
    Number(partValue(parts, "year")),
    Number(partValue(parts, "month")) - 1,
    Number(partValue(parts, "day")),
    Number(partValue(parts, "hour")),
    Number(partValue(parts, "minute")),
    Number(partValue(parts, "second"))
  );

  return asUtc - date.getTime();
}

export function londonDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = new Date(utcGuess);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offsetMs = getTimeZoneOffsetMs(instant, LONDON_TIME_ZONE);
    const adjusted = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs);
    if (adjusted.getTime() === instant.getTime()) {
      return adjusted;
    }
    instant = adjusted;
  }

  return instant;
}

export function londonMidnightUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return londonDateTimeToUtc(year, month, day, 0, 0, 0);
}

export function yesterdayLondonDate(now: Date): string {
  return addUtcDays(getLondonDate(now), -1);
}

export function addUtcDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate(shifted);
}

export function getLondonOffsetLabel(date: Date): string {
  const parts = londonOffsetFormatter.formatToParts(date);
  const raw = partValue(parts, "timeZoneName");
  if (/^(?:GMT|UTC)(?:\+0)?$/.test(raw)) {
    return "GMT";
  }
  if (raw === "GMT+1" || raw === "UTC+1") {
    return "BST";
  }
  return raw || "UK";
}

export function formatLondonClock(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return `${hh}:${mm} ${getLondonOffsetLabel(date)}`;
}

const LONDON_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const londonWeekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  weekday: "short",
});

export function formatLondonDateLabel(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  return `${parts.day} ${LONDON_MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatLondonDayMonthYear(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${LONDON_MONTHS[month - 1]} ${year}`;
}

export function formatLondonDateTimeStamp(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  const weekday = partValue(londonWeekdayFormatter.formatToParts(date), "weekday");
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return `${weekday} ${parts.day} ${LONDON_MONTHS[parts.month - 1]} ${parts.year}, ${hh}:${mm} ${getLondonOffsetLabel(date)}`;
}

export function formatLondonCiteDate(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  const weekday = partValue(londonWeekdayFormatter.formatToParts(date), "weekday");
  return `${weekday} ${parts.day} ${LONDON_MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatLondonIsoOffset(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  const offsetMs = getTimeZoneOffsetMs(date, LONDON_TIME_ZONE);
  const sign = offsetMs >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMs);
  const offsetHours = String(Math.floor(absolute / 3_600_000)).padStart(2, "0");
  const offsetMinutes = String(Math.floor((absolute % 3_600_000) / 60_000)).padStart(2, "0");
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}${sign}${offsetHours}:${offsetMinutes}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseUtcDateTime(value: string): Date {
  if (value.endsWith("Z") || value.includes("+") || value.includes("T")) {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    return new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  }

  return new Date(`${value.replace(" ", "T")}Z`);
}
