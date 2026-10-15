import { z } from "zod";
import { CONSTRAINT_BOUNDARIES } from "@/lib/constraints/boundaries";
import { BREAKDOWN_CATEGORIES } from "@/lib/constraints/categories";
import { instantSchema } from "@/lib/catalogue/schema";
import { sha256Prefixed } from "@/lib/catalogue/canonical";

export const CONSTRAINT_BUNDLES = ["breakdown", "day-ahead"] as const;
export type ConstraintsBundle = (typeof CONSTRAINT_BUNDLES)[number];

export function isConstraintsBundle(value: string): value is ConstraintsBundle {
  return (CONSTRAINT_BUNDLES as readonly string[]).includes(value);
}

const settlementDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const constraintReleaseSchema = z
  .object({
    schema_version: z.literal(1),
    bundle: z.enum(CONSTRAINT_BUNDLES),
    dataset_id: z.string().min(1),
    period_key: z.string().min(1),
    financial_year: z.string().nullable(),
    extract_sha256: sha,
    source_url: z.string().regex(/^https:\/\/api\.neso\.energy\/\S+$/),
    issued_at: instantSchema,
    retrieved_at: instantSchema,
    row_count: z.number().int().nonnegative(),
    retained_row_count: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    breakdown: z.array(
      z
        .object({
          settlement_date: settlementDate,
          category: z.enum(BREAKDOWN_CATEGORIES),
          cost_gbp: z.number().finite(),
          volume_mwh: z.number().finite(),
        })
        .strict(),
    ),
    day_ahead: z.array(
      z
        .object({
          boundary: z.enum(CONSTRAINT_BOUNDARIES),
          settlement_date: settlementDate,
          wall_time: z.string().min(1),
          interval_start: instantSchema,
          limit_mw: z.number().finite(),
          flow_mw: z.number().finite(),
        })
        .strict(),
    ),
  })
  .strict();

export type ConstraintRelease = z.infer<typeof constraintReleaseSchema>;

export type FetchMeta = {
  bundle: ConstraintsBundle;
  source_url: string;
  issued_at: string;
  financial_year: string | null;
  resource_name: string;
};

export function periodKey(meta: Pick<FetchMeta, "bundle" | "financial_year">): string {
  if (meta.bundle === "breakdown") {
    return `fy:${meta.financial_year ?? ""}`;
  }
  return "day-ahead";
}

/** Same extract hashes to the same id. `retrieved_at` is fixed so a replay does not mint a second file. */
export function constraintReleaseId(release: ConstraintRelease): string {
  const stable = { ...release, retrieved_at: "1970-01-01T00:00:00.000Z" };
  return sha256Prefixed(stable).slice("sha256:".length);
}
