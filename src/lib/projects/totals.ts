import { displayedPercents, formatDisplay, largestRemainder, roundDisplay } from "@/lib/display-rounding";
import type { EnergyProject } from "@/lib/projects/schema";
import type { OperationalStatus } from "@/lib/projects/status";
import { technologyLabel, type ProjectTechnology } from "@/lib/projects/technology";

export const MW_QUANTUM = 0.1;

export type MeasureTotal = {
  total: number;
  totalLabel: string;
  omitted: number;
  included: number;
};

export type TechnologyShare = {
  technology: ProjectTechnology;
  label: string;
  mw: number;
  mwLabel: string;
  percent: number;
  percentLabel: string;
};

export function isOperating(status: OperationalStatus): boolean {
  return status === "operational";
}

export function operatingRatedPower(rows: readonly Pick<EnergyProject, "operational_status" | "power_mw">[]): MeasureTotal {
  const operating = rows.filter((row) => isOperating(row.operational_status));
  const values = operating.map((row) => row.power_mw).filter((value): value is number => value !== null && value >= 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    totalLabel: formatDisplay(roundDisplay(total, MW_QUANTUM), MW_QUANTUM),
    omitted: operating.length - values.length,
    included: values.length,
  };
}

export function proposedRatedPower(
  rows: readonly Pick<EnergyProject, "operational_status" | "power_mw" | "display_stage">[],
): MeasureTotal {
  const proposed = rows.filter((row) => row.operational_status === "proposed");
  const values = proposed.map((row) => row.power_mw).filter((value): value is number => value !== null && value >= 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    totalLabel: formatDisplay(roundDisplay(total, MW_QUANTUM), MW_QUANTUM),
    omitted: proposed.length - values.length,
    included: values.length,
  };
}

export function connectionCapacity(
  rows: readonly Pick<EnergyProject, "connection_capacity_mw">[],
): MeasureTotal {
  const values = rows
    .map((row) => row.connection_capacity_mw)
    .filter((value): value is number => value !== null && value >= 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    totalLabel: formatDisplay(roundDisplay(total, MW_QUANTUM), MW_QUANTUM),
    omitted: rows.length - values.length,
    included: values.length,
  };
}

export function storageEnergy(
  rows: readonly Pick<EnergyProject, "storage_energy_mwh">[],
): MeasureTotal | null {
  const values = rows
    .map((row) => row.storage_energy_mwh)
    .filter((value): value is number => value !== null && value >= 0);
  if (values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    totalLabel: formatDisplay(roundDisplay(total, MW_QUANTUM), MW_QUANTUM),
    omitted: rows.length - values.length,
    included: values.length,
  };
}

export function operatingTechnologyShares(
  rows: readonly Pick<EnergyProject, "operational_status" | "power_mw" | "technology">[],
): TechnologyShare[] {
  const buckets = new Map<ProjectTechnology, number>();
  for (const row of rows) {
    if (!isOperating(row.operational_status) || row.power_mw === null || row.power_mw < 0) {
      continue;
    }
    buckets.set(row.technology, (buckets.get(row.technology) ?? 0) + row.power_mw);
  }
  const technologies = [...buckets.keys()].sort();
  const exact = technologies.map((technology) => buckets.get(technology) ?? 0);
  const shown = largestRemainder(exact, MW_QUANTUM);
  const total = exact.reduce((sum, value) => sum + value, 0);
  const percents = total > 0 ? displayedPercents(exact.map((value) => (value / total) * 100)) : exact.map(() => 0);
  return technologies.map((technology, index) => ({
    technology,
    label: technologyLabel(technology),
    mw: shown[index] ?? 0,
    mwLabel: formatDisplay(shown[index] ?? 0, MW_QUANTUM),
    percent: percents[index] ?? 0,
    percentLabel: String(percents[index] ?? 0),
  }));
}

export function countExcludedFromOperating(
  rows: readonly Pick<EnergyProject, "operational_status" | "power_mw">[],
): number {
  return rows.filter((row) => row.operational_status === "proposed" && row.power_mw !== null).length;
}
