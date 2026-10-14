import { carbonIndexFromIntensity } from "@/lib/colors";
import { formatTinybirdDateTime, getLondonDate, parseUtcDateTime } from "@/lib/london-time";
import { integrityTimestampKey, normalizeTimestampSet } from "@/lib/snapshot-integrity";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

export const NESO_HISTORIC_RESOURCE_ID = "f93d1835-75bc-43e5-84ad-12472b180a98";
export const NESO_HISTORIC_SQL_URL = "https://api.neso.energy/api/3/action/datastore_search_sql";

export const MAX_WIND_MW = 30_000;
export const MAX_SOLAR_MW = 20_000;
export const SHARE_SUM_TOLERANCE_PCT = 5;
export const COAL_ENDED_MW = 100;
export const COAL_ENDED_SHARE_PCT = 0.5;
export const WIND_MILESTONE_START_GW = 10;
export const NESO_HISTORIC_START_YEAR = 2009;

export type HistoricQuarantineMetric = "wind" | "solar";

export type HistoricQuarantineRule = {
  id: string;
  metric: HistoricQuarantineMetric;
  /** Readings strictly above this MW are quarantined while the rule is in force. */
  aboveMw: number;
  /** Inclusive ISO date. */
  from: string;
  /** Exclusive ISO date. On this day the ceiling no longer applies. */
  until: string;
};

/**
 * The old hard ceilings, dated. A row above the cap stays in the raw series
 * with its MW unchanged and is left out of published records only while the
 * rule applies.
 *
 * Wind: 30 GW until 2027-04-01. The March 2026 NESO record is 23.9 GW.
 * Solar: 20 GW until 2028-04-01. The April 2026 NESO record is 15.4 GW.
 */
export const HISTORIC_QUARANTINE_RULES: HistoricQuarantineRule[] = [
  {
    id: "wind-above-30gw",
    metric: "wind",
    aboveMw: MAX_WIND_MW,
    from: `${NESO_HISTORIC_START_YEAR}-01-01`,
    until: "2027-04-01",
  },
  {
    id: "solar-above-20gw",
    metric: "solar",
    aboveMw: MAX_SOLAR_MW,
    from: `${NESO_HISTORIC_START_YEAR}-01-01`,
    until: "2028-04-01",
  },
];

/**
 * Britain's last coal power station, Ratcliffe-on-Soar (Uniper), closed on
 * 30 Sep 2024. NESO historic mix still carries residual coal after that date;
 * the published record is this documented closure, not those residuals.
 * Source: https://www.uniper.energy/united-kingdom/power-plants-united-kingdom/ratcliffe-soar
 */
export const COAL_POWER_ENDED = "2024-09-30";
export const COAL_POWER_ENDED_SOURCE =
  "https://www.uniper.energy/united-kingdom/power-plants-united-kingdom/ratcliffe-soar";

export const NESO_HISTORIC_SOURCE = "NESO historic generation mix";
export const WIND_RECORD_BASIS =
  "Transmission-connected wind plus embedded wind, from NESO historic generation mix.";
export const SOLAR_RECORD_BASIS =
  "NESO historic mix solar, including embedded solar. Not the Sheffield Solar PV Live series.";
export const CARBON_RECORD_BASIS = "Half-hour carbon intensity from NESO historic generation mix.";
export const COAL_RECORD_BASIS =
  "Britain's last coal power station, Ratcliffe-on-Soar, closed on 30 Sep 2024. NESO historic mix still shows residual coal after that date; this record does not follow those readings.";

const SHARE_FIELDS = [
  "GAS_perc",
  "COAL_perc",
  "NUCLEAR_perc",
  "WIND_perc",
  "WIND_EMB_perc",
  "HYDRO_perc",
  "IMPORTS_perc",
  "BIOMASS_perc",
  "OTHER_perc",
  "SOLAR_perc",
  "STORAGE_perc",
  "LOW_CARBON_perc",
  "ZERO_CARBON_perc",
  "RENEWABLE_perc",
  "FOSSIL_perc",
] as const;

const COMPONENT_SHARE_FIELDS = [
  "GAS_perc",
  "COAL_perc",
  "NUCLEAR_perc",
  "WIND_perc",
  "WIND_EMB_perc",
  "HYDRO_perc",
  "IMPORTS_perc",
  "BIOMASS_perc",
  "OTHER_perc",
  "SOLAR_perc",
  "STORAGE_perc",
] as const;

