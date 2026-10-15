import { createHash } from "node:crypto";
import { CATALOGUE_SCHEMA_VERSION } from "@/lib/catalogue/schema";
import { canonicalJson, sha256Prefixed } from "@/lib/catalogue/canonical";
import { isIsoDate, type DirectoryIdentifier, type DirectoryOrganisation, type DirectoryRoleAssignment, type DirectorySnapshot } from "@/lib/directory/schema";
import { cell, columnIndex, parseIsdCsv } from "@/lib/directory/csv";
import { IDENTIFIER_CODE_PATTERN, intervalCovers, type IdentifierScheme } from "@/lib/directory/copy";

const ORGANISATION_HEADER = [
  "Company Registration Number",
  "Registered Company Name",
  "ISO Country Code",
] as const;

const ROLE_HEADER = ["Market Participant Role Code", "Market Role Description"] as const;

const GSP_HEADER = ["GSP Group ID", "GSP Group Name"] as const;

const PARTICIPANT_ROLE_HEADER = [
  "Company Registration Number",
  "Market Participant ID",
  "Market Participant Role Code",
  "Effective From Date {MPR}",
  "Effective To Date {MPR}",
  "Distributor Short Code",
  "Trading Party ID",
] as const;

const BM_UNIT_HEADER = [
  "GSP Group ID",
  "Market Participant (Supplier) ID",
  "Market Participant Role Code",
  "Effective From Date {MPR}",
  "BM Unit ID",
  "Effective From Settlement Date {BMU ID}",
  "Effective To Settlement Date {BMU ID}",
] as const;

export type DirectoryExtracts = {
  organisations: string;
  marketRoles: string;
  gspGroups: string;
  participantRoles: string;
  bmUnits: string;
};

export type BuiltDirectory = {
  snapshot: DirectorySnapshot;
  quarantined: number;
};

type RoleRow = {
  company: string;
  code: string;
  roleCode: string;
  from: string;
  to: string | null;
};

export function buildDirectory(extracts: DirectoryExtracts, recordedAt: string): BuiltDirectory {
  let quarantined = 0;
  const organisations = readOrganisations(extracts.organisations, recordedAt, () => {
    quarantined += 1;
  });
  const roleNames = readRoleNames(extracts.marketRoles, () => {
    quarantined += 1;
  });
  const orgByCompany = new Map(organisations.map((org) => [org.organisation_id.slice("org_".length), org]));
  const roleRows = readParticipantRoles(extracts.participantRoles, orgByCompany, roleNames, () => {
    quarantined += 1;
  });
  const grouped = groupRoles(roleRows);
  const identifiers: DirectoryIdentifier[] = [];
  const roles: DirectoryRoleAssignment[] = [];
  for (const group of grouped.values()) {
    for (const span of coverages(group.rows)) {
      const identifier = identifierForSpan(group, span, recordedAt);
      identifiers.push(identifier);
      for (const row of span.rows) {
        roles.push({
          role_assignment_id: stableId("rol", [identifier.identifier_id, row.roleCode, row.from, row.to ?? ""]),
          identifier_id: identifier.identifier_id,
          role_code: row.roleCode,
          role_name: roleNames.get(row.roleCode) ?? "",
          effective_from: row.from,
          effective_to: row.to,
          recorded_at: recordedAt,
        });
      }
    }
  }
  for (const gsp of readGspGroups(extracts.gspGroups, recordedAt, () => {
    quarantined += 1;
  })) {
    identifiers.push(gsp);
  }
  const bm = readBmUnits(extracts.bmUnits, identifiers, roles, roleNames, recordedAt, () => {
    quarantined += 1;
  });
  identifiers.push(...bm.identifiers);
  roles.push(...bm.roles);

  const snapshot = finishSnapshot(organisations, identifiers, roles, recordedAt);
  return { snapshot, quarantined };
}

function readOrganisations(
  csv: string,
  recordedAt: string,
  quarantine: () => void,
): DirectoryOrganisation[] {
  const { header, rows } = parseIsdCsv(csv);
  const index = columnIndex(header, ORGANISATION_HEADER);
  if (!index) {
    throw new Error("ISD organisation columns changed");
  }
  const seen = new Map<string, DirectoryOrganisation>();
  for (const row of rows) {
    const company = cell(row, index, "Company Registration Number");
    const name = cell(row, index, "Registered Company Name");
    if (!/^[A-Za-z0-9]+$/.test(company) || name.length === 0) {
      quarantine();
      continue;
    }
    const existing = seen.get(company);
    if (existing) {
      if (existing.name !== name) {
        quarantine();
      }
      continue;
    }
    seen.set(company, {
      organisation_id: `org_${company}`,
      name,
      recorded_at: recordedAt,
    });
  }
  return [...seen.values()];
}

