import type { InterconnectorFlow } from "@/lib/types";

export const SPARK_HOURS = 24;
export const SPARK_STEP_MINUTES = 60;

export type HourlySpark = {
  start: string;
  stepMinutes: typeof SPARK_STEP_MINUTES;
  values: (number | null)[];
};

export type ElectricitySeries = {
  code: string;
  latestMw: number | null;
  latestAt: string | null;
  spark: HourlySpark | null;
};

export type ElectricityFlowsRelease = {
  generated_at: string;
  series: ElectricitySeries[];
};

function hourIndex(at: number, origin: number): number {
  return Math.floor((at - origin) / (SPARK_STEP_MINUTES * 60 * 1000));
}

/** Last sample in each of the 24 hours up to the newest reading. Missing hours stay null. */
export function compactElectricity(rows: readonly InterconnectorFlow[], now: Date): ElectricityFlowsRelease {
  const byCode = new Map<string, InterconnectorFlow[]>();
  for (const row of rows) {
    const code = row.interconnector.toUpperCase();
    if (!code.startsWith("INT") || code === "INTNESO") {
      continue;
    }
    const at = Date.parse(row.timestamp);
    if (!Number.isFinite(at) || !Number.isFinite(row.generation_mw)) {
      continue;
    }
    const list = byCode.get(code) ?? [];
    list.push(row);
    byCode.set(code, list);
  }

  const series: ElectricitySeries[] = [];
  for (const [code, list] of byCode) {
    list.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const latest = list[list.length - 1];
    if (!latest) {
      continue;
    }
    const end = Date.parse(latest.timestamp);
    const origin = end - (SPARK_HOURS - 1) * SPARK_STEP_MINUTES * 60 * 1000;
    const values: (number | null)[] = Array.from({ length: SPARK_HOURS }, () => null);
    for (const row of list) {
      const index = hourIndex(Date.parse(row.timestamp), origin);
      if (index >= 0 && index < SPARK_HOURS) {
        values[index] = row.generation_mw;
      }
    }
    series.push({
      code,
      latestMw: latest.generation_mw,
      latestAt: new Date(end).toISOString(),
      spark: { start: new Date(origin).toISOString(), stepMinutes: SPARK_STEP_MINUTES, values },
    });
  }
  series.sort((left, right) => left.code.localeCompare(right.code));
  return { generated_at: now.toISOString(), series };
}
