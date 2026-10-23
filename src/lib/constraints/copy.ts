import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";

export const CONSTRAINTS_TITLE = "GB grid constraint costs and volumes | Grid";
export const CONSTRAINTS_DESCRIPTION =
  "What NESO spent managing transmission constraints in Great Britain, by day and category (thermal, voltage, inertia), in £ and MWh, from NESO open data.";
export const CONSTRAINTS_H1 = "What stops electricity reaching demand, and what was done about it?";
export const CONSTRAINTS_STANDFIRST = "Published transmission constraint activity, its volume and cost.";

export const CONSTRAINTS_COST_TITLE = "Constraint cost";
export const CONSTRAINTS_COST_SOURCE =
  "Cost of actions NESO took to manage transmission constraints, in £. Source: NESO (constraints).";
export const CONSTRAINTS_REVISIONS = "Revisions shown.";

export function nesoFinancialYearLabel(year: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(year);
  if (!match) {
    return `NESO financial year ${year}.`;
  }
  return `NESO financial year ${match[1]}/${match[2].slice(2)} (from 1 Apr ${match[1]}).`;
}

export function measuredBreakdownLagNote(settlementDate: string): string {
  return `NESO's measured breakdown is published on a delay. The latest settlement date in the file is ${settlementDate}.`;
}

export const CONSTRAINTS_VOLUME_TITLE = "Constraint volume";
export const CONSTRAINTS_VOLUME_SOURCE = "Energy volume of those actions, MWh.";

export const CONSTRAINTS_BOUNDARY_TITLE = "Boundary flow and limit (forecast)";
export const CONSTRAINTS_BOUNDARY_SOURCE = "NESO's day-ahead snapshot.";

export const CONSTRAINTS_API_DESCRIPTION =
  "Published constraint activity. Only the breakdowns the source publishes.";

export const CONSTRAINTS_ALLOCATION =
  "No national cost is allocated to a boundary unless the file carries that allocation.";

export const CONSTRAINTS_ATTRIBUTION = NESO_OPEN_DATA_ATTRIBUTION;

export function dayAheadIssuedLabel(issued: string): string {
  return `Day-ahead forecast, issued ${issued}`;
}