function readRoleNames(csv: string, quarantine: () => void): Map<string, string> {
  const { header, rows } = parseIsdCsv(csv);
  const index = columnIndex(header, ROLE_HEADER);
  if (!index) {
    throw new Error("ISD market role columns changed");
  }
  const names = new Map<string, string>();
  for (const row of rows) {
    const code = cell(row, index, "Market Participant Role Code");
    const description = cell(row, index, "Market Role Description");
    if (!code || !description || names.has(code)) {
      quarantine();
      continue;
    }
    names.set(code, description);
  }
  return names;
}

function readParticipantRoles(
  csv: string,
  organisations: Map<string, DirectoryOrganisation>,
  roleNames: Map<string, string>,
  quarantine: () => void,
): RoleRow[] {
  const { header, rows } = parseIsdCsv(csv);
  const index = columnIndex(header, PARTICIPANT_ROLE_HEADER);
  if (!index) {
    throw new Error("ISD market participant role columns changed");
  }
  const parsed: RoleRow[] = [];
  for (const row of rows) {
    const company = cell(row, index, "Company Registration Number");
    const code = cell(row, index, "Market Participant ID");
    const roleCode = cell(row, index, "Market Participant Role Code");
    const from = parseDate(cell(row, index, "Effective From Date {MPR}"));
    const to = parseDate(cell(row, index, "Effective To Date {MPR}"));
    if (
      !organisations.has(company) ||
      !/^[A-Za-z0-9_]{1,32}$/.test(code) ||
      !roleNames.has(roleCode) ||
      !from ||
      to === undefined ||
      (to !== null && to < from)
    ) {
      quarantine();
      continue;
    }
    parsed.push({ company, code, roleCode, from, to });
  }
  return parsed;
}

