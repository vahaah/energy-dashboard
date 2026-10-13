import { fuelColor, fuelLabel } from "@/lib/colors";
import {
  isBatteryFuel,
  isInterconnectorFuel,
  isPumpedStorageFuel,
  mapGenerationFuelToStackKey,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { buildSettlementBalance, type BalanceFuel, type SettlementBalance } from "@/lib/headline-balance";
import type { Generation5min } from "@/lib/types";

/** Show the storage-charging term from this half-hour average upward. */
export const STORAGE_CHARGING_MIN_MW = 50;

export const SHARE_SUM_TOLERANCE = 0.1;
export const INLINE_SHARE_LABEL_PCT = 10;
export const INLINE_SHARE_LABEL_PCT_NARROW = 15;

export type GenerationMixShare = {
  fuel: string;
  label: string;
  mw: number;
  sharePct: number;
  color: string;
};

/**
 * Share of generation for one settlement period. Interconnectors are not
 * segments. Storage discharge is included; charging is not. Sorted largest first.
 */
export function generationMixShares(
  rows: Generation5min[],
  periodStartUtc: string | null
): GenerationMixShare[] {
  if (periodStartUtc) {
    return sharesFromBalance(buildSettlementBalance(rows, periodStartUtc));
  }
  return generationMixFromSupplyShares(partsFromLatestFrame(rows));
}

export function sharesFromBalance(balance: SettlementBalance): GenerationMixShare[] {
  if (balance.generationMw <= 0) {
    return [];
  }

  const grouped = new Map<string, number>();
  for (const fuel of balance.fuels) {
    if (isInterconnectorFuel(fuel.fuel)) {
      continue;
    }
    const mw = domesticMegawatts(fuel);
    if (mw <= 0) {
      continue;
    }
    const key = displayFuel(fuel.fuel);
    grouped.set(key, (grouped.get(key) ?? 0) + mw);
  }

  return toShares(grouped, balance.generationMw);
}

/** Same base as {@link generationMixShares}, for payloads that only have fuel totals. */
export function generationMixFromSupplyShares(
  shares: Iterable<{ fuel: string; mw: number }>
): GenerationMixShare[] {
  const grouped = new Map<string, number>();
  for (const share of shares) {
    const fuel = normalizeFuelType(share.fuel);
    if (isInterconnectorFuel(fuel) || fuel === "imports") {
      continue;
    }
    if (share.mw <= 0) {
      continue;
    }
    const key = displayFuel(fuel);
    grouped.set(key, (grouped.get(key) ?? 0) + share.mw);
  }
  const total = [...grouped.values()].reduce((sum, mw) => sum + mw, 0);
  return toShares(grouped, total);
}

export function sharesSumWithinTolerance(shares: GenerationMixShare[]): boolean {
  if (shares.length === 0) {
    return true;
  }
  const sum = shares.reduce((total, share) => total + share.sharePct, 0);
  return Math.abs(sum - 100) <= SHARE_SUM_TOLERANCE;
}

export function formatSharePercent(sharePct: number): string {
  return Math.round(sharePct).toFixed(0);
}

export function showsInlineShareLabel(sharePct: number, narrow: boolean): boolean {
  return sharePct >= (narrow ? INLINE_SHARE_LABEL_PCT_NARROW : INLINE_SHARE_LABEL_PCT);
}

/** Flex-grow segments fill the track. Percentage widths plus gaps overflow past 100%. */
export function shareBarSegmentStyle(sharePct: number): {
  flexGrow: number;
  flexBasis: 0;
  minWidth: 0;
} {
  return { flexGrow: sharePct, flexBasis: 0, minWidth: 0 };
}

export function displayFuel(fuel: string): string {
  const normalized = normalizeFuelType(fuel);
  if (isInterconnectorFuel(normalized) || normalized === "imports") {
    return "imports";
  }
  switch (normalized) {
    case "embedded_wind":
    case "wind":
      return "wind";
    case "embedded_solar":
    case "solar":
      return "solar";
    default:
      return mapGenerationFuelToStackKey(normalized);
  }
}

function domesticMegawatts(fuel: BalanceFuel): number {
  if (isPumpedStorageFuel(fuel.fuel) || isBatteryFuel(fuel.fuel)) {
    return fuel.positiveMw;
  }
  return fuel.mw > 0 ? fuel.mw : 0;
}

function toShares(grouped: Map<string, number>, total: number): GenerationMixShare[] {
  if (total <= 0) {
    return [];
  }

  const shares = [...grouped.entries()]
    .filter(([, mw]) => mw > 0)
    .map(([fuel, mw]) => ({
      fuel,
      label: fuelLabel(fuel),
      mw,
      sharePct: (mw / total) * 100,
      color: fuelColor(fuel),
    }));

  shares.sort((left, right) => right.mw - left.mw || left.label.localeCompare(right.label));
  return shares;
}

function partsFromLatestFrame(rows: Generation5min[]): Array<{ fuel: string; mw: number }> {
  const split = splitLatestGenerationRows(rows);
  return split.sources.map((row) => ({
    fuel: row.fuel_type,
    mw: row.generation_mw,
  }));
}
