import { z } from "zod";
import raw from "../../../data/power-cuts/ofgem-ci-cml.json";

export const ofgemCiCmlSchema = z
  .object({
    source_url: z.string().regex(/^https:\/\/\S+$/),
    page_url: z.string().regex(/^https:\/\/\S+$/),
    published: z.string(),
    year: z.string(),
    ci_unit: z.literal("interruptions per 100 customers"),
    cml_unit: z.literal("minutes"),
    licence: z.string(),
    attribution: z.string(),
    note: z.string(),
    rows: z.array(
      z
        .object({
          label: z.string(),
          name: z.string(),
          ci: z.number().finite(),
          ci_target: z.number().finite(),
          cml: z.number().finite(),
          cml_target: z.number().finite(),
        })
        .strict(),
    ),
  })
  .strict();

export type OfgemCiCml = z.infer<typeof ofgemCiCmlSchema>;

export function loadOfgemCiCml(): OfgemCiCml | null {
  const parsed = ofgemCiCmlSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