export type NesoHistoricRow = {
  DATETIME: string;
  GAS: number | null;
  COAL: number | null;
  NUCLEAR: number | null;
  WIND: number | null;
  WIND_EMB: number | null;
  HYDRO: number | null;
  IMPORTS: number | null;
  BIOMASS: number | null;
  OTHER: number | null;
  SOLAR: number | null;
  STORAGE: number | null;
  GENERATION: number | null;
  CARBON_INTENSITY: number | null;
  LOW_CARBON: number | null;
  ZERO_CARBON: number | null;
  RENEWABLE: number | null;
  FOSSIL: number | null;
  GAS_perc: number | null;
  COAL_perc: number | null;
  NUCLEAR_perc: number | null;
  WIND_perc: number | null;
  WIND_EMB_perc: number | null;
  HYDRO_perc: number | null;
  IMPORTS_perc: number | null;
  BIOMASS_perc: number | null;
  OTHER_perc: number | null;
  SOLAR_perc: number | null;
  STORAGE_perc: number | null;
  LOW_CARBON_perc: number | null;
  ZERO_CARBON_perc: number | null;
  RENEWABLE_perc: number | null;
  FOSSIL_perc: number | null;
};

export type HistoricRecordPoint = {
  value: number;
  timestampUtc: string;
  basis: string;
};

export type WindMilestone = {
  gw: number;
  timestampUtc: string;
};

export type GridRecords = {
  maxWind: HistoricRecordPoint | null;
  maxSolar: HistoricRecordPoint | null;
  lowestCarbon: HistoricRecordPoint | null;
  highestRenewableShare: HistoricRecordPoint | null;
  highestZeroCarbonShare: HistoricRecordPoint | null;
  lastCoal: HistoricRecordPoint | null;
  daysSinceCoal: number | null;
  windMilestones: WindMilestone[];
};

export const EMPTY_RECORDS: GridRecords = {
  maxWind: null,
  maxSolar: null,
  lowestCarbon: null,
  highestRenewableShare: null,
  highestZeroCarbonShare: null,
  lastCoal: null,
  daysSinceCoal: null,
  windMilestones: [],
};

export type YearlyAverage = {
  year: number;
  carbon: number;
  coalPct: number;
  gasPct: number;
  windPct: number;
  renewablePct: number;
  generationMw: number;
};

export type PeriodAverages = {
  carbon: number | null;
  demandMw: number | null;
  generationMw: number | null;
  transfersMw: number | null;
  priceGbpMwh: number | null;
};

export type HistoricPeriodView = {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  averageRows: Generation5min[];
  averages: PeriodAverages;
  yearly: YearlyAverage[];
  sentences: [string, string, string] | null;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string" || value === "") {
    return null;
  }
  return value;
}

export function parseNesoHistoricRow(raw: Record<string, unknown>): NesoHistoricRow | null {
  const datetime = asText(raw.DATETIME) ?? asText(raw.period);
  if (!datetime) {
    return null;
  }

  return {
    DATETIME: datetime,
    GAS: asNumber(raw.GAS) ?? asNumber(raw.gas),
    COAL: asNumber(raw.COAL) ?? asNumber(raw.coal),
    NUCLEAR: asNumber(raw.NUCLEAR) ?? asNumber(raw.nuclear),
    WIND: asNumber(raw.WIND) ?? asNumber(raw.wind),
    WIND_EMB: asNumber(raw.WIND_EMB) ?? asNumber(raw.wind_emb),
    HYDRO: asNumber(raw.HYDRO) ?? asNumber(raw.hydro),
    IMPORTS: asNumber(raw.IMPORTS) ?? asNumber(raw.imports),
    BIOMASS: asNumber(raw.BIOMASS) ?? asNumber(raw.biomass),
    OTHER: asNumber(raw.OTHER) ?? asNumber(raw.other),
    SOLAR: asNumber(raw.SOLAR) ?? asNumber(raw.solar),
    STORAGE: asNumber(raw.STORAGE) ?? asNumber(raw.storage),
    GENERATION: asNumber(raw.GENERATION) ?? asNumber(raw.generation),
    CARBON_INTENSITY: asNumber(raw.CARBON_INTENSITY) ?? asNumber(raw.carbon_intensity),
    LOW_CARBON: asNumber(raw.LOW_CARBON),
    ZERO_CARBON: asNumber(raw.ZERO_CARBON),
    RENEWABLE: asNumber(raw.RENEWABLE),
    FOSSIL: asNumber(raw.FOSSIL),
    GAS_perc: asNumber(raw.GAS_perc) ?? asNumber(raw.gas_perc),
    COAL_perc: asNumber(raw.COAL_perc) ?? asNumber(raw.coal_perc),
    NUCLEAR_perc: asNumber(raw.NUCLEAR_perc) ?? asNumber(raw.nuclear_perc),
    WIND_perc: asNumber(raw.WIND_perc) ?? asNumber(raw.wind_perc),
    WIND_EMB_perc: asNumber(raw.WIND_EMB_perc) ?? asNumber(raw.wind_emb_perc),
    HYDRO_perc: asNumber(raw.HYDRO_perc) ?? asNumber(raw.hydro_perc),
    IMPORTS_perc: asNumber(raw.IMPORTS_perc) ?? asNumber(raw.imports_perc),
    BIOMASS_perc: asNumber(raw.BIOMASS_perc) ?? asNumber(raw.biomass_perc),
    OTHER_perc: asNumber(raw.OTHER_perc) ?? asNumber(raw.other_perc),
    SOLAR_perc: asNumber(raw.SOLAR_perc) ?? asNumber(raw.solar_perc),
    STORAGE_perc: asNumber(raw.STORAGE_perc) ?? asNumber(raw.storage_perc),
    LOW_CARBON_perc: asNumber(raw.LOW_CARBON_perc) ?? asNumber(raw.low_carbon_perc),
    ZERO_CARBON_perc: asNumber(raw.ZERO_CARBON_perc) ?? asNumber(raw.zero_carbon_perc),
    RENEWABLE_perc: asNumber(raw.RENEWABLE_perc) ?? asNumber(raw.renewable_perc),
    FOSSIL_perc: asNumber(raw.FOSSIL_perc) ?? asNumber(raw.fossil_perc),
  };
}

