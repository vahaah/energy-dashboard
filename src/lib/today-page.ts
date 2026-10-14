import { INTERCONNECTOR_COUNTRIES, INTERCONNECTOR_LABELS } from "@/lib/colors";
import {
  isInterconnectorFuel,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { getDisplayedPower, termDisplayGw } from "@/lib/displayed-demand";
import { generationMixShares } from "@/lib/generation-share";
import { formatHeadlineGw } from "@/lib/facts";
import {
  addUtcDays,
  formatLondonClock,
  formatLondonDateLabel,
  formatLondonDayMonthYear,
  formatLondonIsoOffset,
  getLondonDate,
  parseUtcDateTime,
} from "@/lib/london-time";
import { snapshotPeriodAverages } from "@/lib/period-averages";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

export const TODAY_CITE_SOURCES = "Source: Elexon BMRS, NESO; updated hourly.";

export const HALF_HOUR_HOURS = 0.5;

export type TodayFuelShares = {
  windPct: number | null;
  gasPct: number | null;
  nuclearPct: number | null;
  solarPct: number | null;
  gasGw: number | null;
  gasGwh: number | null;
};

export type DayAverages = {
  carbon: number | null;
  demandGw: number | null;
  price: number | null;
  gasSharePct: number | null;
};

export type PriceExtreme = {
  value: number;
  timestamp: string;
  datetime: string;
  clock: string;
};

export type InterconnectorCountryFlow = {
  country: string;
  mw: number;
  gwLabel: string;
};

export type TodayPageModel = {
  kind: "numbers" | "fallback";
  londonDate: string;
  dateLabel: string;
  untilClock: string | null;
  untilDatetime: string | null;
  dateModified: string | null;
  shares: TodayFuelShares;
  carbonAverage: number | null;
  priceAverage: number | null;
  latest: {
    demandGw: string;
    generationGw: string;
    carbon: string | null;
    price: string | null;
    netImportsMw: number | null;
    netImportsGw: string;
    importsGw: string | null;
    exportsGw: string | null;
    windSharePct: number | null;
    windGw: string | null;
  };
  comparison: {
    today: DayAverages;
    yesterday: DayAverages;
    week: DayAverages;
  };
  cheapest: PriceExtreme | null;
  dearest: PriceExtreme | null;
  interconnectors: InterconnectorCountryFlow[];
  importing: boolean | null;
};

export function rowsOnLondonDate<T extends { timestamp: string }>(
  rows: T[],
  londonDate: string
): T[] {
  return rows.filter((row) => getLondonDate(parseUtcDateTime(row.timestamp)) === londonDate);
}

export function citeFuelKey(fuel: string): string {
  const normalized = normalizeFuelType(fuel);
  switch (normalized) {
    case "embedded_wind":
      return "wind";
    case "embedded_solar":
      return "solar";
    case "ccgt":
    case "ocgt":
      return "gas";
    default:
      return normalized;
  }
}

export function utcHourKey(timestamp: string): string {
  const at = parseUtcDateTime(timestamp);
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  const hour = String(at.getUTCHours()).padStart(2, "0");
  return `${at.getUTCFullYear()}-${month}-${day}T${hour}`;
}

export function snapshotsForLondonDate(
  daySnapshots: EnergySnapshot[],
  weekSnapshots: EnergySnapshot[],
  londonDate: string
): EnergySnapshot[] {
  const native = rowsOnLondonDate(daySnapshots, londonDate);
  const weekly = rowsOnLondonDate(weekSnapshots, londonDate);
  if (native.length === 0) {
    return weekly;
  }
  const coveredHours = new Set(native.map((row) => utcHourKey(row.timestamp)));
  const fills = weekly.filter((row) => !coveredHours.has(utcHourKey(row.timestamp)));
  if (fills.length === 0) {
    return native;
  }
  return [...native, ...fills].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function energySharesFromSnapshots(
  snapshots: EnergySnapshot[],
  nativeTimestamps?: ReadonlySet<string>
): TodayFuelShares {
  const energy = new Map<string, number>();
  for (const snapshot of snapshots) {
    const hours = snapshotIntervalHours(snapshot.timestamp, nativeTimestamps);
    addEnergy(energy, "wind", snapshot.gen_wind_mw, hours);
    addEnergy(energy, "gas", snapshot.gen_gas_mw, hours);
    addEnergy(energy, "nuclear", snapshot.gen_nuclear_mw, hours);
    addEnergy(energy, "solar", snapshot.gen_solar_mw, hours);
    addEnergy(energy, "hydro", snapshot.gen_hydro_mw, hours);
    addEnergy(energy, "biomass", snapshot.gen_biomass_mw, hours);
    addEnergy(energy, "coal", snapshot.gen_coal_mw, hours);
    addEnergy(energy, "other", snapshot.gen_other_mw, hours);
    addEnergy(energy, "pumped", generatingMw(snapshot.gen_pumped_mw), hours);
    addEnergy(energy, "battery", generatingMw(snapshot.gen_battery_mw), hours);
  }

  const total = [...energy.values()].reduce((sum, mwh) => sum + mwh, 0);
  const gasMwh = energy.get("gas") ?? 0;
  return {
    windPct: sharePct(energy.get("wind"), total),
    gasPct: sharePct(energy.get("gas"), total),
    nuclearPct: sharePct(energy.get("nuclear"), total),
    solarPct: sharePct(energy.get("solar"), total),
    gasGw: snapshots.length === 0 ? null : mean(snapshots.map((row) => row.gen_gas_mw)),
    gasGwh: snapshots.length === 0 ? null : gasMwh / 1000,
  };
}

export function dayAveragesFromSnapshots(
  snapshots: EnergySnapshot[],
  nativeTimestamps?: ReadonlySet<string>
): DayAverages {
  const summary = snapshotPeriodAverages(snapshots);
  const shares = energySharesFromSnapshots(snapshots, nativeTimestamps);
  return {
    carbon: summary.carbon,
    demandGw: summary.demandMw == null ? null : summary.demandMw / 1000,
    price: mean(snapshots.map((row) => row.price_mid_gbp_mwh)),
    gasSharePct: shares.gasPct,
  };
}

export function priceExtremes(snapshots: EnergySnapshot[]): {
  cheapest: PriceExtreme | null;
  dearest: PriceExtreme | null;
} {
  let cheapest: EnergySnapshot | null = null;
  let dearest: EnergySnapshot | null = null;
  for (const snapshot of snapshots) {
    const price = marketIndexPrice(snapshot);
    if (price == null) {
      continue;
    }
    const cheap = marketIndexPrice(cheapest);
    const dear = marketIndexPrice(dearest);
    if (cheap == null || price < cheap) {
      cheapest = snapshot;
    }
    if (dear == null || price > dear) {
      dearest = snapshot;
    }
  }
  return {
    cheapest: extremeFromSnapshot(cheapest),
    dearest: extremeFromSnapshot(dearest),
  };
}

export function interconnectorFlows(rows: Generation5min[]): InterconnectorCountryFlow[] {
  const split = splitLatestGenerationRows(rows);
  const byCountry = new Map<string, number>();
  for (const row of split.interconnectors) {
    const fuel = normalizeFuelType(row.fuel_type);
    if (!isInterconnectorFuel(fuel)) {
      continue;
    }
    const country = INTERCONNECTOR_COUNTRIES[fuel] ?? INTERCONNECTOR_LABELS[fuel] ?? fuel;
    byCountry.set(country, (byCountry.get(country) ?? 0) + row.generation_mw);
  }
  return [...byCountry.entries()]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .map(([country, mw]) => ({
      country,
      mw,
      gwLabel: formatHeadlineGw(Math.abs(mw)),
    }));
}

export function buildTodayPageModel(input: {
  day: DashboardPayload | null;
  week: DashboardPayload | null;
  now?: Date;
}): TodayPageModel {
  const now = input.now ?? new Date();
  const londonDate = getLondonDate(now);
  const yesterday = addUtcDays(londonDate, -1);
  const day = input.day ? hydrateDashboardPayload(input.day) : null;
  const week = input.week ? hydrateDashboardPayload(input.week) : null;
  const daySnapshots = rowsOnLondonDate(day?.snapshots ?? [], londonDate);
  const todaySnapshots = snapshotsForLondonDate(
    day?.snapshots ?? [],
    week?.snapshots ?? [],
    londonDate
  );
  const nativeTimestamps = new Set(daySnapshots.map((row) => row.timestamp));
  const weekSnapshots = week?.snapshots ?? [];
  const shares = energySharesFromSnapshots(todaySnapshots, nativeTimestamps);
  const extremes = priceExtremes(todaySnapshots);
  const latestStamp = latestRowTimestamp(todaySnapshots, day?.facts.referenceTimestamp ?? null);
  const latestAt = latestStamp ? parseUtcDateTime(latestStamp) : null;
  const generationRows = day?.headlineGeneration.length
    ? day.headlineGeneration
    : (day?.generationHistory ?? []);
  const interconnectors = interconnectorFlows(generationRows);
  const netImports =
    interconnectors.length > 0
      ? interconnectors.reduce((sum, row) => sum + row.mw, 0)
      : (day?.facts.netImportsMw.value ?? null);
  const latestWind = latestCiteFuelShare(generationRows, "wind");
  const power = day ? getDisplayedPower(day.facts, day.headlineSnapshots) : null;
  const hasNumbers =
    todaySnapshots.length > 0 &&
    shares.windPct != null &&
    shares.gasPct != null &&
    shares.nuclearPct != null &&
    shares.solarPct != null;

  return {
    kind: hasNumbers ? "numbers" : "fallback",
    londonDate,
    dateLabel: formatLondonDateLabel(now),
    untilClock: latestAt && !Number.isNaN(latestAt.getTime()) ? formatLondonClock(latestAt) : null,
    untilDatetime: latestAt && !Number.isNaN(latestAt.getTime()) ? formatLondonIsoOffset(latestAt) : null,
    dateModified: latestAt && !Number.isNaN(latestAt.getTime()) ? latestAt.toISOString() : null,
    shares,
    carbonAverage: mean(todaySnapshots.map((row) => row.carbon_intensity)),
    priceAverage: mean(todaySnapshots.map((row) => row.price_mid_gbp_mwh)),
    latest: {
      demandGw:
        (power ? termDisplayGw(power, "demand") : null) ??
        formatHeadlineGw(power?.demandMw ?? day?.facts.demand.value ?? null),
      generationGw:
        (power ? termDisplayGw(power, "generation") : null) ??
        formatHeadlineGw(power?.generationMw ?? day?.facts.generationMw.value ?? null),
      importsGw: power?.balanceClosed ? termDisplayGw(power, "imports") : null,
      exportsGw: power?.balanceClosed ? termDisplayGw(power, "exports") : null,
      carbon: day?.facts.carbon.value == null ? null : day.facts.carbon.value.toFixed(0),
      price: day?.facts.price.value == null ? null : day.facts.price.value.toFixed(2),
      netImportsMw: netImports,
      netImportsGw: formatHeadlineGw(netImports),
      windSharePct: latestWind?.displayPct ?? null,
      windGw: latestWind ? formatHeadlineGw(latestWind.mw) : null,
    },
    comparison: {
      today: dayAveragesFromSnapshots(todaySnapshots, nativeTimestamps),
      yesterday: dayAveragesFromSnapshots(rowsOnLondonDate(weekSnapshots, yesterday)),
      week: dayAveragesFromSnapshots(weekSnapshots),
    },
    cheapest: extremes.cheapest,
    dearest: extremes.dearest,
    interconnectors,
    importing: netImports == null ? null : netImports > 25,
  };
}

export function todayCitePlainText(model: TodayPageModel): string {
  if (model.kind === "fallback" || !model.untilClock) {
    return `Britain's electricity mix, carbon intensity and market price, compiled hourly from Elexon BMRS and NESO. ${TODAY_CITE_SOURCES}`;
  }
  return `So far today (${model.dateLabel}, to ${model.untilClock}), wind supplied ${pct(model.shares.windPct)}% of Britain's generation, gas ${pct(model.shares.gasPct)}%, nuclear ${pct(model.shares.nuclearPct)}% and solar ${pct(model.shares.solarPct)}%. Carbon intensity averaged ${avg(model.carbonAverage, 0)} gCO₂/kWh and the market index price averaged £${avg(model.priceAverage, 0)}/MWh. ${TODAY_CITE_SOURCES}`;
}

export function todayCitation(model: TodayPageModel, accessed: Date): string {
  return `Grid, "Britain's electricity today", grid.vahaah.com/today, accessed ${formatLondonDayMonthYear(getLondonDate(accessed))} ${model.untilClock ?? ""}. Data: Elexon BMRS, NESO.`.replace(
    "  ",
    " "
  );
}

export function todayFaqs(model: TodayPageModel): Array<{ question: string; answer: string }> {
  return [
    {
      question: "How much of Britain's electricity is wind right now?",
      answer:
        model.latest.windSharePct == null || !model.latest.windGw
          ? `Grid does not yet have a complete latest half-hour. ${TODAY_CITE_SOURCES}`
          : `In the latest half-hour Grid holds, wind was ${model.latest.windSharePct}% of generation (${model.latest.windGw} GW). ${TODAY_CITE_SOURCES}`,
    },
    {
      question: "How much came from gas today?",
      answer:
        model.shares.gasPct == null
          ? `Grid does not yet have today's gas share. ${TODAY_CITE_SOURCES}`
          : `So far today gas supplied ${pct(model.shares.gasPct)}% of generation, averaging ${formatHeadlineGw(model.shares.gasGw)} GW (${model.shares.gasGwh == null ? "—" : model.shares.gasGwh.toFixed(1)} GWh). ${TODAY_CITE_SOURCES}`,
    },
    {
      question: "Is Britain importing electricity today?",
      answer: todayTransferAnswer(model),
    },
    {
      question: "How clean is the grid today?",
      answer:
        model.carbonAverage == null
          ? `Carbon intensity for today is not in yet. ${TODAY_CITE_SOURCES}`
          : `Carbon intensity has averaged ${avg(model.carbonAverage, 0)} gCO₂/kWh so far today. Source: NESO Carbon Intensity API; updated hourly.`,
    },
    {
      question: "What's the wholesale electricity price today?",
      answer:
        model.priceAverage == null
          ? `The market index for today is not in yet. ${TODAY_CITE_SOURCES}`
          : `The market index (APXMIDP) has averaged £${avg(model.priceAverage, 0)}/MWh so far today${model.cheapest && model.dearest ? `, from £${model.cheapest.value.toFixed(2)} to £${model.dearest.value.toFixed(2)}/MWh` : ""}. ${TODAY_CITE_SOURCES}`,
    },
  ];
}

function todayTransferAnswer(model: TodayPageModel): string {
  const { importsGw, exportsGw, netImportsMw } = model.latest;
  if (importsGw && exportsGw) {
    return `The latest half-hour was importing ${importsGw} GW and exporting ${exportsGw} GW. ${TODAY_CITE_SOURCES}`;
  }
  if (netImportsMw == null) {
    return `Interconnector flows for today are not in yet. ${TODAY_CITE_SOURCES}`;
  }
  if (netImportsMw > 25) {
    return `Yes. The latest half-hour was a net import of ${formatHeadlineGw(netImportsMw)} GW. ${TODAY_CITE_SOURCES}`;
  }
  if (netImportsMw < -25) {
    return `The latest half-hour was a net export of ${formatHeadlineGw(Math.abs(netImportsMw))} GW. ${TODAY_CITE_SOURCES}`;
  }
  return `Cross-border flows were broadly balanced in the latest half-hour. ${TODAY_CITE_SOURCES}`;
}

function snapshotIntervalHours(
  timestamp: string,
  nativeTimestamps?: ReadonlySet<string>
): number {
  if (!nativeTimestamps || nativeTimestamps.has(timestamp)) {
    return HALF_HOUR_HOURS;
  }
  return 1;
}

function generatingMw(mw: number | null | undefined): number | null {
  if (mw == null || mw <= 0) {
    return null;
  }
  return mw;
}

function addEnergy(
  energy: Map<string, number>,
  fuel: string,
  mw: number | null,
  hours: number
): void {
  if (mw == null) {
    return;
  }
  energy.set(fuel, (energy.get(fuel) ?? 0) + mw * hours);
}

function sharePct(part: number | undefined, total: number): number | null {
  if (!total) {
    return null;
  }
  return ((part ?? 0) / total) * 100;
}

function mean(values: Array<number | null | undefined>): number | null {
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

function marketIndexPrice(snapshot: EnergySnapshot | null): number | null {
  return snapshot?.price_mid_gbp_mwh ?? null;
}

function extremeFromSnapshot(snapshot: EnergySnapshot | null): PriceExtreme | null {
  if (!snapshot) {
    return null;
  }
  const value = marketIndexPrice(snapshot);
  if (value == null) {
    return null;
  }
  const at = parseUtcDateTime(snapshot.timestamp);
  return {
    value,
    timestamp: snapshot.timestamp,
    datetime: formatLondonIsoOffset(at),
    clock: formatLondonClock(at),
  };
}

function latestRowTimestamp(snapshots: EnergySnapshot[], fallback: string | null): string | null {
  let latest: string | null = null;
  for (const snapshot of snapshots) {
    if (!latest || snapshot.timestamp > latest) {
      latest = snapshot.timestamp;
    }
  }
  return latest ?? fallback;
}

function pct(value: number | null): string {
  return value == null ? "—" : Math.round(value).toFixed(0);
}

function avg(value: number | null, digits: number): string {
  return value == null ? "—" : value.toFixed(digits);
}

export function settlementDateOf(timestamp: string): string {
  return getSettlementPeriod(parseUtcDateTime(timestamp)).settlementDate;
}

function latestCiteFuelShare(
  rows: Generation5min[],
  fuel: string
): { mw: number; sharePct: number; displayPct: number } | null {
  const match = generationMixShares(rows, null).find((share) => share.fuel === citeFuelKey(fuel));
  if (!match) {
    return null;
  }
  return { mw: match.mw, sharePct: match.sharePct, displayPct: match.displayPct };
}
