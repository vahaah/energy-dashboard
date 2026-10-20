import { z } from "zod";
import { EIRGRID_GROUP_LICENCE_ACCEPTED_READ_ON, EIRGRID_GROUP_LICENCE_URL } from "@/lib/attribution";
import { instantSchema } from "@/lib/catalogue/schema";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { EIRGRID_GEOGRAPHIES, EIRGRID_SOURCE_LINES } from "@/lib/eirgrid/spec";

export const niPointSchema = z
  .object({
    time: instantSchema,
    value: z.number().finite().nullable(),
  })
  .strict();

export const niSeriesSchema = z
  .object({
    metric_id: z.string().min(1),
    geography_id: z.enum(EIRGRID_GEOGRAPHIES),
    source_line: z.enum(EIRGRID_SOURCE_LINES),
    unit: z.string().min(1),
    points: z.array(niPointSchema),
  })
  .strict();

export const niReleaseSchema = z
  .object({
    release_id: z.string().min(1),
    retrieved_at: instantSchema,
    published_at: instantSchema,
    licence_url: z.literal(EIRGRID_GROUP_LICENCE_URL),
    licence_read_on: z.enum(EIRGRID_GROUP_LICENCE_ACCEPTED_READ_ON),
    series: z.array(niSeriesSchema),
  })
  .strict()
  .refine((release) => release.series.every((series) => series.geography_id !== "GB"), "GB is not written into an NI release")
  .refine((release) => !JSON.stringify(release).includes('"UK"'), "UK is not an operational geography on this release");

export type NiRelease = z.infer<typeof niReleaseSchema>;
export type NiSeries = z.infer<typeof niSeriesSchema>;

export type NiReleaseBody = Omit<NiRelease, "release_id" | "retrieved_at">;

export function niReleaseId(body: NiReleaseBody): string {
  return sha256Prefixed(body).slice("sha256:".length);
}

export function buildNiRelease(body: NiReleaseBody, retrievedAt: string): NiRelease {
  return niReleaseSchema.parse({
    ...body,
    release_id: niReleaseId(body),
    retrieved_at: retrievedAt,
  });
}