/** Transmission plus embedded. A missing component is unknown, not zero. */
export function windMw(row: NesoHistoricRow): number | null {
  if (row.WIND == null || row.WIND_EMB == null) {
    return null;
  }
  return row.WIND + row.WIND_EMB;
}

export function solarMw(row: NesoHistoricRow): number {
  return row.SOLAR ?? 0;
}

export function domesticGenerationMw(row: NesoHistoricRow): number | null {
  if (row.GENERATION == null) {
    return null;
  }
  return row.GENERATION - (row.IMPORTS ?? 0);
}

export function zeroCarbonSharePct(row: NesoHistoricRow): number | null {
  if (row.GENERATION == null || row.GENERATION <= 0) {
    return null;
  }
  const wind = windMw(row);
  if (wind == null) {
    return null;
  }
  const zeroCarbonMw = wind + solarMw(row) + (row.HYDRO ?? 0) + (row.NUCLEAR ?? 0);
  return (zeroCarbonMw / row.GENERATION) * 100;
}

export function renewableSharePct(row: NesoHistoricRow): number | null {
  if (row.RENEWABLE_perc != null) {
    return row.RENEWABLE_perc;
  }
  if (row.GENERATION == null || row.GENERATION <= 0) {
    return null;
  }
  const wind = windMw(row);
  if (wind == null) {
    return null;
  }
  const renewableMw = wind + solarMw(row) + (row.HYDRO ?? 0);
  return (renewableMw / row.GENERATION) * 100;
}

export function isSaneHistoricRow(row: NesoHistoricRow): boolean {
  if (row.GENERATION == null || row.GENERATION <= 0) {
    return false;
  }

  for (const field of SHARE_FIELDS) {
    const share = row[field];
    if (share == null) {
      continue;
    }
    if (share < 0 || share > 100) {
      return false;
    }
  }

  let componentSum = 0;
  let componentCount = 0;
  for (const field of COMPONENT_SHARE_FIELDS) {
    const share = row[field];
    if (share == null) {
      continue;
    }
    componentSum += share;
    componentCount += 1;
  }

  if (componentCount === 0) {
    return true;
  }

  return Math.abs(componentSum - 100) <= SHARE_SUM_TOLERANCE_PCT;
}

export function saneHistoricRows(rows: NesoHistoricRow[]): NesoHistoricRow[] {
  return rows.filter((row) => isSaneHistoricRow(row));
}

function quarantineMetricMw(metric: HistoricQuarantineMetric, row: NesoHistoricRow): number | null {
  switch (metric) {
    case "wind":
      return windMw(row);
    case "solar":
      return row.SOLAR;
    default: {
      const exhaustive: never = metric;
      return exhaustive;
    }
  }
}

/** The dated ceiling that quarantines this row, or null. Does not mutate the row. */
export function historicQuarantineRule(row: NesoHistoricRow): HistoricQuarantineRule | null {
  const date = row.DATETIME.slice(0, 10);
  for (const rule of HISTORIC_QUARANTINE_RULES) {
    if (date < rule.from || date >= rule.until) {
      continue;
    }
    const mw = quarantineMetricMw(rule.metric, row);
    if (mw != null && mw > rule.aboveMw) {
      return rule;
    }
  }
  return null;
}

