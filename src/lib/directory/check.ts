import { REDISTRIBUTION_NOT_PERMITTED } from "@/lib/directory/copy";
import { buildDirectory } from "@/lib/directory/build";
import { lookupByCode, lookupByName, organisationNames } from "@/lib/directory/lookup";
import { fixtureDirectoryExtracts } from "@/lib/directory/reader";
import { directorySnapshotSchema } from "@/lib/directory/schema";

const EFFECTIVE_ON = "2026-10-15";

/** Fixture contract for publish-check. Synthetic rows, not an ISD extract. */
export function checkDirectoryFixtures(cwd = process.cwd()): string[] {
  const errors: string[] = [];
  let built;
  try {
    built = buildDirectory(fixtureDirectoryExtracts(cwd), "2026-10-15T06:15:00.000Z");
  } catch (error) {
    return [error instanceof Error ? error.message : "directory fixture failed"];
  }
  const parsed = directorySnapshotSchema.safeParse(built.snapshot);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `directory ${issue.path.join(".")}: ${issue.message}`);
  }
  const snapshot = parsed.data;
  const encoded = JSON.stringify(snapshot);
  for (const forbidden of ["Distributor Short Code", "Trading Party ID", "ISO Country Code", "Company Registration Number"]) {
    if (encoded.includes(forbidden)) {
      errors.push(`directory snapshot stores ${forbidden}`);
    }
  }
  const sharedNames = [...organisationNames(snapshot).values()].filter((group) => group.length > 1);
  if (sharedNames.length === 0) {
    errors.push("directory fixture merged organisations that share a name");
  }
  for (const group of sharedNames) {
    const ids = new Set(group.map((org) => org.organisation_id));
    if (ids.size !== group.length) {
      errors.push("directory fixture reused an organisation id for a shared name");
    }
  }
  const npow = lookupByCode(snapshot, "MPID", "NPOW", EFFECTIVE_ON);
  if (npow.matches.length < 2) {
    errors.push("directory fixture merged one MPID across organisations");
  }
  const expired = npow.matches
    .flatMap((match) => match.identifiers)
    .flatMap((identifier) => identifier.roles)
    .find((role) => role.role_code === "X" && role.effective_to === "2020-01-01");
  if (!expired || expired.current) {
    errors.push("expired directory role is current");
  }
  const names = lookupByName(snapshot, "North Power Limited", EFFECTIVE_ON);
  if (names.matches.length !== 2) {
    errors.push("name lookup merged organisations");
  }
  const gsp = lookupByCode(snapshot, "GSP_GROUP", "_A", EFFECTIVE_ON);
  const mpid = lookupByCode(snapshot, "MPID", "_A", EFFECTIVE_ON);
  if (gsp.matches.length !== 1 || mpid.matches.length !== 0) {
    errors.push("GSP group namespace collided with MPID");
  }
  if (built.quarantined < 2) {
    errors.push("directory fixture accepted a bad role row");
  }
  if (encoded.includes("BAD1") || encoded.includes("BAD2")) {
    errors.push("quarantined codes were stored");
  }
  if (REDISTRIBUTION_NOT_PERMITTED.length === 0) {
    errors.push("redistribution refusal is empty");
  }
  return errors;
}
