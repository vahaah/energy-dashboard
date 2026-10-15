import {
  IDENTIFIER_CODE_PATTERN,
  intervalCovers,
  isIdentifierScheme,
  REDISTRIBUTION_NOT_PERMITTED,
  RESOLVE_CODE_LIMIT,
  type IdentifierScheme,
} from "@/lib/directory/copy";
import type { DirectoryIdentifier, DirectoryOrganisation, DirectoryRoleAssignment, DirectorySnapshot } from "@/lib/directory/schema";

export type LookupRole = {
  role_code: string;
  role_name: string;
  effective_from: string;
  effective_to: string | null;
  current: boolean;
};

export type LookupIdentifier = {
  scheme: IdentifierScheme;
  code: string;
  label: string | null;
  effective_from: string | null;
  effective_to: string | null;
  dated: boolean;
  current: boolean | null;
  roles: LookupRole[];
};

export type LookupMatch = {
  organisation: { organisation_id: string; name: string } | null;
  identifiers: LookupIdentifier[];
};

export type LookupResult = {
  effective_on: string;
  truncated: boolean;
  matches: LookupMatch[];
};

const NAME_LIMIT = 20;

export function lookupByCode(
  snapshot: DirectorySnapshot,
  scheme: IdentifierScheme,
  code: string,
  effectiveOn: string,
): LookupResult {
  const hits = snapshot.identifiers.filter((item) => item.scheme === scheme && item.code === code);
  const matches = hits.map((identifier) => matchFor(snapshot, identifier, effectiveOn));
  return { effective_on: effectiveOn, truncated: false, matches };
}

export function lookupByName(snapshot: DirectorySnapshot, name: string, effectiveOn: string): LookupResult {
  const needle = name.trim().toLocaleLowerCase("en-GB");
  const organisations = snapshot.organisations.filter((org) => org.name.toLocaleLowerCase("en-GB").includes(needle));
  const truncated = organisations.length > NAME_LIMIT;
  const matches = organisations.slice(0, NAME_LIMIT).map((org) => ({
    organisation: { organisation_id: org.organisation_id, name: org.name },
    identifiers: snapshot.identifiers
      .filter((item) => item.organisation_id === org.organisation_id)
      .sort(identifierOrder)
      .map((identifier) => presentIdentifier(snapshot, identifier, effectiveOn)),
  }));
  return { effective_on: effectiveOn, truncated, matches };
}

export type ResolveQuery = {
  scheme: IdentifierScheme;
  code: string;
};

export function resolveCodes(
  snapshot: DirectorySnapshot,
  effectiveOn: string,
  queries: readonly ResolveQuery[],
): LookupResult[] {
  return queries.map((query) => lookupByCode(snapshot, query.scheme, query.code, effectiveOn));
}

export function resolveLogFields(count: number): { count: number } {
  return { count };
}

export type ParsedLookup =
  | { ok: true; kind: "code"; scheme: IdentifierScheme; code: string; effectiveOn: string }
  | { ok: true; kind: "name"; name: string; effectiveOn: string }
  | { ok: false; status: 400 | 403; error: string };

export function parseLookupSearch(params: URLSearchParams): ParsedLookup {
  if (params.has("export") || params.get("format") === "csv" || params.get("format") === "zip") {
    return { ok: false, status: 403, error: REDISTRIBUTION_NOT_PERMITTED };
  }
  const effectiveOn = params.get("effective_on") ?? "";
  if (!isCivilDate(effectiveOn)) {
    return { ok: false, status: 400, error: "effective_on must be YYYY-MM-DD" };
  }
  const name = params.get("name");
  const schemeRaw = params.get("scheme");
  const code = params.get("code");
  if (name !== null && name.trim().length > 0) {
    if (schemeRaw || code) {
      return { ok: false, status: 400, error: "name lookup takes a name on its own" };
    }
    if (name.trim().length < 2 || name.trim().length > 80) {
      return { ok: false, status: 400, error: "name must be 2 to 80 characters" };
    }
    return { ok: true, kind: "name", name: name.trim(), effectiveOn };
  }
  if (!schemeRaw || !isIdentifierScheme(schemeRaw)) {
    return { ok: false, status: 400, error: "scheme must be MPID, BM_UNIT_ID, or GSP_GROUP" };
  }
  if (!code || !IDENTIFIER_CODE_PATTERN.test(code)) {
    return { ok: false, status: 400, error: "code is required" };
  }
  return { ok: true, kind: "code", scheme: schemeRaw, code, effectiveOn };
}

