import { SCHEME_LABEL, type IdentifierScheme } from "@/lib/directory/copy";
import type { DirectoryIdentifier, DirectorySnapshot } from "@/lib/directory/schema";

export const DIRECTORY_PREVIEW_ROWS = 20;

export type DirectoryPreviewRow = {
  name: string;
  scheme: string;
  code: string;
};

export function directoryOrganisationPreview(snapshot: DirectorySnapshot): DirectoryPreviewRow[] {
  const rows: DirectoryPreviewRow[] = [];
  const organisations = [...snapshot.organisations].sort((left, right) =>
    left.name.localeCompare(right.name, "en-GB"),
  );
  for (const organisation of organisations) {
    const identifier = snapshot.identifiers
      .filter((item) => item.organisation_id === organisation.organisation_id)
      .sort(identifierOrder)[0];
    rows.push({
      name: organisation.name,
      scheme: identifier ? SCHEME_LABEL[identifier.scheme] : "—",
      code: identifier?.code ?? "—",
    });
    if (rows.length >= DIRECTORY_PREVIEW_ROWS) {
      break;
    }
  }
  return rows;
}

export function directoryCodePreview(snapshot: DirectorySnapshot): DirectoryPreviewRow[] {
  const names = new Map(snapshot.organisations.map((organisation) => [organisation.organisation_id, organisation.name]));
  return [...snapshot.identifiers].sort(identifierOrder).slice(0, DIRECTORY_PREVIEW_ROWS).map((identifier) => ({
    name: identifier.organisation_id ? (names.get(identifier.organisation_id) ?? "—") : "—",
    scheme: SCHEME_LABEL[identifier.scheme],
    code: identifier.code,
  }));
}

function identifierOrder(left: DirectoryIdentifier, right: DirectoryIdentifier): number {
  const schemeOrder = schemeRank(left.scheme) - schemeRank(right.scheme);
  if (schemeOrder !== 0) {
    return schemeOrder;
  }
  return left.code.localeCompare(right.code, "en-GB");
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
