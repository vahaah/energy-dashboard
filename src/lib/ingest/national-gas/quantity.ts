export const GAS_QUANTITY_KINDS = [
  "rate",
  "cumulative",
  "day total",
  "stock",
  "forecast",
] as const;

export type GasQuantityKind = (typeof GAS_QUANTITY_KINDS)[number];

/** Bases validated on the October 2026 extracts. `to-date` is not one of them. */
export const GAS_BASES = ["flow", "completed"] as const;

export type GasBasis = (typeof GAS_BASES)[number];

export const GAS_NULL_BEHAVIOUR =
  "A blank Value is null, never 0. A blank Quality Indicator is null.";

const KNOWN_QUALITY = new Set(["", "L"]);

export type GasQuarantineReason =
  | "unknown_publication"
  | "unknown_column"
  | "unknown_enum"
  | "rate_not_summed"
  | "cumulative_not_summed"
  | "stock_not_summed"
  | "forecast_not_summed"
  | "parent_and_child"
  | "unparsed_value"
  | "unparsed_time"
  | "unverified_series"
  | "unrelated_components";

export type GasQuarantine = {
  reason: GasQuarantineReason;
  publication_id: string | null;
  field: string | null;
  value: string | null;
};

export function quarantine(
  reason: GasQuarantineReason,
  publicationId: string | null,
  field: string | null,
  value: string | null,
): GasQuarantine {
  return {
    reason,
    publication_id: publicationId,
    field,
    value,
  };
}

export function takeGasQuantityKind(
  value: string,
  publicationId: string | null = null,
): { ok: true; value: GasQuantityKind } | { ok: false; quarantine: GasQuarantine } {
  return takeEnum("quantity_kind", value, GAS_QUANTITY_KINDS, publicationId);
}

export function takeGasBasis(
  value: string,
  publicationId: string | null = null,
): { ok: true; value: GasBasis } | { ok: false; quarantine: GasQuarantine } {
  return takeEnum("basis", value, GAS_BASES, publicationId);
}

export function takeQuality(
  value: string,
  publicationId: string,
): { ok: true; value: string | null } | { ok: false; quarantine: GasQuarantine } {
  if (!KNOWN_QUALITY.has(value)) {
    return {
      ok: false,
      quarantine: quarantine("unknown_enum", publicationId, "quality", value),
    };
  }
  return { ok: true, value: value.length === 0 ? null : value };
}

function takeEnum<T extends string>(
  field: string,
  value: string,
  allowed: readonly T[],
  publicationId: string | null,
): { ok: true; value: T } | { ok: false; quarantine: GasQuarantine } {
  if ((allowed as readonly string[]).includes(value)) {
    return { ok: true, value: value as T };
  }
  return {
    ok: false,
    quarantine: quarantine("unknown_enum", publicationId, field, value),
  };
}
