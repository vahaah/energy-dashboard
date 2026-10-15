import { z } from "zod";
import { CATALOGUE_SCHEMA_VERSION, instantSchema, isUtcInstant } from "@/lib/catalogue/schema";
import { IDENTIFIER_SCHEMES } from "@/lib/directory/copy";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const civilDateSchema = z.string().refine(isIsoDate, "expected a real YYYY-MM-DD date");

const organisationSchema = z
  .object({
    organisation_id: z.string().regex(/^org_[A-Za-z0-9]+$/),
    name: z.string().min(1),
    recorded_at: instantSchema,
  })
  .strict();

const identifierSchema = z
  .object({
    identifier_id: z.string().regex(/^idn_[a-f0-9]{16}$/),
    organisation_id: z.string().regex(/^org_[A-Za-z0-9]+$/).nullable(),
    scheme: z.enum(IDENTIFIER_SCHEMES),
    code: z.string().min(1).max(32),
    label: z.string().min(1).nullable(),
    effective_from: civilDateSchema.nullable(),
    effective_to: civilDateSchema.nullable(),
    recorded_at: instantSchema,
  })
  .strict();

const roleAssignmentSchema = z
  .object({
    role_assignment_id: z.string().regex(/^rol_[a-f0-9]{16}$/),
    identifier_id: z.string().regex(/^idn_[a-f0-9]{16}$/),
    role_code: z.string().min(1).max(8),
    role_name: z.string().min(1),
    effective_from: civilDateSchema,
    effective_to: civilDateSchema.nullable(),
    recorded_at: instantSchema,
  })
  .strict();

export const directorySnapshotSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    source_id: z.literal("elexon-isd"),
    release_id: z.string().min(1),
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    retrieved_at: instantSchema,
    organisations: z.array(organisationSchema),
    identifiers: z.array(identifierSchema),
    role_assignments: z.array(roleAssignmentSchema),
  })
  .strict();

export const directoryPointerSchema = z
  .object({
    release_id: z.string().min(1),
    generated_at: instantSchema,
  })
  .strict();

export type DirectoryOrganisation = z.infer<typeof organisationSchema>;
export type DirectoryIdentifier = z.infer<typeof identifierSchema>;
export type DirectoryRoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type DirectorySnapshot = z.infer<typeof directorySnapshotSchema>;
export type DirectoryPointer = z.infer<typeof directoryPointerSchema>;

export function isDirectoryInstant(value: string): boolean {
  return isUtcInstant(value);
}
