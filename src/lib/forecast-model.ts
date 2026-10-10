import {
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  elexonBmrsAttributionBlock,
  NESO_EMBEDDED_FORECAST_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
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
import { settlementPeriodToUtc } from "@/lib/settlement-period";
import {
  DEMAND_FORECAST_EMBEDDED_BASIS,
  DEMAND_FORECAST_TRANSMISSION_BASIS,
  WIND_FORECAST_BASIS,
  type CachedForecastRows,
  type CarbonForecastRow,
  type DemandForecastBasis,
  type DemandForecastRow,
  type EmbeddedForecastRow,
  type ForecastPoint,
  type GreenestWindow,
  type LookAheadView,
  type PublicLookAhead,
  type TimeRange,
  type WindForecastRow,
  type WindLookAhead,
} from "@/lib/types";

export const GREENEST_WINDOW_PERIODS = 4;
export { DEMAND_FORECAST_EMBEDDED_BASIS, DEMAND_FORECAST_TRANSMISSION_BASIS, WIND_FORECAST_BASIS };
export type {
  CachedForecastRows,
  CarbonForecastRow,
  DemandForecastBasis,
  DemandForecastRow,
  EmbeddedForecastRow,
  ForecastPoint,
  GreenestWindow,
  LookAheadView,
  PublicLookAhead,
  WindForecastRow,
  WindLookAhead,
};

const SETTLEMENT_PERIOD_MS = 30 * 60 * 1000;

export function lookAheadFromRows(rows: CachedForecastRows, now: Date): LookAheadView {
  const embeddedRows = rows.embeddedRows ?? [];
  const liftEmbedded =
    rows.demandRows != null &&
    hasCompleteOverlappingEmbedded(rows.demandRows, embeddedRows, now);
  return {
    fetchedAt: rows.fetchedAt,
    greenest: rows.carbonRows ? greenestWindow(rows.carbonRows, now) : null,
    carbonSeries: rows.carbonRows ? carbonForecastPoints(rows.carbonRows, now) : [],
    wind: rows.windRows ? windLookAhead(rows.windRows, now) : null,
    demandSeries: rows.demandRows
      ? demandForecastPoints(rows.demandRows, now, liftEmbedded ? embeddedRows : [])
      : [],
    demandBasis: rows.demandRows
      ? liftEmbedded
        ? DEMAND_FORECAST_EMBEDDED_BASIS
        : DEMAND_FORECAST_TRANSMISSION_BASIS
      : null,
  };
}

export function emptyLookAhead(now = new Date()): LookAheadView {
  return {
    fetchedAt: now.toISOString(),
    greenest: null,
    carbonSeries: [],
    wind: null,
    demandSeries: [],
    demandBasis: null,
  };
}

export function lookAheadFromPublic(view: PublicLookAhead | null): LookAheadView | null {
  if (!view) {
    return null;
  }

  return {
    fetchedAt: view.fetchedAt,
    greenest: view.greenestWindow,
    carbonSeries: [],
    wind: view.wind
      ? {
          tonightGw: view.wind.tonightGw,
          tomorrowEveningGw: view.wind.tomorrowEveningGw,
          sparkline: [],
          sentence: view.wind.sentence,
          basis: view.wind.basis,
        }
      : null,
    demandSeries: [],
    demandBasis: view.demandBasis,
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
    demandBasis: view.demandBasis,
    attribution: {
      carbon: CARBON_INTENSITY_ATTRIBUTION,
      carbonNote: CARBON_INTENSITY_FORECAST_NOTE,
      elexon: elexonBmrsAttributionBlock(),
      nesoEmbedded: {
        text: NESO_OPEN_DATA_ATTRIBUTION,
        licence: NESO_OPEN_DATA_LICENCE_URL,
        dataset: NESO_EMBEDDED_FORECAST_URL,
      },
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

export function demandForecastPoints(
  rows: DemandForecastRow[],
  now: Date,
  embeddedRows: EmbeddedForecastRow[] = []
): ForecastPoint[] {
  const embeddedByEnd = embeddedForecastByTime(embeddedRows);
  const points: ForecastPoint[] = [];
  for (const row of futureNationalDemand(rows, now)) {
    const start = parseUtcDateTime(row.startTime);
    const embeddedMw = embeddedByEnd.get(formatTinybirdDateTime(demandPeriodEnd(start)));
    points.push({
      time: formatTinybirdDateTime(start),
      value: embeddedMw == null ? row.nationalDemand : row.nationalDemand + embeddedMw,
    });
  }
  return points;
}

export function hasCompleteOverlappingEmbedded(
  demandRows: DemandForecastRow[],
  embeddedRows: EmbeddedForecastRow[],
  now: Date
): boolean {
  const future = futureNationalDemand(demandRows, now);
  if (future.length === 0) {
    return false;
  }
  const embeddedByEnd = embeddedForecastByTime(embeddedRows);
  for (const row of future) {
    const endKey = formatTinybirdDateTime(demandPeriodEnd(parseUtcDateTime(row.startTime)));
    if (!embeddedByEnd.has(endKey)) {
      return false;
    }
  }
  return true;
}

export function embeddedForecastByTime(rows: EmbeddedForecastRow[]): Map<string, number> {
  const byTime = new Map<string, number>();
  for (const row of rows) {
    if (row.embeddedWindMw == null || row.embeddedSolarMw == null) {
      continue;
    }
    byTime.set(embeddedPeriodEndKey(row), row.embeddedWindMw + row.embeddedSolarMw);
  }
  return byTime;
}

export function parseEmbeddedForecastRows(
  records: Array<Record<string, unknown>>
): EmbeddedForecastRow[] {
  const rows: EmbeddedForecastRow[] = [];
  for (const record of records) {
    const settlementDate = String(record.SETTLEMENT_DATE ?? "").slice(0, 10);
    const settlementPeriod = Number(record.SETTLEMENT_PERIOD);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(settlementDate) || !Number.isFinite(settlementPeriod)) {
      continue;
    }
    if (settlementPeriod < 1) {
      continue;
    }
    const periodEnd =
      parseGmtPeriodEnd(record.DATE_GMT, record.TIME_GMT) ??
      demandPeriodEnd(settlementPeriodToUtc(settlementDate, settlementPeriod));
    rows.push({
      settlementDate,
      settlementPeriod,
      periodEndUtc: formatTinybirdDateTime(periodEnd),
      embeddedWindMw: finiteOrNull(record.EMBEDDED_WIND_FORECAST),
      embeddedSolarMw: finiteOrNull(record.EMBEDDED_SOLAR_FORECAST),
    });
  }
  return rows;
}

function futureNationalDemand(
  rows: DemandForecastRow[],
  now: Date
): Array<DemandForecastRow & { nationalDemand: number }> {
  const future: Array<DemandForecastRow & { nationalDemand: number }> = [];
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
    future.push({ ...row, nationalDemand: row.nationalDemand });
  }
  return future;
}

function demandPeriodEnd(start: Date): Date {
  return new Date(start.getTime() + SETTLEMENT_PERIOD_MS);
}

function embeddedPeriodEndKey(row: EmbeddedForecastRow): string {
  if (row.periodEndUtc) {
    return formatTinybirdDateTime(parseUtcDateTime(row.periodEndUtc));
  }
  return formatTinybirdDateTime(
    demandPeriodEnd(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod))
  );
}

function parseGmtPeriodEnd(dateGmt: unknown, timeGmt: unknown): Date | null {
  const timeRaw = String(timeGmt ?? "");
  const embedded = timeRaw.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (embedded) {
    return new Date(`${embedded[1]}T${embedded[2]}:${embedded[3]}:${embedded[4] ?? "00"}Z`);
  }
  const datePart = String(dateGmt ?? "").slice(0, 10);
  const timePart = timeRaw.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !timePart) {
    return null;
  }
  return new Date(`${datePart}T${timePart[1]}:${timePart[2]}:${timePart[3] ?? "00"}Z`);
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
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