/** Share-sane rows that are not inside a dated ceiling. Raw rows are not copied or stripped. */
export function publishedHistoricRows(rows: NesoHistoricRow[]): NesoHistoricRow[] {
  return saneHistoricRows(rows).filter((row) => historicQuarantineRule(row) == null);
}

/**
 * Publication predicate matching `windMw`: a missing component is not zero.
 * The ceiling applies only to a complete sum. Raw columns stay in the SELECT list.
 */
function quarantineWithinSql(metric: HistoricQuarantineMetric, aboveMw: number): string {
  switch (metric) {
    case "wind":
      return `NOT ("WIND" IS NOT NULL AND "WIND_EMB" IS NOT NULL) OR ("WIND" + "WIND_EMB") <= ${aboveMw}`;
    case "solar":
      return `"SOLAR" IS NULL OR "SOLAR" <= ${aboveMw}`;
    default: {
      const exhaustive: never = metric;
      return exhaustive;
    }
  }
}

export function historicQuarantineSql(rule: HistoricQuarantineRule): string {
  return `(${quarantineWithinSql(rule.metric, rule.aboveMw)} OR "DATETIME" < '${rule.from}' OR "DATETIME" >= '${rule.until}')`;
}

function historicQuarantineWhereSql(): string {
  return HISTORIC_QUARANTINE_RULES.map((rule) => historicQuarantineSql(rule)).join(" AND ");
}

export function isCoalOperating(row: NesoHistoricRow): boolean {
  return (row.COAL ?? 0) >= COAL_ENDED_MW || (row.COAL_perc ?? 0) >= COAL_ENDED_SHARE_PCT;
}

export function residualCoalAfterPowerEnded(rows: NesoHistoricRow[]): NesoHistoricRow[] {
  return publishedHistoricRows(rows).filter((row) => {
    if (!isCoalOperating(row)) {
      return false;
    }
    return row.DATETIME.slice(0, 10) > COAL_POWER_ENDED;
  });
}

export function daysSinceCoalPowerEnded(now = new Date()): number {
  const today = getLondonDate(now);
  const ended = Date.parse(`${COAL_POWER_ENDED}T00:00:00.000Z`);
  const todayUtc = Date.parse(`${today}T00:00:00.000Z`);
  return Math.max(0, Math.floor((todayUtc - ended) / 86_400_000));
}

function recordPoint(
  value: number,
  timestampUtc: string,
  basis: string
): HistoricRecordPoint {
  return { value, timestampUtc, basis };
}

export function documentedCoalEnd(): HistoricRecordPoint {
  return recordPoint(0, `${COAL_POWER_ENDED}T00:00:00`, COAL_RECORD_BASIS);
}

export function emptyRecordsWithDocumentedCoal(now = new Date()): GridRecords {
  return {
    ...EMPTY_RECORDS,
    lastCoal: documentedCoalEnd(),
    daysSinceCoal: daysSinceCoalPowerEnded(now),
  };
}

