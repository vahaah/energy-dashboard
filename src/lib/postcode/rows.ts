import { z } from "zod";
import { isCiRegionId, type CiRegionId } from "@/lib/postcode/areas";

export const POSTCODE_DATASET_ID = "ons-nspl:nspl";

export type LocalAuthority = { code: string; name: string };
export type DnoArea = { id: string; name: string };
export type StoredCarbonRegion = { id: number; name: string };
export type CarbonRegion = { id: CiRegionId; name: string };

/** One postcode in the lookup. The three areas are whatever the build stored. */
export type PostcodeRow = {
  la: LocalAuthority | null;
  dno: DnoArea | null;
  ci: StoredCarbonRegion | null;
  terminated: boolean;
};

const areaSchema = z.object({ code: z.string().min(1), name: z.string().min(1) }).strict();
const namedSchema = z.object({ id: z.string().min(1), name: z.string().min(1) }).strict();
const carbonSchema = z.object({ id: z.number().int(), name: z.string().min(1) }).strict();

export const postcodeRowSchema = z
  .object({
    la: areaSchema.nullable(),
    dno: namedSchema.nullable(),
    ci: carbonSchema.nullable(),
    terminated: z.boolean(),
  })
  .strict();

const NORMALISED = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

export const postcodeLookupFileSchema = z
  .object({
    rows: z.record(z.string().regex(NORMALISED), postcodeRowSchema),
  })
  .strict();

export type PostcodeLookupFile = z.infer<typeof postcodeLookupFileSchema>;

/** A stored region id outside 1–14 is not sent upstream and is not returned. */
export function carbonRegionOf(stored: StoredCarbonRegion | null): CarbonRegion | null {
  if (!stored || !isCiRegionId(stored.id)) {
    return null;
  }
  return { id: stored.id, name: stored.name };
}
