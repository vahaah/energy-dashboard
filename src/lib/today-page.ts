import { INTERCONNECTOR_COUNTRIES, INTERCONNECTOR_LABELS } from "@/lib/colors";
import {
  generationSharesFromRows,
  isInterconnectorFuel,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
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

export function energySharesFromSnapshots(snapshots: EnergySnapshot[]): TodayFuelShares {
  const energy = new Map<string, number>();
  for (const snapshot of snapshots) {
    addEnergy(energy, "wind", snapshot.gen_wind_mw);
    addEnergy(energy, "gas", snapshot.gen_gas_mw);
    addEnergy(energy, "nuclear", snapshot.gen_nuclear_mw);
    addEnergy(energy, "solar", snapshot.gen_solar_mw);
    addEnergy(energy, "hydro", snapshot.gen_hydro_mw);
    addEnergy(energy, "biomass", snapshot.gen_biomass_mw);
    addEnergy(energy, "coal", snapshot.gen_coal_mw);
    addEnergy(energy, "other", snapshot.gen_other_mw);
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

export function dayAveragesFromSnapshots(snapshots: EnergySnapshot[]): DayAverages {
  const summary = snapshotPeriodAverages(snapshots);
  const shares = energySharesFromSnapshots(snapshots);
  return {
    carbon: summary.carbon,
    demandGw: summary.demandMw == null ? null : summary.demandMw / 1000,
    price: summary.priceGbpMwh,
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
    const price = snapshot.price_mid_gbp_mwh ?? snapshot.price_gbp_mwh;
    if (price == null) {
      continue;
    }
    const cheap = cheapestPrice(cheapest);
    const dear = dearestPrice(dearest);
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
      gwLabel: formatHeadlineGw(mw),
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
  const todaySnapshots = rowsOnLondonDate(day?.snapshots ?? [], londonDate);
  const weekSnapshots = week?.snapshots ?? [];
  const shares = energySharesFromSnapshots(todaySnapshots);
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
    untilClock: latestAt ? formatLondonClock(latestAt) : null,
    untilDatetime: latestAt ? formatLondonIsoOffset(latestAt) : null,
    shares,
    carbonAverage: mean(todaySnapshots.map((row) => row.carbon_intensity)),
    priceAverage: mean(
      todaySnapshots.map((row) => row.price_mid_gbp_mwh ?? row.price_gbp_mwh)
    ),
    latest: {
      demandGw: formatHeadlineGw(day?.facts.demand.value ?? null),
      generationGw: formatHeadlineGw(day?.facts.generationMw.value ?? null),
      carbon: day?.facts.carbon.value == null ? null : day.facts.carbon.value.toFixed(0),
      price: day?.facts.price.value == null ? null : day.facts.price.value.toFixed(2),
      netImportsMw: netImports,
      netImportsGw: formatHeadlineGw(netImports),
      windSharePct: latestWind?.sharePct ?? null,
      windGw: latestWind ? formatHeadlineGw(latestWind.mw) : null,
    },
    comparison: {
      today: dayAveragesFromSnapshots(todaySnapshots),
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
  return `So far today (${model.dateLabel}, to ${model.untilClock}), wind supplied ${pct(model.shares.windPct)}% of Britain's electricity, gas ${pct(model.shares.gasPct)}%, nuclear ${pct(model.shares.nuclearPct)}% and solar ${pct(model.shares.solarPct)}%. Carbon intensity averaged ${avg(model.carbonAverage, 0)} gCO₂/kWh and the market index price averaged £${avg(model.priceAverage, 0)}/MWh. ${TODAY_CITE_SOURCES}`;
}

export function todayCitation(model: TodayPageModel, accessed: Date): string {
  return `Grid, "Britain's electricity today", grid.vahaah.com/today, accessed ${formatLondonDayMonthYear(getLondonDate(accessed))} ${model.untilClock ?? ""}. Data: Elexon BMRS, NESO.`.replace(
    "  ",
    " "
  );
}

export function todayFaqs(model: TodayPageModel): Array<{ question: string; answer: string }> {
  const importMw = model.latest.netImportsMw;
  return [
    {
      question: "How much of Britain's electricity is wind right now?",
      answer:
        model.latest.windSharePct == null || !model.latest.windGw
          ? `Grid does not yet have a complete latest half-hour. ${TODAY_CITE_SOURCES}`
          : `In the latest half-hour Grid holds, wind was ${model.latest.windSharePct.toFixed(0)}% (${model.latest.windGw} GW). ${TODAY_CITE_SOURCES}`,
    },
    {
      question: "How much came from gas today?",
      answer:
        model.shares.gasPct == null
          ? `Grid does not yet have today's gas share. ${TODAY_CITE_SOURCES}`
          : `So far today gas supplied ${pct(model.shares.gasPct)}% of electricity, averaging ${formatHeadlineGw(model.shares.gasGw)} GW (${model.shares.gasGwh == null ? "—" : model.shares.gasGwh.toFixed(1)} GWh). ${TODAY_CITE_SOURCES}`,
    },
    {
      question: "Is Britain importing electricity today?",
      answer:
        importMw == null
          ? `Interconnector flows for today are not in yet. ${TODAY_CITE_SOURCES}`
          : importMw > 25
            ? `Yes. The latest half-hour was a net import of ${formatHeadlineGw(importMw)} GW. ${TODAY_CITE_SOURCES}`
            : importMw < -25
              ? `The latest half-hour was a net export of ${formatHeadlineGw(Math.abs(importMw))} GW. ${TODAY_CITE_SOURCES}`
              : `Cross-border flows were broadly balanced in the latest half-hour. ${TODAY_CITE_SOURCES}`,
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

function addEnergy(energy: Map<string, number>, fuel: string, mw: number | null): void {
  if (mw == null) {
    return;
  }
  energy.set(fuel, (energy.get(fuel) ?? 0) + mw * HALF_HOUR_HOURS);
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

function cheapestPrice(snapshot: EnergySnapshot | null): number | null {
  return snapshot?.price_mid_gbp_mwh ?? snapshot?.price_gbp_mwh ?? null;
}

function dearestPrice(snapshot: EnergySnapshot | null): number | null {
  return cheapestPrice(snapshot);
}

function extremeFromSnapshot(snapshot: EnergySnapshot | null): PriceExtreme | null {
  if (!snapshot) {
    return null;
  }
  const value = snapshot.price_mid_gbp_mwh ?? snapshot.price_gbp_mwh;
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
): { mw: number; sharePct: number } | null {
  const grouped = new Map<string, number>();
  for (const share of generationSharesFromRows(splitLatestGenerationRows(rows).sources)) {
    const key = citeFuelKey(share.fuel);
    grouped.set(key, (grouped.get(key) ?? 0) + share.mw);
  }
  const total = [...grouped.values()].reduce((sum, mw) => sum + mw, 0);
  const mw = grouped.get(fuel);
  if (mw == null || total === 0) {
    return null;
  }
  return { mw, sharePct: (mw / total) * 100 };
}