export function computeRecords(
  rows: NesoHistoricRow[],
  now = new Date(),
  excludeTimestamps: Iterable<string> = []
): GridRecords {
  const excluded = normalizeTimestampSet(excludeTimestamps);
  const sane = publishedHistoricRows(rows).filter(
    (row) => !excluded.has(integrityTimestampKey(row.DATETIME))
  );
  let maxWind: HistoricRecordPoint | null = null;
  let maxSolar: HistoricRecordPoint | null = null;
  let lowestCarbon: HistoricRecordPoint | null = null;
  let highestRenewableShare: HistoricRecordPoint | null = null;
  let highestZeroCarbonShare: HistoricRecordPoint | null = null;
  const firstAboveGw = new Map<number, string>();

  for (const row of sane) {
    const wind = windMw(row);
    if (wind != null && (maxWind == null || wind > maxWind.value)) {
      maxWind = recordPoint(wind, row.DATETIME, WIND_RECORD_BASIS);
    }

    const solar = solarMw(row);
    if (maxSolar == null || solar > maxSolar.value) {
      maxSolar = recordPoint(solar, row.DATETIME, SOLAR_RECORD_BASIS);
    }

    if (row.CARBON_INTENSITY != null && row.CARBON_INTENSITY > 0) {
      if (lowestCarbon == null || row.CARBON_INTENSITY < lowestCarbon.value) {
        lowestCarbon = recordPoint(row.CARBON_INTENSITY, row.DATETIME, CARBON_RECORD_BASIS);
      }
    }

    const renewable = renewableSharePct(row);
    if (renewable != null && (highestRenewableShare == null || renewable > highestRenewableShare.value)) {
      highestRenewableShare = recordPoint(
        renewable,
        row.DATETIME,
        "Renewable share of NESO historic generation (wind, solar and hydro)."
      );
    }

    const zeroCarbon = zeroCarbonSharePct(row);
    if (
      zeroCarbon != null &&
      (highestZeroCarbonShare == null || zeroCarbon > highestZeroCarbonShare.value)
    ) {
      highestZeroCarbonShare = recordPoint(
        zeroCarbon,
        row.DATETIME,
        "Zero-carbon share computed as wind + solar + hydro + nuclear, divided by NESO generation."
      );
    }

    if (wind != null) {
      const windGw = Math.floor(wind / 1000);
      for (let gw = WIND_MILESTONE_START_GW; gw <= windGw; gw += 1) {
        const existing = firstAboveGw.get(gw);
        if (!existing || row.DATETIME < existing) {
          firstAboveGw.set(gw, row.DATETIME);
        }
      }
    }
  }

  const windMilestones = [...firstAboveGw.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([gw, timestampUtc]) => ({ gw, timestampUtc }));

  return {
    maxWind,
    maxSolar,
    lowestCarbon,
    highestRenewableShare,
    highestZeroCarbonShare,
    lastCoal: documentedCoalEnd(),
    daysSinceCoal: daysSinceCoalPowerEnded(now),
    windMilestones,
  };
}

function mean(values: Array<number | null>): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value == null) {
      continue;
    }
    total += value;
    count += 1;
  }
  return count === 0 ? null : total / count;
}

export function periodAverages(rows: NesoHistoricRow[]): PeriodAverages {
  const sane = publishedHistoricRows(rows);
  return {
    carbon: mean(sane.map((row) => row.CARBON_INTENSITY)),
    demandMw: mean(sane.map((row) => row.GENERATION)),
    generationMw: mean(sane.map((row) => domesticGenerationMw(row))),
    transfersMw: mean(sane.map((row) => row.IMPORTS)),
    priceGbpMwh: null,
  };
}

export function yearlyAverages(rows: NesoHistoricRow[]): YearlyAverage[] {
  const byYear = new Map<number, NesoHistoricRow[]>();
  for (const row of publishedHistoricRows(rows)) {
    const year = parseUtcDateTime(row.DATETIME).getUTCFullYear();
    if (year < NESO_HISTORIC_START_YEAR) {
      continue;
    }
    const bucket = byYear.get(year);
    if (bucket) {
      bucket.push(row);
      continue;
    }
    byYear.set(year, [row]);
  }

  return [...byYear.entries()]
    .sort((left, right) => left[0] - right[0])
    .flatMap(([year, yearRows]) => {
      const carbon = mean(yearRows.map((row) => row.CARBON_INTENSITY));
      const generationMw = mean(yearRows.map((row) => row.GENERATION));
      if (carbon == null || generationMw == null) {
        return [];
      }
      return [
        {
          year,
          carbon,
          coalPct: mean(yearRows.map((row) => row.COAL_perc)) ?? 0,
          gasPct: mean(yearRows.map((row) => row.GAS_perc)) ?? 0,
          windPct: mean(yearRows.map((row) => windSharePct(row))) ?? 0,
          renewablePct: mean(yearRows.map((row) => renewableSharePct(row))) ?? 0,
          generationMw,
        },
      ];
    });
}

function windSharePct(row: NesoHistoricRow): number | null {
  if (row.WIND_perc != null || row.WIND_EMB_perc != null) {
    return (row.WIND_perc ?? 0) + (row.WIND_EMB_perc ?? 0);
  }
  if (row.GENERATION == null || row.GENERATION <= 0) {
    return null;
  }
  const wind = windMw(row);
  if (wind == null) {
    return null;
  }
  return (wind / row.GENERATION) * 100;
}

function formatGrams(value: number): string {
  return String(Math.round(value));
}

function formatPct(value: number): string {
  return value.toFixed(0);
}

export function transitionSentences(years: YearlyAverage[]): [string, string, string] | null {
  const first = years[0];
  const last = years.at(-1);
  if (!first || !last || first.year === last.year) {
    return null;
  }

  return [
    `In ${first.year}, coal supplied ${formatPct(first.coalPct)}% of the mix and carbon intensity averaged ${formatGrams(first.carbon)} gCO₂/kWh.`,
    `By ${last.year}, coal’s share is ${formatPct(last.coalPct)}% and carbon intensity has fallen to ${formatGrams(last.carbon)} g.`,
    `Wind has moved from ${formatPct(first.windPct)}% to ${formatPct(last.windPct)}% of generation over the same years.`,
  ];
}

