import { GAS_FAMILIES } from "@/lib/ingest/national-gas/publications";
import type { GasObservation } from "@/lib/ingest/national-gas/parse";
import { quarantine, type GasQuarantine, type GasQuantityKind } from "@/lib/ingest/national-gas/quantity";

export type DayTotal =
  | { ok: true; value: number; unit: string; publication_ids: string[] }
  | { ok: false; quarantine: GasQuarantine[] };

type Counted = GasObservation & { counts: boolean };

/** Parent stays. Children in the same set lose `counts`. */
export function applyExclusiveCounts(rows: readonly GasObservation[]): GasObservation[] {
  const present = new Set(rows.map((row) => row.publication_id));
  const blocked = new Set<string>();
  for (const family of GAS_FAMILIES) {
    if (!present.has(family.parent)) {
      continue;
    }
    for (const child of family.children) {
      blocked.add(child);
    }
    for (const row of rows) {
      if (row.parent_publication_id === family.parent && row.publication_id !== family.parent) {
        blocked.add(row.publication_id);
      }
    }
  }
  return rows.map((row) => (blocked.has(row.publication_id) ? { ...row, counts: false } : row));
}

/**
 * Day-total readings of one publication only.
 * Rates, cumulative readings, stocks and forecasts are refused and not added.
 */
export function sumDayTotals(rows: readonly GasObservation[]): DayTotal {
  const exclusive = applyExclusiveCounts(rows);
  const counted = exclusive.filter((row) => row.counts);
  const refused = refuseUnsummable(counted);
  if (refused.length > 0) {
    return { ok: false, quarantine: refused };
  }
  const dayTotals = counted.filter((row) => row.quantity_kind === "day total");
  const publicationIds = [...new Set(dayTotals.map((row) => row.publication_id))];
  const units = [...new Set(dayTotals.map((row) => row.unit))];
  if (dayTotals.length !== 1 || publicationIds.length !== 1 || units.length !== 1) {
    return {
      ok: false,
      quarantine: [
        quarantine(
          "unrelated_components",
          publicationIds[0] ?? null,
          "publication_id",
          publicationIds.join(","),
        ),
      ],
    };
  }
  const row = dayTotals[0];
  if (!row || row.value == null) {
    return {
      ok: false,
      quarantine: [quarantine("unparsed_value", row?.publication_id ?? null, "Value", null)],
    };
  }
  return {
    ok: true,
    value: row.value,
    unit: row.unit,
    publication_ids: [row.publication_id],
  };
}

/** True when the children add up to the parent with no rounding gap. */
export function partsReconcile(parent: number, children: readonly number[]): boolean {
  if (children.length === 0) {
    return false;
  }
  return children.reduce((total, value) => total + value, 0) === parent;
}

function refuseUnsummable(rows: readonly Counted[]): GasQuarantine[] {
  const found: GasQuarantine[] = [];
  for (const row of rows) {
    const reason = unsummableReason(row.quantity_kind);
    if (!reason) {
      continue;
    }
    found.push(quarantine(reason, row.publication_id, "quantity_kind", row.quantity_kind));
  }
  return found;
}

function unsummableReason(
  kind: GasQuantityKind,
): "rate_not_summed" | "cumulative_not_summed" | "stock_not_summed" | "forecast_not_summed" | null {
  switch (kind) {
    case "rate":
      return "rate_not_summed";
    case "cumulative":
      return "cumulative_not_summed";
    case "stock":
      return "stock_not_summed";
    case "forecast":
      return "forecast_not_summed";
    case "day total":
      return null;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}
