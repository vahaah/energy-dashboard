import {
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  elexonBmrsAttributionBlock,
} from "@/lib/attribution";
import { formatHeadlineGw } from "@/lib/facts";
import {
  addUtcDays,
  formatLondonClock,
  formatLondonDateLabel,
  formatTinybirdDateTime,
  getLondonDate,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  londonDateTimeToUtc,
  londonMidnightUtc,
  parseUtcDateTime,
} from "@/lib/london-time";
import type { CarbonIntensityResponse, TimeRange } from "@/lib/types";

export const GREENEST_WINDOW_PERIODS = 4;
export const WIND_FORECAST_BASIS =
  "Transmission-connected wind only. Embedded wind is not in this forecast.";

export type ForecastPoint = {
  time: string;
  value: number;
};

export type GreenestWindow = {
  startUtc: string;
  endUtc: string;
  grams: number;
  sentence: string;
};

export type WindLookAhead = {
  tonightGw: number | null;
  tomorrowEveningGw: number | null;
  sparkline: number[];
  sentence: string;
  basis: typeof WIND_FORECAST_BASIS;
};

export type LookAheadView = {
  fetchedAt: string;
  greenest: GreenestWindow | null;
  carbonSeries: ForecastPoint[];
  wind: WindLookAhead | null;
  demandSeries: ForecastPoint[];
};

export type PublicLookAhead = {
  fetchedAt: string;
  greenestWindow: GreenestWindow | null;
  wind: {
    tonightGw: number | null;
    tomorrowEveningGw: number | null;
    sentence: string;
    basis: typeof WIND_FORECAST_BASIS;
  } | null;
  attribution: {
    carbon: string;
    carbonNote: string;
    elexon: ReturnType<typeof elexonBmrsAttributionBlock>;
  };
};

export type WindForecastRow = {
  startTime: string;
  generation: number | null;
};

export type DemandForecastRow = {
  startTime: string;
  nationalDemand: number | null;
  boundary: string | null;
};

export type CarbonForecastRow = CarbonIntensityResponse["data"][number];

export type CachedForecastRows = {
  fetchedAt: string;
  carbonRows: CarbonForecastRow[] | null;
  windRows: WindForecastRow[] | null;
  demandRows: DemandForecastRow[] | null;
};

export function lookAheadFromRows(rows: CachedForecastRows, now: Date): LookAheadView {
  return {
    fetchedAt: rows.fetchedAt,
    greenest: rows.carbonRows ? greenestWindow(rows.carbonRows, now) : null,
    carbonSeries: rows.carbonRows ? carbonForecastPoints(rows.carbonRows, now) : [],
    wind: rows.windRows ? windLookAhead(rows.windRows, now) : null,
    demandSeries: rows.demandRows ? demandForecastPoints(rows.demandRows, now) : [],
  };
}

export function emptyLookAhead(now = new Date()): LookAheadView {
  return {
    fetchedAt: now.toISOString(),
    greenest: null,
    carbonSeries: [],
    wind: null,
    demandSeries: [],
  };
}

export function publicLookAhead(view: LookAheadView): PublicLookAhead {
  return {
    fetchedAt: view.fetchedAt,
    greenestWindow: view.greenest,
    wind: view.wind
      ? {
          tonightGw: view.wind.tonightGw,
          tomorrowEveningGw: view.wind.tomorrowEveningGw,
          sentence: view.wind.sentence,
          basis: view.wind.basis,
        }
      : null,
    attribution: {
      carbon: CARBON_INTENSITY_ATTRIBUTION,
      carbonNote: CARBON_INTENSITY_FORECAST_NOTE,
      elexon: elexonBmrsAttributionBlock(),
    },
  };
}

export function formatGridFetchedAt(fetchedAt: string): string {
  return `Grid fetched ${formatLondonClock(parseUtcDateTime(fetchedAt))}`;
}