function groupRoles(rows: readonly RoleRow[]): Map<string, { company: string; code: string; rows: RoleRow[] }> {
  const groups = new Map<string, { company: string; code: string; rows: RoleRow[] }>();
  for (const row of rows) {
    const key = `${row.company}\u001f${row.code}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, { company: row.company, code: row.code, rows: [row] });
    }
  }
  return groups;
}

type CoverageSpan = {
  from: string;
  to: string | null;
  rows: RoleRow[];
};

/** Merge overlapping or next-day role windows. A calendar gap stays a separate identifier. */
function coverages(rows: readonly RoleRow[]): CoverageSpan[] {
  const sorted = [...rows].sort(
    (left, right) => left.from.localeCompare(right.from) || compareEnd(left.to, right.to),
  );
  const spans: CoverageSpan[] = [];
  for (const row of sorted) {
    const last = spans[spans.length - 1];
    if (!last || gapBefore(last.to, row.from)) {
      spans.push({ from: row.from, to: row.to, rows: [row] });
      continue;
    }
    last.rows.push(row);
    last.to = mergeEnd(last.to, row.to);
  }
  return spans;
}

function gapBefore(end: string | null, nextStart: string): boolean {
  if (end === null) {
    return false;
  }
  return nextStart > dayAfter(end);
}

function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function mergeEnd(left: string | null, right: string | null): string | null {
  if (left === null || right === null) {
    return null;
  }
  return left > right ? left : right;
}

function compareEnd(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left.localeCompare(right);
}

function identifierForSpan(
  group: { company: string; code: string },
  span: CoverageSpan,
  recordedAt: string,
): DirectoryIdentifier {
  const organisationId = `org_${group.company}`;
  return {
    identifier_id: stableId("idn", ["MPID", group.code, organisationId, span.from]),
    organisation_id: organisationId,
    scheme: "MPID",
    code: group.code,
    label: null,
    effective_from: span.from,
    effective_to: span.to,
    recorded_at: recordedAt,
  };
}

function readGspGroups(csv: string, recordedAt: string, quarantine: () => void): DirectoryIdentifier[] {
  const { header, rows } = parseIsdCsv(csv);
  const index = columnIndex(header, GSP_HEADER);
  if (!index) {
    throw new Error("ISD GSP group columns changed");
  }
  const seen = new Map<string, DirectoryIdentifier>();
  for (const row of rows) {
    const code = cell(row, index, "GSP Group ID");
    const name = cell(row, index, "GSP Group Name");
    if (!/^[A-Za-z0-9_]{1,32}$/.test(code) || name.length === 0) {
      quarantine();
      continue;
    }
    if (seen.has(code)) {
      quarantine();
      continue;
    }
    seen.set(code, {
      identifier_id: stableId("idn", ["GSP_GROUP", code, "", ""]),
      organisation_id: null,
      scheme: "GSP_GROUP",
      code,
      label: name,
      effective_from: null,
      effective_to: null,
      recorded_at: recordedAt,
    });
  }
  return [...seen.values()];
}

function readBmUnits(
  csv: string,
  identifiers: readonly DirectoryIdentifier[],
  assignments: readonly DirectoryRoleAssignment[],
  roleNames: Map<string, string>,
  recordedAt: string,
  quarantine: () => void,
): { identifiers: DirectoryIdentifier[]; roles: DirectoryRoleAssignment[] } {
  const { header, rows } = parseIsdCsv(csv);
  const index = columnIndex(header, BM_UNIT_HEADER);
  if (!index) {
    throw new Error("ISD BM unit columns changed");
  }
  const bmIdentifiers: DirectoryIdentifier[] = [];
  const bmRoles: DirectoryRoleAssignment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const supplier = cell(row, index, "Market Participant (Supplier) ID");
    const roleCode = cell(row, index, "Market Participant Role Code");
    const code = cell(row, index, "BM Unit ID");
    const from = parseDate(cell(row, index, "Effective From Settlement Date {BMU ID}"));
    const to = parseDate(cell(row, index, "Effective To Settlement Date {BMU ID}"));
    const roleFrom = parseDate(cell(row, index, "Effective From Date {MPR}"));
    const roleName = roleNames.get(roleCode);
    if (
      !IDENTIFIER_CODE_PATTERN.test(code) ||
      !from ||
      to === undefined ||
      (to !== null && to < from) ||
      !roleName ||
      !roleFrom
    ) {
      quarantine();
      continue;
    }
    const holders = assignments.filter((role) => {
      const identifier = identifiers.find((item) => item.identifier_id === role.identifier_id);
      return (
        identifier?.scheme === "MPID" &&
        identifier.code === supplier &&
        role.role_code === roleCode &&
        role.effective_from === roleFrom &&
        intervalCovers(role.effective_from, role.effective_to, from)
      );
    });
    if (holders.length !== 1) {
      quarantine();
      continue;
    }
    const holderRole = holders[0];
    const holder = holderRole
      ? identifiers.find((item) => item.identifier_id === holderRole.identifier_id)
      : undefined;
    if (!holder) {
      quarantine();
      continue;
    }
    const key = `${code}\u001f${holder.organisation_id ?? ""}\u001f${from}`;
    if (seen.has(key)) {
      quarantine();
      continue;
    }
    seen.add(key);
    const identifier: DirectoryIdentifier = {
      identifier_id: stableId("idn", ["BM_UNIT_ID", code, holder.organisation_id ?? "", from]),
      organisation_id: holder.organisation_id,
      scheme: "BM_UNIT_ID",
      code,
      label: null,
      effective_from: from,
      effective_to: to,
      recorded_at: recordedAt,
    };
    bmIdentifiers.push(identifier);
    bmRoles.push({
      role_assignment_id: stableId("rol", [identifier.identifier_id, roleCode, from, to ?? ""]),
      identifier_id: identifier.identifier_id,
      role_code: roleCode,
      role_name: roleName,
      effective_from: from,
      effective_to: to,
      recorded_at: recordedAt,
    });
  }
  return { identifiers: bmIdentifiers, roles: bmRoles };
}

function finishSnapshot(
  organisations: DirectoryOrganisation[],
  identifiers: DirectoryIdentifier[],
  roles: DirectoryRoleAssignment[],
  recordedAt: string,
): DirectorySnapshot {
  const sortedOrganisations = [...organisations].sort((left, right) =>
    left.organisation_id.localeCompare(right.organisation_id),
  );
  const sortedIdentifiers = [...identifiers].sort((left, right) => left.identifier_id.localeCompare(right.identifier_id));
  const sortedRoles = [...roles].sort((left, right) => left.role_assignment_id.localeCompare(right.role_assignment_id));
  const contentHash = sha256Prefixed({
    organisations: sortedOrganisations.map(({ organisation_id, name }) => ({ organisation_id, name })),
    identifiers: sortedIdentifiers.map((item) => ({
      identifier_id: item.identifier_id,
      organisation_id: item.organisation_id,
      scheme: item.scheme,
      code: item.code,
      label: item.label,
      effective_from: item.effective_from,
      effective_to: item.effective_to,
    })),
    role_assignments: sortedRoles.map((item) => ({
      role_assignment_id: item.role_assignment_id,
      identifier_id: item.identifier_id,
      role_code: item.role_code,
      role_name: item.role_name,
      effective_from: item.effective_from,
      effective_to: item.effective_to,
    })),
  });
  return {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    source_id: "elexon-isd",
    release_id: `elexon-isd:directory:${contentHash}`,
    content_hash: contentHash,
    retrieved_at: recordedAt,
    organisations: sortedOrganisations,
    identifiers: sortedIdentifiers,
    role_assignments: sortedRoles,
  };
}

export function stableId(prefix: "idn" | "rol", parts: readonly string[]): string {
  const hex = createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 16);
  return `${prefix}_${hex}`;
}

export function sameCodeDifferentScheme(left: IdentifierScheme, right: IdentifierScheme, code: string): boolean {
  return stableId("idn", [left, code, "", ""]) !== stableId("idn", [right, code, "", ""]);
}

function parseDate(value: string): string | null | undefined {
  if (value.length === 0) {
    return null;
  }
  return isIsoDate(value) ? value : undefined;
}

export function directoryBodyForHash(snapshot: DirectorySnapshot): string {
  return canonicalJson({
    organisations: snapshot.organisations,
    identifiers: snapshot.identifiers,
    role_assignments: snapshot.role_assignments,
  });
}