function snapshotTimestamp(datetime: string): string {
  return formatTinybirdDateTime(parseUtcDateTime(datetime));
}

function pctOf(part: number | null, total: number | null): number | null {
  if (part == null || total == null || total <= 0) {
    return null;
  }
  return (part / total) * 100;
}

export function historicRowToSnapshot(row: NesoHistoricRow): EnergySnapshot {
  const generation = row.GENERATION;
  const wind = windMw(row);
  const solar = solarMw(row);
  return {
    timestamp: snapshotTimestamp(row.DATETIME),
    carbon_intensity: row.CARBON_INTENSITY,
    carbon_forecast: null,
    carbon_index: row.CARBON_INTENSITY == null ? "unknown" : carbonIndexFromIntensity(row.CARBON_INTENSITY),
    demand_mw: generation,
    price_gbp_mwh: null,
    price_mid_gbp_mwh: null,
    mid_volume_mwh: null,
    gen_gas_pct: row.GAS_perc ?? pctOf(row.GAS, generation),
    gen_coal_pct: row.COAL_perc ?? pctOf(row.COAL, generation),
    gen_nuclear_pct: row.NUCLEAR_perc ?? pctOf(row.NUCLEAR, generation),
    gen_wind_pct: row.WIND_perc == null && row.WIND_EMB_perc == null ? pctOf(wind, generation) : (row.WIND_perc ?? 0) + (row.WIND_EMB_perc ?? 0),
    gen_solar_pct: row.SOLAR_perc ?? pctOf(solar, generation),
    gen_hydro_pct: row.HYDRO_perc ?? pctOf(row.HYDRO, generation),
    gen_biomass_pct: row.BIOMASS_perc ?? pctOf(row.BIOMASS, generation),
    gen_imports_pct: row.IMPORTS_perc ?? pctOf(row.IMPORTS, generation),
    gen_other_pct: row.OTHER_perc ?? pctOf(row.OTHER, generation),
    gen_gas_mw: row.GAS,
    gen_coal_mw: row.COAL,
    gen_nuclear_mw: row.NUCLEAR,
    gen_wind_mw: wind,
    gen_solar_mw: solar,
    gen_hydro_mw: row.HYDRO,
    gen_biomass_mw: row.BIOMASS,
    gen_other_mw: row.OTHER,
    gen_pumped_mw: row.STORAGE,
    gen_battery_mw: null,
  };
}

export function historicRowToGeneration(row: NesoHistoricRow): Generation5min[] {
  const timestamp = snapshotTimestamp(row.DATETIME);
  const fuels: Array<[string, number | null]> = [
    ["gas", row.GAS],
    ["coal", row.COAL],
    ["nuclear", row.NUCLEAR],
    ["wind", windMw(row)],
    ["hydro", row.HYDRO],
    ["biomass", row.BIOMASS],
    ["other", row.OTHER],
    ["solar", row.SOLAR],
    ["pumped_storage", row.STORAGE],
    ["intneso", row.IMPORTS],
  ];

  const rows: Generation5min[] = [];
  for (const [fuel, mw] of fuels) {
    if (mw == null) {
      continue;
    }
    rows.push({
      timestamp,
      fuel_type: fuel,
      generation_mw: mw,
      source: "neso-historic",
    });
  }
  return rows;
}

