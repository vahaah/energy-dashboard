import { z } from "zod";
import { NATIONAL_GAS_ATTRIBUTION } from "@/lib/attribution";
import { instantSchema } from "@/lib/catalogue/schema";
import {
  NATIONAL_GAS_CATALOGUE_SHA256,
  NATIONAL_GAS_CATALOGUE_VERSION,
  type NationalGasCatalogue,
} from "@/lib/ingest/national-gas/catalogue";
import type { GasObservation } from "@/lib/ingest/national-gas/parse";
import { DEFERRED_PUBLICATION_IDS, GAS_FAMILIES } from "@/lib/ingest/national-gas/publications";
import { GAS_BASES, GAS_QUANTITY_KINDS, type GasQuarantine } from "@/lib/ingest/national-gas/quantity";
import { applyExclusiveCounts } from "@/lib/ingest/national-gas/total";

export const GAS_SPIKE_RETRIEVED_AT = "2026-10-15T05:22:00.000Z";

export const gasQuarantineSchema = z
  .object({
    reason: z.string().min(1),
    publication_id: z.string().nullable(),
    field: z.string().nullable(),
    value: z.string().nullable(),
  })
  .strict();

export const gasComponentSchema = z
  .object({
    publication_id: z.string().regex(/^PUB[A-Z0-9]+$/),
    metric_id: z.string().regex(/^[a-z0-9]+(?:\.[a-z0-9_]+)+$/),
    name: z.string().min(1),
    unit: z.string().min(1),
    quantity_kind: z.enum(GAS_QUANTITY_KINDS),
    basis: z.enum(GAS_BASES),
    value: z.number().nullable(),
    counts: z.boolean(),
    applicable_at: instantSchema,
    published_at: instantSchema,
    retrieved_at: instantSchema,
    forecast_issued_at: instantSchema.nullable(),
    parent_publication_id: z.string().regex(/^PUB[A-Z0-9]+$/).nullable(),
  })
  .strict()
  .refine(
    (component) =>
      component.quantity_kind === "forecast"
        ? component.forecast_issued_at != null
        : component.forecast_issued_at == null,
    "forecast rows carry forecast_issued_at and other rows do not",
  );

export const gasDaySchema = z
  .object({
    label: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: instantSchema,
    end: instantSchema,
  })
  .strict();

export const gasCoverageSchema = z
  .object({
    geography_id: z.literal("GB_NTS"),
    counted_publication_ids: z.array(z.string()),
    uncounted_publication_ids: z.array(z.string()),
    deferred_publication_ids: z.array(z.string()),
  })
  .strict();

export const gasReleaseSchema = z
  .object({
    gas_release_version: z.literal(1),
    attribution: z.literal(NATIONAL_GAS_ATTRIBUTION),
    catalogue_version: z.literal(NATIONAL_GAS_CATALOGUE_VERSION),
    catalogue_sha256: z.literal(NATIONAL_GAS_CATALOGUE_SHA256),
    gas_day: gasDaySchema,
    bases: z.array(z.enum(GAS_BASES)).min(1),
    coverage: gasCoverageSchema,
    components: z.array(gasComponentSchema),
    quarantine: z.array(gasQuarantineSchema),
  })
  .strict()
  .superRefine((release, ctx) => {
    const counted = new Set(
      release.components.filter((component) => component.counts).map((component) => component.publication_id),
    );
    for (const component of release.components) {
      if (!component.counts) {
        continue;
      }
      if (component.quantity_kind !== "day total") {
        ctx.addIssue({
          code: "custom",
          message: `${component.quantity_kind} ${component.publication_id} must not count in a total`,
        });
      }
    }
    for (const family of GAS_FAMILIES) {
      if (!counted.has(family.parent)) {
        continue;
      }
      for (const child of family.children) {
        if (counted.has(child)) {
          ctx.addIssue({
            code: "custom",
            message: `parent ${family.parent} and child ${child} both count`,
          });
        }
      }
    }
    for (const component of release.components) {
      if (
        component.counts &&
        component.parent_publication_id &&
        counted.has(component.parent_publication_id)
      ) {
        ctx.addIssue({
          code: "custom",
          message: `parent ${component.parent_publication_id} and child ${component.publication_id} both count`,
        });
      }
    }
    const bases = [...release.bases];
    const sorted = [...bases].sort();
    if (bases.join() !== sorted.join() || new Set(bases).size !== bases.length) {
      ctx.addIssue({ code: "custom", message: "bases must be the sorted validated set" });
    }
  });

export type GasRelease = z.infer<typeof gasReleaseSchema>;
export type GasComponent = z.infer<typeof gasComponentSchema>;

export function buildGasRelease(input: {
  catalogue: NationalGasCatalogue;
  observations: readonly GasObservation[];
  quarantine: readonly GasQuarantine[];
  gasDayLabel: string;
  retrievedAt?: string;
}): GasRelease {
  if (
    input.catalogue.catalogueVersion !== NATIONAL_GAS_CATALOGUE_VERSION ||
    input.catalogue.sha256 !== NATIONAL_GAS_CATALOGUE_SHA256
  ) {
    throw new Error("catalogue slice does not match the downloaded catalogue");
  }
  const retrievedAt = input.retrievedAt ?? GAS_SPIKE_RETRIEVED_AT;
  const dayRows = applyExclusiveCounts(
    input.observations.filter((row) => row.gas_day.label === input.gasDayLabel),
  );
  const sample = dayRows[0];
  if (!sample) {
    throw new Error(`no observations for gas day ${input.gasDayLabel}`);
  }
  const components = dayRows
    .map((row) => ({
      publication_id: row.publication_id,
      metric_id: row.metric_id,
      name: row.name,
      unit: row.unit,
      quantity_kind: row.quantity_kind,
      basis: row.basis,
      value: row.value,
      counts: row.counts,
      applicable_at: row.applicable_at,
      published_at: row.published_at,
      retrieved_at: retrievedAt,
      forecast_issued_at: row.forecast_issued_at,
      parent_publication_id: row.parent_publication_id,
    }))
    .sort(compareComponents);

  const bases = [...new Set(components.map((component) => component.basis))].sort();
  const counted = uniqueSorted(components.filter((component) => component.counts).map((component) => component.publication_id));
  const uncounted = uniqueSorted(
    components.filter((component) => !component.counts).map((component) => component.publication_id),
  );

  return {
    gas_release_version: 1,
    attribution: NATIONAL_GAS_ATTRIBUTION,
    catalogue_version: NATIONAL_GAS_CATALOGUE_VERSION,
    catalogue_sha256: NATIONAL_GAS_CATALOGUE_SHA256,
    gas_day: sample.gas_day,
    bases,
    coverage: {
      geography_id: "GB_NTS",
      counted_publication_ids: counted,
      uncounted_publication_ids: uncounted,
      deferred_publication_ids: [...DEFERRED_PUBLICATION_IDS],
    },
    components,
    quarantine: input.quarantine.map((item) => ({ ...item })),
  };
}

function compareComponents(left: GasComponent, right: GasComponent): number {
  return (
    left.publication_id.localeCompare(right.publication_id) ||
    left.applicable_at.localeCompare(right.applicable_at) ||
    left.published_at.localeCompare(right.published_at)
  );
}

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}
