import {
  isInterconnectorFuel,
  latestSnapshotWithField,
  latestSnapshotWithMix,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import type { DashboardDateResolution } from "@/lib/dashboard-search-params";
import { HOURLY_CRON_STALE_MS } from "@/lib/health";
import {
  formatLondonDateTimeStamp,
  formatLondonDayMonthYear,
  parseUtcDateTime,
} from "@/lib/london-time";
import {
  getSettlementPeriod,
  listRecentSettlementPeriods,
  listSettlementPeriods,
  type SettlementPeriod,
} from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

export type Fact<T> = {
  value: T | null;
  unit: string;
  periodStartUtc: string | null;
  periodEndUtc: string | null;
  source: string;
  definition: string;
};

export type SupplyShare = {
  fuel: string;
  mw: number;
  sharePct: number;
};

export type FactsEmptyState = {
  message: string;
  action: "Go to latest";
  href: "/";
};

export type LatestFacts = {
  empty: boolean;
  emptyState: FactsEmptyState | null;
  coverageStart: string;
  requestedDate: string;
  isHistorical: boolean;
  isStale: boolean;
  stamp: string | null;
  headerStamp: string;
  carbon: Fact<number> & { index: string | null };
  demand: Fact<number>;
  price: Fact<number>;
  generationMw: Fact<number>;
  netImportsMw: Fact<number>;
  shares: SupplyShare[];
  generationRows: Generation5min[];
  mixSnapshot: EnergySnapshot | null;
  referenceTimestamp: string | null;
};

export type GetLatestFactsInput = {
  resolution: DashboardDateResolution;
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  now: Date;
};

const NO_DATA_STAMP = "No data yet. Grid refreshes every hour.";

export function getLatestFacts(input: GetLatestFactsInput): LatestFacts {
  switch (input.resolution.status) {
    case "empty":
      return emptyFacts(input.resolution);
    case "historical":
    case "latest":
      return populatedFacts(input);
    default: {
      const exhaustive: never = input.resolution.status;
      return exhaustive;
    }
  }
}

export function supplyShares(rows: Generation5min[]): SupplyShare[] {
  const byFuel = new Map<string, number>();
  let domesticMw = 0;
  let netImportsMw = 0;

  for (const row of rows) {
    if (isInterconnectorFuel(row.fuel_type)) {
      netImportsMw += row.generation_mw;
      continue;
    }

    const fuel = normalizeFuelType(row.fuel_type);
    byFuel.set(fuel, (byFuel.get(fuel) ?? 0) + row.generation_mw);
    domesticMw += row.generation_mw;
  }

  const supplyMw = domesticMw + netImportsMw;
  if (supplyMw === 0) {
    return [];
  }

  const shares: SupplyShare[] = [];
  for (const [fuel, mw] of byFuel) {
    shares.push({
      fuel,
      mw,
      sharePct: (mw / supplyMw) * 100,
    });
  }

  if (netImportsMw !== 0) {
    shares.push({
      fuel: "imports",
      mw: netImportsMw,
      sharePct: (netImportsMw / supplyMw) * 100,
    });
  }

  return shares;
}

function emptyFacts(resolution: DashboardDateResolution): LatestFacts {
  return {
    ...blankFacts(resolution, true),
    empty: true,
    emptyState: {
      message: `No data for ${formatLondonDayMonthYear(resolution.date)}. Coverage starts ${formatLondonDayMonthYear(resolution.coverageStart)}.`,
      action: "Go to latest",
      href: "/",
    },
  };
}

function populatedFacts({
  resolution,
  snapshots,
  generation,
  now,
}: GetLatestFactsInput): LatestFacts {
  const isHistorical = resolution.status === "historical";
  const period = targetSettlementPeriod(resolution, now);
  const daySnapshots = snapshotsOnDate(snapshots, isHistorical ? resolution.date : null, period);
  const generationRows = generationForPeriod(generation, period, isHistorical ? resolution.date : null);
  const split = splitLatestGenerationRows(generationRows);
  const shares = supplyShares(generationRows);

  const carbonRow = latestSnapshotWithField(daySnapshots, "carbon_intensity");
  const demandRow = latestSnapshotWithField(daySnapshots, "demand_mw");
  const priceRow = latestSnapshotWithField(daySnapshots, "price_gbp_mwh");
  const mixSnapshot = latestSnapshotWithMix(daySnapshots);
  const referenceTimestamp = latestTimestampAmong([
    carbonRow?.timestamp,
    demandRow?.timestamp,
    priceRow?.timestamp,
    split.latestTimestamp || null,
  ]);

  const carbonPeriod = periodFromSnapshot(carbonRow);
  const demandPeriod = periodFromSnapshot(demandRow);
  const pricePeriod = periodFromSnapshot(priceRow);
  const generationPeriod = periodFromTimestamp(split.latestTimestamp || null);

  const stampInstant = referenceTimestamp
    ? parseUtcDateTime(referenceTimestamp)
    : period
      ? period.startUtc
      : null;
  const stale =
    !isHistorical &&
    stampInstant != null &&
    now.getTime() - stampInstant.getTime() > HOURLY_CRON_STALE_MS;
  const stamp = stampInstant ? formatFactsStamp(stampInstant, stale) : null;

  return {
    empty: false,
    emptyState: null,
    coverageStart: resolution.coverageStart,
    requestedDate: resolution.date,
    isHistorical,
    isStale: stale,
    stamp,
    headerStamp: headerStampFrom(stamp, stale),
    carbon: {
      value: carbonRow?.carbon_intensity ?? null,
      index: carbonRow?.carbon_index ?? null,
      unit: "gCO₂/kWh",
      periodStartUtc: carbonPeriod?.startUtc ?? null,
      periodEndUtc: carbonPeriod?.endUtc ?? null,
      source: "Carbon Intensity API",
      definition: "National carbon intensity, actual half-hour value only",
    },
    demand: {
      value: demandRow?.demand_mw ?? null,
      unit: "MW",
      periodStartUtc: demandPeriod?.startUtc ?? null,
      periodEndUtc: demandPeriod?.endUtc ?? null,
      source: "Elexon BMRS",
      definition: "Initial Transmission System Demand Outturn (ITSDO)",
    },
    price: {
      value: priceRow?.price_gbp_mwh ?? null,
      unit: "£/MWh",
      periodStartUtc: pricePeriod?.startUtc ?? null,
      periodEndUtc: pricePeriod?.endUtc ?? null,
      source: "Elexon BMRS",
      definition: "Imbalance (system buy) price",
    },
    generationMw: {
      value: generationRows.length > 0 ? split.totalGenerationMw : null,
      unit: "MW",
      periodStartUtc: generationPeriod?.startUtc ?? null,
      periodEndUtc: generationPeriod?.endUtc ?? null,
      source: "Elexon BMRS, NESO, Sheffield Solar PV Live",
      definition: "GB generation including estimated embedded wind and solar",
    },
    netImportsMw: {
      value: generationRows.length > 0 ? split.netTransfersMw : null,
      unit: "MW",
      periodStartUtc: generationPeriod?.startUtc ?? null,
      periodEndUtc: generationPeriod?.endUtc ?? null,
      source: "Elexon BMRS",
      definition: "Metered interconnector net flow",
    },
    shares,
    generationRows,
    mixSnapshot,
    referenceTimestamp,
  };
}

function blankFacts(resolution: DashboardDateResolution, empty: boolean): LatestFacts {
  return {
    empty,
    emptyState: null,
    coverageStart: resolution.coverageStart,
    requestedDate: resolution.date,
    isHistorical: false,
    isStale: false,
    stamp: null,
    headerStamp: NO_DATA_STAMP,
    carbon: {
      value: null,
      index: null,
      unit: "gCO₂/kWh",
      periodStartUtc: null,
      periodEndUtc: null,
      source: "Carbon Intensity API",
      definition: "National carbon intensity, actual half-hour value only",
    },
    demand: {
      value: null,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: "Elexon BMRS",
      definition: "Initial Transmission System Demand Outturn (ITSDO)",
    },
    price: {
      value: null,
      unit: "£/MWh",
      periodStartUtc: null,
      periodEndUtc: null,
      source: "Elexon BMRS",
      definition: "Imbalance (system buy) price",
    },
    generationMw: {
      value: null,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: "Elexon BMRS, NESO, Sheffield Solar PV Live",
      definition: "GB generation including estimated embedded wind and solar",
    },
    netImportsMw: {
      value: null,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: "Elexon BMRS",
      definition: "Metered interconnector net flow",
    },
    shares: [],
    generationRows: [],
    mixSnapshot: null,
    referenceTimestamp: null,
  };
}

function targetSettlementPeriod(
  resolution: DashboardDateResolution,
  now: Date
): SettlementPeriod | null {
  switch (resolution.status) {
    case "historical": {
      const periods = listSettlementPeriods(resolution.date);
      return periods[periods.length - 1] ?? null;
    }
    case "latest": {
      const recent = listRecentSettlementPeriods(now, 24 * 60 * 60 * 1000);
      return recent[recent.length - 1] ?? null;
    }
    case "empty":
      return null;
    default: {
      const exhaustive: never = resolution.status;
      return exhaustive;
    }
  }
}

function snapshotsOnDate(
  snapshots: EnergySnapshot[],
  historicalDate: string | null,
  period: SettlementPeriod | null
): EnergySnapshot[] {
  const limit = period?.startUtc.getTime() ?? Number.POSITIVE_INFINITY;
  const filtered: EnergySnapshot[] = [];

  for (const snapshot of snapshots) {
    const at = parseUtcDateTime(snapshot.timestamp);
    if (historicalDate && getSettlementPeriod(at).settlementDate !== historicalDate) {
      continue;
    }
    if (at.getTime() > limit) {
      continue;
    }
    filtered.push(snapshot);
  }

  return filtered;
}

function generationForPeriod(
  rows: Generation5min[],
  period: SettlementPeriod | null,
  historicalDate: string | null
): Generation5min[] {
  if (!period) {
    return [];
  }

  const startMs = period.startUtc.getTime();
  const endMs = period.endUtc.getTime();
  const inPeriod: Generation5min[] = [];

  for (const row of rows) {
    const at = parseUtcDateTime(row.timestamp);
    if (historicalDate && getSettlementPeriod(at).settlementDate !== historicalDate) {
      continue;
    }
    const ms = at.getTime();
    if (ms >= startMs && ms < endMs) {
      inPeriod.push(row);
    }
  }

  if (inPeriod.length > 0) {
    return inPeriod;
  }

  const sameDay: Generation5min[] = [];
  for (const row of rows) {
    const at = parseUtcDateTime(row.timestamp);
    if (historicalDate && getSettlementPeriod(at).settlementDate !== historicalDate) {
      continue;
    }
    if (at.getTime() < endMs) {
      sameDay.push(row);
    }
  }

  return sameDay;
}

function periodFromSnapshot(snapshot: EnergySnapshot | null): {
  startUtc: string;
  endUtc: string;
} | null {
  return periodFromTimestamp(snapshot?.timestamp ?? null);
}

function periodFromTimestamp(timestamp: string | null): {
  startUtc: string;
  endUtc: string;
} | null {
  if (!timestamp) {
    return null;
  }

  const period = getSettlementPeriod(parseUtcDateTime(timestamp));
  return {
    startUtc: period.startUtc.toISOString(),
    endUtc: period.endUtc.toISOString(),
  };
}

function latestTimestampAmong(timestamps: Array<string | null | undefined>): string | null {
  let latest: string | null = null;

  for (const timestamp of timestamps) {
    if (!timestamp) {
      continue;
    }
    if (!latest || timestamp > latest) {
      latest = timestamp;
    }
  }

  return latest;
}

function formatFactsStamp(latest: Date, stale: boolean): string {
  const dated = formatLondonDateTimeStamp(latest);
  return stale ? `Latest available (${dated}, delayed)` : dated;
}

function headerStampFrom(stamp: string | null, stale: boolean): string {
  if (!stamp) {
    return NO_DATA_STAMP;
  }
  return stale ? stamp : `Data as of ${stamp}`;
}
