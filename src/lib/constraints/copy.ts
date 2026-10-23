import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";

export const CONSTRAINTS_TITLE = "Grid constraints and their cost | Grid";
export const CONSTRAINTS_H1 = "What stops electricity reaching demand, and what was done about it?";
export const CONSTRAINTS_STANDFIRST = "Published transmission constraint activity, its volume and cost.";

export const CONSTRAINTS_COST_TITLE = "Constraint cost";
export const CONSTRAINTS_COST_SOURCE =
  "Source: NESO (constraints). Published cost of actions taken to manage transmission constraints, £.";
export const CONSTRAINTS_REVISIONS = "Revisions shown.";

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
