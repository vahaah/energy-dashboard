import { catalogueDatasetId } from "@/lib/catalogue/schema";
import { parseBreakdownCsv, parseDayAheadCsv, sha256Text } from "@/lib/constraints/parse";
import { constraintReleaseSchema, periodKey, type ConstraintRelease, type ConstraintsBundle, type FetchMeta } from "@/lib/constraints/release";

function datasetKey(bundle: ConstraintsBundle): string {
  switch (bundle) {
    case "breakdown":
      return "constraint-breakdown";
    case "day-ahead":
      return "day-ahead-constraint-flows-and-limits";
    default: {
      const exhaustive: never = bundle;
      return exhaustive;
    }
  }
}

export function constraintDatasetId(bundle: ConstraintsBundle): string {
  return catalogueDatasetId("neso-open-data", datasetKey(bundle));
}

export function buildRelease(
  csv: string,
  meta: FetchMeta,
  now: Date,
  bytes = Buffer.byteLength(csv),
): { ok: true; release: ConstraintRelease } | { ok: false; reason: string } {
  const extract = sha256Text(csv);
  if (meta.bundle === "breakdown") {
    const parsed = parseBreakdownCsv(csv);
    if (!parsed.ok) {
      return parsed;
    }
    const release = constraintReleaseSchema.parse({
      schema_version: 1,
      bundle: "breakdown",
      dataset_id: constraintDatasetId("breakdown"),
      period_key: periodKey(meta),
      financial_year: meta.financial_year,
      extract_sha256: extract,
      source_url: meta.source_url,
      issued_at: meta.issued_at,
      retrieved_at: now.toISOString(),
      row_count: parsed.rowCount,
      retained_row_count: parsed.rows.length,
      bytes,
      breakdown: parsed.rows,
      day_ahead: [],
    });
    return { ok: true, release };
  }
  const parsed = parseDayAheadCsv(csv);
  if (!parsed.ok) {
    return parsed;
  }
  const release = constraintReleaseSchema.parse({
    schema_version: 1,
    bundle: "day-ahead",
    dataset_id: constraintDatasetId("day-ahead"),
    period_key: periodKey(meta),
    financial_year: null,
    extract_sha256: extract,
    source_url: meta.source_url,
    issued_at: meta.issued_at,
    retrieved_at: now.toISOString(),
    row_count: parsed.rowCount,
    retained_row_count: parsed.rows.length,
    bytes,
    breakdown: [],
    day_ahead: parsed.rows,
  });
  return { ok: true, release };
}