export function averageHistoricRow(rows: NesoHistoricRow[]): NesoHistoricRow | null {
  const sane = publishedHistoricRows(rows);
  const last = sane.at(-1);
  if (!last) {
    return null;
  }

  const fieldMean = (select: (row: NesoHistoricRow) => number | null): number | null =>
    mean(sane.map(select));

  return {
    DATETIME: last.DATETIME,
    GAS: fieldMean((row) => row.GAS),
    COAL: fieldMean((row) => row.COAL),
    NUCLEAR: fieldMean((row) => row.NUCLEAR),
    WIND: fieldMean((row) => row.WIND),
    WIND_EMB: fieldMean((row) => row.WIND_EMB),
    HYDRO: fieldMean((row) => row.HYDRO),
    IMPORTS: fieldMean((row) => row.IMPORTS),
    BIOMASS: fieldMean((row) => row.BIOMASS),
    OTHER: fieldMean((row) => row.OTHER),
    SOLAR: fieldMean((row) => row.SOLAR),
    STORAGE: fieldMean((row) => row.STORAGE),
    GENERATION: fieldMean((row) => row.GENERATION),
    CARBON_INTENSITY: fieldMean((row) => row.CARBON_INTENSITY),
    LOW_CARBON: fieldMean((row) => row.LOW_CARBON),
    ZERO_CARBON: fieldMean((row) => row.ZERO_CARBON),
    RENEWABLE: fieldMean((row) => row.RENEWABLE),
    FOSSIL: fieldMean((row) => row.FOSSIL),
    GAS_perc: fieldMean((row) => row.GAS_perc),
    COAL_perc: fieldMean((row) => row.COAL_perc),
    NUCLEAR_perc: fieldMean((row) => row.NUCLEAR_perc),
    WIND_perc: fieldMean((row) => row.WIND_perc),
    WIND_EMB_perc: fieldMean((row) => row.WIND_EMB_perc),
    HYDRO_perc: fieldMean((row) => row.HYDRO_perc),
    IMPORTS_perc: fieldMean((row) => row.IMPORTS_perc),
    BIOMASS_perc: fieldMean((row) => row.BIOMASS_perc),
    OTHER_perc: fieldMean((row) => row.OTHER_perc),
    SOLAR_perc: fieldMean((row) => row.SOLAR_perc),
    STORAGE_perc: fieldMean((row) => row.STORAGE_perc),
    LOW_CARBON_perc: fieldMean((row) => row.LOW_CARBON_perc),
    ZERO_CARBON_perc: fieldMean((row) => row.ZERO_CARBON_perc),
    RENEWABLE_perc: fieldMean((row) => row.RENEWABLE_perc),
    FOSSIL_perc: fieldMean((row) => row.FOSSIL_perc),
  };
}

export function buildHistoricPeriodView(rows: NesoHistoricRow[]): HistoricPeriodView {
  const sane = publishedHistoricRows(rows);
  const snapshots = sane.map(historicRowToSnapshot);
  const generation = sane.flatMap(historicRowToGeneration);
  const average = averageHistoricRow(sane);
  const yearly = yearlyAverages(sane);

  return {
    snapshots,
    generation,
    averageRows: average ? historicRowToGeneration(average) : [],
    averages: periodAverages(sane),
    yearly,
    sentences: transitionSentences(yearly),
  };
}

export function rowsInLastYear(rows: NesoHistoricRow[], now = new Date()): NesoHistoricRow[] {
  const start = now.getTime() - 365 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => parseUtcDateTime(row.DATETIME).getTime() >= start);
}

export function rowsSinceHistoricStart(rows: NesoHistoricRow[]): NesoHistoricRow[] {
  const start = Date.UTC(NESO_HISTORIC_START_YEAR, 0, 1);
  return rows.filter((row) => parseUtcDateTime(row.DATETIME).getTime() >= start);
}

export const NESO_SANITY_SQL = '"GENERATION" > 0';

const NESO_EXCLUDE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function nesoIntegrityExcludeSql(excludeTimestamps: Iterable<string> = []): string {
  const keys = [...normalizeTimestampSet(excludeTimestamps)].filter((key) =>
    NESO_EXCLUDE_TIMESTAMP.test(key)
  );
  if (keys.length === 0) {
    return "";
  }
  return ` AND replace("DATETIME"::text, 'T', ' ') NOT IN (${keys.map((key) => `'${key}'`).join(",")})`;
}

const NESO_RECORD_COLUMNS = [
  '"DATETIME"',
  '"GAS"',
  '"COAL"',
  '"NUCLEAR"',
  '"WIND"',
  '"WIND_EMB"',
  '"HYDRO"',
  '"IMPORTS"',
  '"BIOMASS"',
  '"OTHER"',
  '"SOLAR"',
  '"STORAGE"',
  '"GENERATION"',
  '"CARBON_INTENSITY"',
  '"LOW_CARBON"',
  '"ZERO_CARBON"',
  '"RENEWABLE"',
  '"FOSSIL"',
  '"GAS_perc"',
  '"COAL_perc"',
  '"NUCLEAR_perc"',
  '"WIND_perc"',
  '"WIND_EMB_perc"',
  '"HYDRO_perc"',
  '"IMPORTS_perc"',
  '"BIOMASS_perc"',
  '"OTHER_perc"',
  '"SOLAR_perc"',
  '"STORAGE_perc"',
  '"LOW_CARBON_perc"',
  '"ZERO_CARBON_perc"',
  '"RENEWABLE_perc"',
  '"FOSSIL_perc"',
].join(",");

