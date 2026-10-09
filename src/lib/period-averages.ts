import { buildRangeSummary } from "@/lib/dashboard-model";
import type { PeriodAverages } from "@/lib/historic-mix";
import type { EnergySnapshot } from "@/lib/types";

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

function domesticMw(snapshot: EnergySnapshot): number | null {
  const parts = [
    snapshot.gen_gas_mw,
    snapshot.gen_coal_mw,
    snapshot.gen_nuclear_mw,
    snapshot.gen_wind_mw,
    snapshot.gen_solar_mw,
    snapshot.gen_hydro_mw,
    snapshot.gen_biomass_mw,
    snapshot.gen_other_mw,
    snapshot.gen_pumped_mw,
    snapshot.gen_battery_mw,
  ];
  let total = 0;
  let seen = false;
  for (const part of parts) {
    if (part == null) {
      continue;
    }
    total += part;
    seen = true;
  }
  return seen ? total : null;
}

function transfersMw(snapshot: EnergySnapshot): number | null {
  if (snapshot.demand_mw != null && snapshot.gen_imports_pct != null) {
    return snapshot.demand_mw * (snapshot.gen_imports_pct / 100);
  }
  const domestic = domesticMw(snapshot);
  if (snapshot.demand_mw != null && domestic != null) {
    return snapshot.demand_mw - domestic;
  }
  return null;
}

export function snapshotPeriodAverages(snapshots: EnergySnapshot[]): PeriodAverages {
  const summary = buildRangeSummary(snapshots);
  return {
    carbon: summary.carbon.average,
    demandMw: summary.demand.average,
    generationMw: mean(snapshots.map(domesticMw)),
    transfersMw: mean(snapshots.map(transfersMw)),
    priceGbpMwh: mean(
      snapshots.map((snapshot) => snapshot.price_mid_gbp_mwh ?? snapshot.price_gbp_mwh)
    ) ?? summary.price.average,
  };
}
