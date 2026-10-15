import { z } from "zod";
import { stableId } from "@/lib/catalogue/assets/ids";

export const STORAGE_FILE = "storage_records.ndjson";

export const STORAGE_REPD_RELEASE_ID = "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z";

export const STORAGE_TECHNOLOGIES = ["pumped_storage", "battery"] as const;
export type StorageTechnology = (typeof STORAGE_TECHNOLOGIES)[number];

export const STORAGE_STATUSES = ["operational", "not_operating"] as const;
export type StorageStatus = (typeof STORAGE_STATUSES)[number];

export const GB_COUNTRIES = ["England", "Scotland", "Wales"] as const;
export type GbCountry = (typeof GB_COUNTRIES)[number];

const id = z.string().regex(/^sto_[a-f0-9]{16}$/);

export const storageRecordSchema = z
  .object({
    record_id: id,
    source_id: z.literal("desnz-repd"),
    source_release_id: z.string().min(1),
    external_ref: z.string().min(1),
    name: z.string().min(1),
    technology: z.enum(STORAGE_TECHNOLOGIES),
    status: z.enum(STORAGE_STATUSES),
    country: z.enum(GB_COUNTRIES),
    rated_mw: z.number().finite().nullable(),
    energy_mwh: z.number().finite().nullable(),
    colocated_ref: z.string().min(1).nullable(),
  })
  .strict();

export type StorageRecord = z.infer<typeof storageRecordSchema>;

export function storageRecordId(externalRef: string): string {
  return stableId("sto", `desnz-repd:storage:${externalRef}`);
}
