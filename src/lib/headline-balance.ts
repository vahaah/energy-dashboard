import {
  isBatteryFuel,
  isInterconnectorFuel,
  isPumpedStorageFuel,
  normalizeFuelType,
} from "@/lib/dashboard-model";
import { formatTinybirdDateTime, parseUtcDateTime } from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { Generation5min } from "@/lib/types";

/**
 * Half-hour supply balance on one settlement period.
 *
 * ITSDO already counts interconnector exports, station load and pumping, so
 * ITSDO + embedded is not generation + net transfers. Headline demand is
 * derived: generation + imports − exports − storage charging.
 */
export const HEADLINE_DISPLAY_TOLERANCE_GW = 0.1;

export type BalanceFuel = {
  fuel: string;
  /** Net half-hour average. Source rows keep this signed value. */
  mw: number;
  /** Mean of the positive samples across the whole half-hour, not only the positive ones. */
  positiveMw: number;
  /** Mean of the absolute negative samples across the whole half-hour. */
  negativeMw: number;
  samples: number;
  source: string;
};

export type StorageChargingKind = "pumping" | "battery" | "both";

export type SettlementBalance = {
  periodStartUtc: string | null;
  periodEndUtc: string | null;
  hasSupply: boolean;
  bookComplete: boolean;
  generationMw: number;
  importsMw: number;
  exportsMw: number;
  storageChargingMw: number;
  pumpingMw: number;
  batteryChargingMw: number;
  storageKind: StorageChargingKind | null;
  demandMw: number;
  netTransfersMw: number;
  embeddedMw: number;
  fuels: BalanceFuel[];
  rows: Generation5min[];
};

export function headlineGw(mw: number): number {
  return Number((Math.abs(mw) / 1000).toFixed(1));
}

export function headlineTermsClose(input: {
  generationMw: number;
  importsMw: number;
  exportsMw: number;
  storageChargingMw: number;
  demandMw: number;
}): boolean {
  const shown = (mw: number) => {
    const gw = headlineGw(mw);
    return gw === 0 ? 0 : gw;
  };
  const lhs =
    shown(input.generationMw) +
    shown(input.importsMw) -
    shown(input.exportsMw) -
    shown(input.storageChargingMw);
  return Math.abs(lhs - shown(input.demandMw)) <= HEADLINE_DISPLAY_TOLERANCE_GW + 1e-9;
}

export function buildSettlementBalance(
  rows: Generation5min[],
  periodStartUtc: string | null
): SettlementBalance {
  const empty = emptyBalance(periodStartUtc);
  if (!periodStartUtc) {
    return empty;
  }

  const period = getSettlementPeriod(parseUtcDateTime(periodStartUtc));
  const periodStartMs = period.startUtc.getTime();
  const periodEndMs = period.endUtc.getTime();
  const fuels = averageFuelsInPeriod(rows, periodStartMs);
  const totals = sumFuels(fuels);
  const bookComplete =
    totals.hasSupply &&
    domesticBookComplete(rows, periodStartMs, periodEndMs) &&
    connectorBookComplete(rows, periodStartMs, periodEndMs);

  return {
    periodStartUtc: period.startUtc.toISOString(),
    periodEndUtc: period.endUtc.toISOString(),
    hasSupply: totals.hasSupply,
    bookComplete,
    generationMw: totals.generationMw,
    importsMw: totals.importsMw,
    exportsMw: totals.exportsMw,
    storageChargingMw: totals.storageChargingMw,
    pumpingMw: totals.pumpingMw,
    batteryChargingMw: totals.batteryChargingMw,
    storageKind: storageKind(totals.pumpingMw, totals.batteryChargingMw),
    demandMw:
      totals.generationMw + totals.importsMw - totals.exportsMw - totals.storageChargingMw,
    netTransfersMw: totals.importsMw - totals.exportsMw,
    embeddedMw: totals.embeddedMw,
    fuels,
    rows: fuelRows(fuels, period.startUtc),
  };
}

function emptyBalance(periodStartUtc: string | null): SettlementBalance {
  return {
    periodStartUtc,
    periodEndUtc: null,
    hasSupply: false,
    bookComplete: false,
    generationMw: 0,
    importsMw: 0,
    exportsMw: 0,
    storageChargingMw: 0,
    pumpingMw: 0,
    batteryChargingMw: 0,
    storageKind: null,
    demandMw: 0,
    netTransfersMw: 0,
    embeddedMw: 0,
    fuels: [],
    rows: [],
  };
}