export function showsDemandForecast(range: TimeRange, historical: boolean): boolean {
  if (historical) {
    return false;
  }

  switch (range) {
    case "24h":
    case "7d":
      return true;
    case "30d":
    case "90d":
    case "1y":
    case "all":
      return false;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function showsCarbonForecast(range: TimeRange, historical: boolean): boolean {
  return showsDemandForecast(range, historical);
}

export function showsLookAheadCopy(facts: {
  isHistorical: boolean;
  empty: boolean;
}): boolean {
  return !facts.isHistorical && !facts.empty;
}

export function greenestWindow(rows: CarbonForecastRow[], now: Date): GreenestWindow | null {
  const future = rows.filter((row) => {
    if (row.intensity.forecast == null) {
      return false;
    }
    return parseUtcDateTime(row.from).getTime() >= now.getTime();
  });
  if (future.length < GREENEST_WINDOW_PERIODS) {
    return null;
  }

  let best: { first: CarbonForecastRow; last: CarbonForecastRow; average: number } | null = null;
  for (const run of contiguousForecastRuns(future)) {
    if (run.length < GREENEST_WINDOW_PERIODS) {
      continue;
    }
    for (let index = 0; index <= run.length - GREENEST_WINDOW_PERIODS; index += 1) {
      let sum = 0;
      for (let offset = 0; offset < GREENEST_WINDOW_PERIODS; offset += 1) {
        sum += run[index + offset]?.intensity.forecast ?? 0;
      }
      const average = sum / GREENEST_WINDOW_PERIODS;
      if (best == null || average < best.average) {
        const first = run[index];
        const last = run[index + GREENEST_WINDOW_PERIODS - 1];
        if (first && last) {
          best = { first, last, average };
        }
      }
    }
  }

  if (!best) {
    return null;
  }

  const grams = Math.round(best.average);
  const windowLabel = formatLookAheadWindow(
    parseUtcDateTime(best.first.from),
    parseUtcDateTime(best.last.to),
    now
  );
  return {
    startUtc: best.first.from,
    endUtc: best.last.to,
    grams,
    sentence: `Cleanest time to use power in the next 48 hours: ${windowLabel} (≈${grams} g).`,
  };
}

function contiguousForecastRuns(rows: CarbonForecastRow[]): CarbonForecastRow[][] {
  const runs: CarbonForecastRow[][] = [];
  let current: CarbonForecastRow[] = [];
  for (const row of rows) {
    const previous = current.at(-1);
    if (previous && parseUtcDateTime(previous.to).getTime() !== parseUtcDateTime(row.from).getTime()) {
      runs.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length > 0) {
    runs.push(current);
  }
  return runs;
}

export function carbonForecastPoints(rows: CarbonForecastRow[], now: Date): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  for (const row of rows) {
    if (row.intensity.forecast == null) {
      continue;
    }
    if (parseUtcDateTime(row.to).getTime() <= now.getTime()) {
      continue;
    }
    points.push({
      time: formatTinybirdDateTime(parseUtcDateTime(row.from)),
      value: row.intensity.forecast,
    });
  }
  return points;
}

export function demandForecastPoints(rows: DemandForecastRow[], now: Date): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  for (const row of rows) {
    if (row.nationalDemand == null) {
      continue;
    }
    if (row.boundary != null && row.boundary !== "N") {
      continue;
    }
    if (parseUtcDateTime(row.startTime).getTime() < now.getTime()) {
      continue;
    }
    points.push({
      time: formatTinybirdDateTime(parseUtcDateTime(row.startTime)),
      value: row.nationalDemand,
    });
  }
  return points;
}

export function windLookAhead(rows: WindForecastRow[], now: Date): WindLookAhead | null {
  const future: ForecastPoint[] = [];
  for (const row of rows) {
    if (row.generation == null) {
      continue;
    }
    if (parseUtcDateTime(row.startTime).getTime() < now.getTime()) {
      continue;
    }
    future.push({
      time: formatTinybirdDateTime(parseUtcDateTime(row.startTime)),
      value: row.generation,
    });
  }
  if (future.length === 0) {
    return null;
  }

  const tonight = lastInWindow(future, tonightBounds(now));
  const tomorrowEvening = lastInWindow(future, tomorrowEveningBounds(now));
  const sentence = windSentence(tonight, tomorrowEvening);
  if (!sentence) {
    return null;
  }

  return {
    tonightGw: tonight,
    tomorrowEveningGw: tomorrowEvening,
    sparkline: future.map((point) => point.value / 1000),
    sentence,
    basis: WIND_FORECAST_BASIS,
  };
}

export function formatLookAheadWindow(start: Date, end: Date, now: Date): string {
  const startDay = getLondonDate(start);
  const endDay = getLondonDate(end);
  const today = getLondonDate(now);
  const times = formatWindowClocks(start, end);
  if (startDay === endDay) {
    return `${dayPrefix(startDay, today, start)}${times}`;
  }
  return `${dayPrefix(startDay, today, start)}${times} ${dayWord(endDay, today, end)}`;
}

function formatWindowClocks(start: Date, end: Date): string {
  const startZone = getLondonOffsetLabel(start);
  const endZone = getLondonOffsetLabel(end);
  return startZone === endZone
    ? `${clock(start)}–${clock(end)} ${startZone}`
    : `${clock(start)} ${startZone}–${clock(end)} ${endZone}`;
}

function dayPrefix(day: string, today: string, date: Date): string {
  if (day === today) {
    return "";
  }
  if (day === addUtcDays(today, 1)) {
    return "tomorrow ";
  }
  return `${formatLondonDateLabel(date)}, `;
}

function dayWord(day: string, today: string, date: Date): string {
  if (day === today) {
    return "today";
  }
  if (day === addUtcDays(today, 1)) {
    return "tomorrow";
  }
  return formatLondonDateLabel(date);
}

function windSentence(tonightGw: number | null, tomorrowEveningGw: number | null): string | null {
  if (tomorrowEveningGw != null && tonightGw != null) {
    const delta = tomorrowEveningGw - tonightGw;
    const tomorrow = formatHeadlineGw(tomorrowEveningGw * 1000);
    if (delta <= -0.5) {
      return `Wind is forecast to fall to ${tomorrow} GW by tomorrow evening.`;
    }
    if (delta >= 0.5) {
      return `Wind is forecast to rise to ${tomorrow} GW by tomorrow evening.`;
    }
    return `Wind is forecast to stay around ${tomorrow} GW tonight and tomorrow.`;
  }
  if (tomorrowEveningGw != null) {
    return `Wind is forecast at ${formatHeadlineGw(tomorrowEveningGw * 1000)} GW tomorrow evening.`;
  }
  if (tonightGw != null) {
    return `Wind is forecast at ${formatHeadlineGw(tonightGw * 1000)} GW tonight.`;
  }
  return null;
}

function lastInWindow(
  points: ForecastPoint[],
  bounds: { start: Date; end: Date } | null
): number | null {
  if (!bounds) {
    return null;
  }

  let last: number | null = null;
  for (const point of points) {
    const time = parseUtcDateTime(point.time).getTime();
    if (time >= bounds.start.getTime() && time < bounds.end.getTime()) {
      last = point.value / 1000;
    }
  }
  return last;
}

function tonightBounds(now: Date): { start: Date; end: Date } | null {
  const today = getLondonDate(now);
  const parts = getLondonDateTimeParts(now);
  const evening = londonDateTimeToUtc(parts.year, parts.month, parts.day, 18, 0, 0);
  const midnight = londonMidnightUtc(addUtcDays(today, 1));
  if (now.getTime() >= midnight.getTime()) {
    return null;
  }
  return {
    start: now.getTime() > evening.getTime() ? now : evening,
    end: midnight,
  };
}

function tomorrowEveningBounds(now: Date): { start: Date; end: Date } {
  const tomorrow = addUtcDays(getLondonDate(now), 1);
  const [year, month, day] = tomorrow.split("-").map(Number);
  return {
    start: londonDateTimeToUtc(year, month, day, 18, 0, 0),
    end: londonMidnightUtc(addUtcDays(tomorrow, 1)),
  };
}

function clock(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
