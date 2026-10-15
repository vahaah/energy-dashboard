import { isBatteryFuel, isPumpedStorageFuel } from "@/lib/dashboard-model";
import { buildSettlementBalance, type BalanceFuel } from "@/lib/headline-balance";
import { formatLondonDateTimeStamp, parseUtcDateTime } from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { Generation5min } from "@/lib/types";

export type StorageFuelReading = {
  dischargeMw: number;
  chargeMw: number;
};

export type StorageOperations =
  | { available: false }
  | {
      available: true;
      periodStart: string;
      periodEnd: string;
      periodLabel: string;
      pumped: StorageFuelReading | null;
      battery: StorageFuelReading | null;
    };

function reading(fuel: BalanceFuel | undefined): StorageFuelReading | null {
  if (!fuel) {
    return null;
  }
  return { dischargeMw: fuel.positiveMw, chargeMw: fuel.negativeMw };
}

/**
 * Charging and discharge from the warmed FUELINST rows.
 * A missing fuel stays null. A published zero stays zero.
 */
export function storageOperations(rows: readonly Generation5min[] | null, now: Date): StorageOperations {
  if (!rows || rows.length === 0) {
    return { available: false };
  }
  let latest: Date | null = null;
  for (const row of rows) {
    if (!isPumpedStorageFuel(row.fuel_type) && !isBatteryFuel(row.fuel_type)) {
      continue;
    }
    const at = parseUtcDateTime(row.timestamp);
    if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) {
      continue;
    }
    if (!latest || at.getTime() > latest.getTime()) {
      latest = at;
    }
  }
  if (!latest) {
    return { available: false };
  }
  const period = getSettlementPeriod(latest);
  const balance = buildSettlementBalance([...rows], period.startUtc.toISOString());
  const pumped = balance.fuels.find((fuel) => isPumpedStorageFuel(fuel.fuel));
  const battery = balance.fuels.find((fuel) => isBatteryFuel(fuel.fuel));
  if (!pumped && !battery) {
    return { available: false };
  }
  return {
    available: true,
    periodStart: period.startUtc.toISOString(),
    periodEnd: period.endUtc.toISOString(),
    periodLabel: formatLondonDateTimeStamp(period.startUtc),
    pumped: reading(pumped),
    battery: reading(battery),
  };
}