function averageFuelsInPeriod(rows: Generation5min[], periodStartMs: number): BalanceFuel[] {
  const buckets = new Map<
    string,
    { sum: number; positiveSum: number; negativeSum: number; samples: number; source: string; at: string }
  >();

  for (const row of rows) {
    if (settlementStartMs(row.timestamp) !== periodStartMs) {
      continue;
    }
    const fuel = normalizeFuelType(row.fuel_type);
    const existing = buckets.get(fuel);
    if (!existing) {
      buckets.set(fuel, {
        sum: row.generation_mw,
        positiveSum: Math.max(0, row.generation_mw),
        negativeSum: Math.max(0, -row.generation_mw),
        samples: 1,
        source: row.source,
        at: row.timestamp,
      });
      continue;
    }
    existing.sum += row.generation_mw;
    if (row.generation_mw > 0) {
      existing.positiveSum += row.generation_mw;
    } else if (row.generation_mw < 0) {
      existing.negativeSum += -row.generation_mw;
    }
    existing.samples += 1;
    if (row.timestamp >= existing.at) {
      existing.source = row.source;
      existing.at = row.timestamp;
    }
  }

  const fuels: BalanceFuel[] = [];
  for (const [fuel, bucket] of buckets) {
    fuels.push({
      fuel,
      mw: bucket.sum / bucket.samples,
      positiveMw: bucket.positiveSum / bucket.samples,
      negativeMw: bucket.negativeSum / bucket.samples,
      samples: bucket.samples,
      source: bucket.source,
    });
  }
  fuels.sort((left, right) => Math.abs(right.mw) - Math.abs(left.mw) || left.fuel.localeCompare(right.fuel));
  return fuels;
}

function sumFuels(fuels: BalanceFuel[]): {
  hasSupply: boolean;
  generationMw: number;
  importsMw: number;
  exportsMw: number;
  storageChargingMw: number;
  pumpingMw: number;
  batteryChargingMw: number;
  embeddedMw: number;
} {
  let hasSupply = false;
  let generationMw = 0;
  let importsMw = 0;
  let exportsMw = 0;
  let pumpingMw = 0;
  let batteryChargingMw = 0;
  let embeddedMw = 0;

  for (const fuel of fuels) {
    if (isInterconnectorFuel(fuel.fuel)) {
      importsMw += fuel.positiveMw;
      exportsMw += fuel.negativeMw;
      continue;
    }

    hasSupply = true;
    if (fuel.fuel === "embedded_wind" || fuel.fuel === "embedded_solar") {
      embeddedMw += fuel.mw;
      generationMw += fuel.mw;
      continue;
    }
    if (isPumpedStorageFuel(fuel.fuel)) {
      generationMw += fuel.positiveMw;
      pumpingMw += fuel.negativeMw;
      continue;
    }
    if (isBatteryFuel(fuel.fuel)) {
      generationMw += fuel.positiveMw;
      batteryChargingMw += fuel.negativeMw;
      continue;
    }
    generationMw += fuel.mw;
  }

  return {
    hasSupply,
    generationMw,
    importsMw,
    exportsMw,
    storageChargingMw: pumpingMw + batteryChargingMw,
    pumpingMw,
    batteryChargingMw,
    embeddedMw,
  };
}

function domesticBookComplete(
  rows: Generation5min[],
  periodStartMs: number,
  periodEndMs: number
): boolean {
  return seriesBookComplete(rows, periodStartMs, periodEndMs, (fuel) => !isInterconnectorFuel(fuel));
}

function connectorBookComplete(
  rows: Generation5min[],
  periodStartMs: number,
  periodEndMs: number
): boolean {
  return seriesBookComplete(rows, periodStartMs, periodEndMs, isInterconnectorFuel);
}

function seriesBookComplete(
  rows: Generation5min[],
  periodStartMs: number,
  periodEndMs: number,
  include: (fuel: string) => boolean
): boolean {
  const latest = new Map<string, Generation5min>();

  for (const row of rows) {
    const fuel = normalizeFuelType(row.fuel_type);
    if (!include(fuel)) {
      continue;
    }
    if (parseUtcDateTime(row.timestamp).getTime() >= periodEndMs) {
      continue;
    }
    const existing = latest.get(fuel);
    if (!existing || row.timestamp > existing.timestamp) {
      latest.set(fuel, row);
    }
  }

  if (latest.size === 0) {
    return false;
  }

  for (const row of latest.values()) {
    if (settlementStartMs(row.timestamp) !== periodStartMs) {
      return false;
    }
  }
  return true;
}

function storageKind(pumpingMw: number, batteryChargingMw: number): StorageChargingKind | null {
  const pumping = pumpingMw > 0;
  const battery = batteryChargingMw > 0;
  if (pumping && battery) {
    return "both";
  }
  if (pumping) {
    return "pumping";
  }
  if (battery) {
    return "battery";
  }
  return null;
}

function fuelRows(fuels: BalanceFuel[], periodStart: Date): Generation5min[] {
  const timestamp = formatTinybirdDateTime(periodStart);
  return fuels.map((fuel) => ({
    timestamp,
    fuel_type: fuel.fuel,
    generation_mw: fuel.mw,
    source: fuel.source,
  }));
}

function settlementStartMs(timestamp: string): number {
  return getSettlementPeriod(parseUtcDateTime(timestamp)).startUtc.getTime();
}