export type ParsedResolve =
  | { ok: true; effectiveOn: string; queries: ResolveQuery[] }
  | { ok: false; status: 400 | 403; error: string };

export function parseResolveBody(body: unknown): ParsedResolve {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "expected a JSON object" };
  }
  const record = body as Record<string, unknown>;
  if ("export" in record) {
    return { ok: false, status: 403, error: REDISTRIBUTION_NOT_PERMITTED };
  }
  const effectiveOn = record.effective_on;
  if (typeof effectiveOn !== "string" || !isCivilDate(effectiveOn)) {
    return { ok: false, status: 400, error: "effective_on must be YYYY-MM-DD" };
  }
  const queries = record.queries;
  if (!Array.isArray(queries) || queries.length === 0) {
    return { ok: false, status: 400, error: "queries must list at least one code" };
  }
  if (queries.length > RESOLVE_CODE_LIMIT) {
    return { ok: false, status: 400, error: `resolve accepts at most ${RESOLVE_CODE_LIMIT} codes` };
  }
  const parsed: ResolveQuery[] = [];
  for (const query of queries) {
    if (!query || typeof query !== "object") {
      return { ok: false, status: 400, error: "each query needs a scheme and a code" };
    }
    const item = query as Record<string, unknown>;
    if (typeof item.scheme !== "string" || !isIdentifierScheme(item.scheme)) {
      return { ok: false, status: 400, error: "scheme must be MPID, BM_UNIT_ID, or GSP_GROUP" };
    }
    if (typeof item.code !== "string" || !IDENTIFIER_CODE_PATTERN.test(item.code)) {
      return { ok: false, status: 400, error: "code is required" };
    }
    parsed.push({ scheme: item.scheme, code: item.code });
  }
  return { ok: true, effectiveOn, queries: parsed };
}

function matchFor(
  snapshot: DirectorySnapshot,
  identifier: DirectoryIdentifier,
  effectiveOn: string,
): LookupMatch {
  return {
    organisation: organisationOf(snapshot, identifier.organisation_id),
    identifiers: [presentIdentifier(snapshot, identifier, effectiveOn)],
  };
}

function presentIdentifier(
  snapshot: DirectorySnapshot,
  identifier: DirectoryIdentifier,
  effectiveOn: string,
): LookupIdentifier {
  const dated = identifier.effective_from !== null;
  const roles = snapshot.role_assignments
    .filter((role) => role.identifier_id === identifier.identifier_id)
    .map((role) => presentRole(role, effectiveOn))
    .sort((left, right) => left.effective_from.localeCompare(right.effective_from) || left.role_code.localeCompare(right.role_code));
  return {
    scheme: identifier.scheme,
    code: identifier.code,
    label: identifier.label,
    effective_from: identifier.effective_from,
    effective_to: identifier.effective_to,
    dated,
    current: dated ? intervalCovers(identifier.effective_from, identifier.effective_to, effectiveOn) : null,
    roles,
  };
}

function presentRole(role: DirectoryRoleAssignment, effectiveOn: string): LookupRole {
  return {
    role_code: role.role_code,
    role_name: role.role_name,
    effective_from: role.effective_from,
    effective_to: role.effective_to,
    current: intervalCovers(role.effective_from, role.effective_to, effectiveOn),
  };
}

function organisationOf(
  snapshot: DirectorySnapshot,
  organisationId: string | null,
): { organisation_id: string; name: string } | null {
  if (!organisationId) {
    return null;
  }
  const organisation = snapshot.organisations.find((item) => item.organisation_id === organisationId);
  return organisation ? { organisation_id: organisation.organisation_id, name: organisation.name } : null;
}

function identifierOrder(left: DirectoryIdentifier, right: DirectoryIdentifier): number {
  const schemeOrder = schemeRank(left.scheme) - schemeRank(right.scheme);
  if (schemeOrder !== 0) {
    return schemeOrder;
  }
  return left.code.localeCompare(right.code);
}

function schemeRank(scheme: IdentifierScheme): number {
  switch (scheme) {
    case "MPID":
      return 0;
    case "BM_UNIT_ID":
      return 1;
    case "GSP_GROUP":
      return 2;
    default: {
      const exhaustive: never = scheme;
      return exhaustive;
    }
  }
}

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function organisationNames(snapshot: DirectorySnapshot): Map<string, DirectoryOrganisation[]> {
  const byName = new Map<string, DirectoryOrganisation[]>();
  for (const organisation of snapshot.organisations) {
    const key = organisation.name;
    const list = byName.get(key);
    if (list) {
      list.push(organisation);
    } else {
      byName.set(key, [organisation]);
    }
  }
  return byName;
}
