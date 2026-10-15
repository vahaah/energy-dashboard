import { isConstraintBoundary } from "@/lib/constraints/boundaries";
import { CONSTRAINTS_ALLOCATION, CONSTRAINTS_API_DESCRIPTION } from "@/lib/constraints/copy";
import { readPublishedHistory } from "@/lib/constraints/reader";
import type { BreakdownRow, DayAheadRow } from "@/lib/constraints/parse";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED = new Set(["from", "to", "boundary"]);

export type ConstraintsQueryBody = {
  description: typeof CONSTRAINTS_API_DESCRIPTION;
  from: string;
  to: string;
  boundary: string | null;
  allocation: typeof CONSTRAINTS_ALLOCATION;
  boundary_cost: null;
  breakdown: BreakdownRow[];
  day_ahead: Array<DayAheadRow & { kind: "forecast" }>;
};

export async function constraintsQueryResponse(
  params: URLSearchParams,
): Promise<{ status: number; body: ConstraintsQueryBody | { error: string } }> {
  for (const key of params.keys()) {
    if (!ALLOWED.has(key)) {
      return { status: 400, body: { error: "unsupported filter" } };
    }
  }
  const from = params.get("from");
  const to = params.get("to");
  const boundary = params.get("boundary");
  if (!from || !to || !DATE.test(from) || !DATE.test(to) || from > to) {
    return { status: 400, body: { error: "invalid date" } };
  }
  if (boundary != null && boundary.length > 0 && !isConstraintBoundary(boundary)) {
    return { status: 400, body: { error: "unsupported filter" } };
  }
  if (boundary === "") {
    return { status: 400, body: { error: "unsupported filter" } };
  }
  const history = await readPublishedHistory();
  const breakdownRows = history.breakdown.latest?.breakdown ?? [];
  const dayAheadRows = history.dayAhead.latest?.day_ahead ?? [];
  const inRange = (date: string) => date >= from && date <= to;
  const filteredBoundary = boundary && isConstraintBoundary(boundary) ? boundary : null;
  return {
    status: 200,
    body: {
      description: CONSTRAINTS_API_DESCRIPTION,
      from,
      to,
      boundary: filteredBoundary,
      allocation: CONSTRAINTS_ALLOCATION,
      boundary_cost: null,
      breakdown: filteredBoundary ? [] : breakdownRows.filter((row) => inRange(row.settlement_date)),
      day_ahead: dayAheadRows
        .filter((row) => inRange(row.settlement_date) && (filteredBoundary == null || row.boundary === filteredBoundary))
        .map((row) => ({ ...row, kind: "forecast" as const })),
    },
  };
}