export function historicWeeklySql(): string {
  return [
    'SELECT date_trunc(\'week\', "DATETIME") AS "DATETIME",',
    'AVG("GAS") AS "GAS", AVG("COAL") AS "COAL", AVG("NUCLEAR") AS "NUCLEAR",',
    'AVG("WIND") AS "WIND", AVG("WIND_EMB") AS "WIND_EMB", AVG("HYDRO") AS "HYDRO",',
    'AVG("IMPORTS") AS "IMPORTS", AVG("BIOMASS") AS "BIOMASS", AVG("OTHER") AS "OTHER",',
    'AVG("SOLAR") AS "SOLAR", AVG("STORAGE") AS "STORAGE", AVG("GENERATION") AS "GENERATION",',
    'AVG("CARBON_INTENSITY") AS "CARBON_INTENSITY", AVG("LOW_CARBON") AS "LOW_CARBON",',
    'AVG("ZERO_CARBON") AS "ZERO_CARBON", AVG("RENEWABLE") AS "RENEWABLE", AVG("FOSSIL") AS "FOSSIL",',
    'AVG("GAS_perc") AS "GAS_perc", AVG("COAL_perc") AS "COAL_perc", AVG("NUCLEAR_perc") AS "NUCLEAR_perc",',
    'AVG("WIND_perc") AS "WIND_perc", AVG("WIND_EMB_perc") AS "WIND_EMB_perc", AVG("HYDRO_perc") AS "HYDRO_perc",',
    'AVG("IMPORTS_perc") AS "IMPORTS_perc", AVG("BIOMASS_perc") AS "BIOMASS_perc", AVG("OTHER_perc") AS "OTHER_perc",',
    'AVG("SOLAR_perc") AS "SOLAR_perc", AVG("STORAGE_perc") AS "STORAGE_perc",',
    'AVG("LOW_CARBON_perc") AS "LOW_CARBON_perc", AVG("ZERO_CARBON_perc") AS "ZERO_CARBON_perc",',
    'AVG("RENEWABLE_perc") AS "RENEWABLE_perc", AVG("FOSSIL_perc") AS "FOSSIL_perc"',
    `FROM "${NESO_HISTORIC_RESOURCE_ID}"`,
    `WHERE ${NESO_SANITY_SQL} AND ${historicQuarantineWhereSql()}`,
    "GROUP BY 1 ORDER BY 1",
  ].join(" ");
}

export function historicRecordsSql(excludeTimestamps: Iterable<string> = []): string {
  const parts = [
    'SELECT * FROM sane WHERE "WIND" IS NOT NULL AND "WIND_EMB" IS NOT NULL ORDER BY ("WIND" + "WIND_EMB") DESC LIMIT 5',
    'SELECT * FROM sane WHERE "SOLAR" IS NOT NULL ORDER BY "SOLAR" DESC LIMIT 5',
    'SELECT * FROM sane WHERE "CARBON_INTENSITY" > 0 AND "ZERO_CARBON_perc" <= 100 ORDER BY "CARBON_INTENSITY" ASC LIMIT 10',
    'SELECT * FROM sane WHERE "ZERO_CARBON_perc" <= 100 ORDER BY "ZERO_CARBON_perc" DESC LIMIT 5',
    'SELECT * FROM sane WHERE "GENERATION" > 0 AND "WIND" IS NOT NULL AND "WIND_EMB" IS NOT NULL AND "SOLAR" IS NOT NULL AND "HYDRO" IS NOT NULL AND "NUCLEAR" IS NOT NULL ORDER BY (("WIND" + "WIND_EMB" + "SOLAR" + "HYDRO" + "NUCLEAR") / "GENERATION") DESC LIMIT 5',
    'SELECT * FROM sane WHERE "RENEWABLE_perc" <= 100 ORDER BY "RENEWABLE_perc" DESC LIMIT 5',
  ];

  for (let gw = WIND_MILESTONE_START_GW; gw <= 30; gw += 1) {
    parts.push(
      `SELECT * FROM sane WHERE "WIND" IS NOT NULL AND "WIND_EMB" IS NOT NULL AND ("WIND" + "WIND_EMB") >= ${gw * 1000} ORDER BY "DATETIME" ASC LIMIT 1`
    );
  }

  return [
    `WITH sane AS (SELECT ${NESO_RECORD_COLUMNS} FROM "${NESO_HISTORIC_RESOURCE_ID}" WHERE ${NESO_SANITY_SQL} AND ${historicQuarantineWhereSql()}${nesoIntegrityExcludeSql(excludeTimestamps)})`,
    parts.map((part) => `(${part})`).join(" UNION ALL "),
  ].join(" ");
}
