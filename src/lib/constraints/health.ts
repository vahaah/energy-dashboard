import { CONSTRAINT_METRICS, type ConstraintMetricId } from "@/lib/metrics";
import { readBlobHistory } from "@/lib/constraints/reader";
import type { ConstraintRelease } from "@/lib/constraints/release";

export type ConstraintObservation = {
  metricId: ConstraintMetricId;
  value: number | null;
  publishedAt: string | null;
  retrievedAt: string | null;
};

const COST_CATEGORY = {
  "elec.gb.constraints.cost.reducing_largest_loss": "reducing_largest_loss",
  "elec.gb.constraints.cost.increasing_system_inertia": "increasing_system_inertia",
  "elec.gb.constraints.cost.voltage": "voltage",
  "elec.gb.constraints.cost.thermal": "thermal",
} as const;

const VOLUME_CATEGORY = {
  "elec.gb.constraints.volume.reducing_largest_loss": "reducing_largest_loss",
  "elec.gb.constraints.volume.increasing_system_inertia": "increasing_system_inertia",
  "elec.gb.constraints.volume.voltage": "voltage",
  "elec.gb.constraints.volume.thermal": "thermal",
} as const;

export function constraintMetricLabel(id: ConstraintMetricId): string {
  switch (id) {
    case "elec.gb.constraints.cost.reducing_largest_loss":
      return "Reducing largest loss cost";
    case "elec.gb.constraints.cost.increasing_system_inertia":
      return "Increasing system inertia cost";
    case "elec.gb.constraints.cost.voltage":
      return "Voltage constraint cost";
    case "elec.gb.constraints.cost.thermal":
      return "Thermal constraint cost";
    case "elec.gb.constraints.volume.reducing_largest_loss":
      return "Reducing largest loss volume";
    case "elec.gb.constraints.volume.increasing_system_inertia":
      return "Increasing system inertia volume";
    case "elec.gb.constraints.volume.voltage":
      return "Voltage constraint volume";
    case "elec.gb.constraints.volume.thermal":
      return "Thermal constraint volume";
    case "elec.gb.constraints.day_ahead.flow":
      return "Day-ahead boundary flow";
    case "elec.gb.constraints.day_ahead.limit":
      return "Day-ahead boundary limit";
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

export function constraintObservations(
  releases: { breakdown: ConstraintRelease | null; dayAhead: ConstraintRelease | null },
): ConstraintObservation[] {
  return (Object.keys(CONSTRAINT_METRICS) as ConstraintMetricId[]).map((metricId) => {
    const metric = CONSTRAINT_METRICS[metricId];
    const observed = metric.kind === "forecast" ? newestBoundary(metricId, releases.dayAhead) : latestCategory(metricId, releases.breakdown);
    return { metricId, ...observed };
  });
}

export async function loadConstraintObservations(): Promise<ConstraintObservation[]> {
  try {
    return constraintObservations(await readBlobHistory());
  } catch {
    return constraintObservations({ breakdown: null, dayAhead: null });
  }
}

function latestCategory(
  metricId: ConstraintMetricId,
  release: ConstraintRelease | null,
): { value: number | null; publishedAt: string | null; retrievedAt: string | null } {
  if (!release) {
    return { value: null, publishedAt: null, retrievedAt: null };
  }
  const cost = metricId in COST_CATEGORY ? COST_CATEGORY[metricId as keyof typeof COST_CATEGORY] : null;
  const volume = metricId in VOLUME_CATEGORY ? VOLUME_CATEGORY[metricId as keyof typeof VOLUME_CATEGORY] : null;
  const category = cost ?? volume;
  if (!category) {
    return { value: null, publishedAt: null, retrievedAt: release.retrieved_at };
  }
  const rows = release.breakdown.filter((row) => row.category === category);
  const latest = [...rows].sort((left, right) => left.settlement_date.localeCompare(right.settlement_date)).at(-1);
  if (!latest) {
    return { value: null, publishedAt: null, retrievedAt: release.retrieved_at };
  }
  return {
    value: cost ? latest.cost_gbp : latest.volume_mwh,
    publishedAt: `${latest.settlement_date}T00:00:00.000Z`,
    retrievedAt: release.retrieved_at,
  };
}

function newestBoundary(
  metricId: ConstraintMetricId,
  release: ConstraintRelease | null,
): { value: number | null; publishedAt: string | null; retrievedAt: string | null } {
  if (!release || release.day_ahead.length === 0) {
    return { value: null, publishedAt: null, retrievedAt: release?.retrieved_at ?? null };
  }
  const newest = [...release.day_ahead].sort((left, right) => {
    const time = left.interval_start.localeCompare(right.interval_start);
    return time !== 0 ? time : left.boundary.localeCompare(right.boundary);
  }).at(-1);
  if (!newest) {
    return { value: null, publishedAt: release.issued_at, retrievedAt: release.retrieved_at };
  }
  const flow = metricId === "elec.gb.constraints.day_ahead.flow";
  return {
    value: flow ? newest.flow_mw : newest.limit_mw,
    publishedAt: release.issued_at,
    retrievedAt: release.retrieved_at,
  };
}
