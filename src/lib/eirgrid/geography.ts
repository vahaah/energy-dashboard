import type { EirgridGeography } from "@/lib/eirgrid/spec";

export const OPERATIONAL_GEOGRAPHIES = ["GB", "NI", "IE", "ALL_ISLAND"] as const;

export type OperationalGeography = (typeof OPERATIONAL_GEOGRAPHIES)[number];

export type GeographyResult =
  | { ok: true; geography_id: OperationalGeography }
  | { ok: false; error: "unsupported_dimension" };

/**
 * UK is the annual statistical geography. An operational electricity metric
 * does not accept it. GB, NI, Ireland, and all-island stay separate.
 */
export function resolveOperationalGeography(geographyId: string): GeographyResult {
  switch (geographyId) {
    case "GB":
    case "NI":
    case "IE":
    case "ALL_ISLAND":
      return { ok: true, geography_id: geographyId };
    case "UK":
      return { ok: false, error: "unsupported_dimension" };
    default:
      return { ok: false, error: "unsupported_dimension" };
  }
}

export function isOperationalMetric(metric: { expected_cadence: string }): boolean {
  return metric.expected_cadence !== "P1Y";
}

/** `geography_id=UK` on an operational metric is unsupported_dimension. */
export function readOperationalMetric(
  metric: { geography_id: string; expected_cadence: string },
  requestedGeography?: string,
): GeographyResult {
  const geography = requestedGeography ?? metric.geography_id;
  if (isOperationalMetric(metric) && geography === "UK") {
    return { ok: false, error: "unsupported_dimension" };
  }
  return resolveOperationalGeography(geography);
}

/**
 * One scope, or unsupported_dimension. GB and NI are never added together.
 * UK is never an operational total.
 */
export function combineOperationalGeographies(scopes: readonly string[]): GeographyResult {
  if (scopes.length === 0 || scopes.includes("UK")) {
    return { ok: false, error: "unsupported_dimension" };
  }
  if (scopes.includes("GB") && scopes.includes("NI")) {
    return { ok: false, error: "unsupported_dimension" };
  }
  const unique = [...new Set(scopes)];
  if (unique.length !== 1) {
    return { ok: false, error: "unsupported_dimension" };
  }
  return resolveOperationalGeography(unique[0] ?? "");
}

export function isStoredEirgridGeography(value: string): value is Exclude<EirgridGeography, "GB"> {
  return value === "NI" || value === "IE" || value === "ALL_ISLAND";
}
