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

export function greenestWindow(rows: CarbonForecastRow[], now: Date): GreenestWindow | null {
  const future = rows.filter((row) => {
    if (row.intensity.forecast == null) {
      return false;
    }
    return parseUtcDateTime(row.to).getTime() > now.getTime();
  });
  if (future.length === 0) {
    return null;
  }

  const size = Math.min(GREENEST_WINDOW_PERIODS, future.length);
  let bestStart = 0;
  let bestAverage = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= future.length - size; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < size; offset += 1) {
      sum += future[index + offset]?.intensity.forecast ?? 0;
    }
    const average = sum / size;
    if (average < bestAverage) {
      bestAverage = average;
      bestStart = index;
    }
  }

  const first = future[bestStart];
  const last = future[bestStart + size - 1];
  if (!first || !last) {
    return null;
  }

  const grams = Math.round(bestAverage);
  const windowLabel = formatLookAheadWindow(
    parseUtcDateTime(first.from),
    parseUtcDateTime(last.to),
    now
  );
  return {
    startUtc: first.from,
    endUtc: last.to,
    grams,
    sentence: `Cleanest time to use power in the next 48 hours: ${windowLabel} (≈${grams} g).`,
  };
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
  const startClock = clock(start);
  const endClock = clock(end);
  const zone = getLondonOffsetLabel(start);
  const times = `${startClock}–${endClock} ${zone}`;
  const startDay = getLondonDate(start);
  const today = getLondonDate(now);
  if (startDay === today) {
    return times;
  }
  if (startDay === addUtcDays(today, 1)) {
    return `tomorrow ${times}`;
  }
  return `${formatLondonDateLabel(start)}, ${times}`;
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
