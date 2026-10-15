import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const NATIONAL_GAS_CATALOGUE_SHA256 =
  "sha256:4a3800ea98a2053f38da1bee18e846b4401993f0b70697b7e74339ede9127e53";

export const NATIONAL_GAS_CATALOGUE_VERSION = "API Data Item List v2.3.7";

export const NATIONAL_GAS_CATALOGUE_LAST_CHANGE = "05-05-2026";

export const nationalGasCatalogueRowSchema = z
  .object({
    name: z.string().min(1),
    parent: z.string().min(1),
    frequency: z.string().min(1),
    publicationTime: z.string(),
    unitOfMeasure: z.string().min(1),
    timeFrame: z.string(),
    status: z.string().min(1),
    statusChangeDate: z.string().min(1),
    statusChangeDescription: z.string().min(1),
    publicationId: z.string().regex(/^PUB[A-Z0-9]+$/),
    description: z.string(),
  })
  .strict();

export const nationalGasCatalogueSchema = z
  .object({
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    catalogueVersion: z.string().min(1),
    lastChangeDate: z.string().min(1),
    rows: z.array(nationalGasCatalogueRowSchema),
  })
  .strict();

export type NationalGasCatalogue = z.infer<typeof nationalGasCatalogueSchema>;
export type NationalGasCatalogueRow = z.infer<typeof nationalGasCatalogueRowSchema>;

export function nationalGasDir(cwd = process.cwd()): string {
  return join(cwd, "data/catalogue/national-gas");
}

export function loadNationalGasCatalogue(dir = nationalGasDir()): NationalGasCatalogue {
  const parsed = nationalGasCatalogueSchema.parse(
    JSON.parse(readFileSync(join(dir, "catalogue.json"), "utf8")),
  );
  return parsed;
}
