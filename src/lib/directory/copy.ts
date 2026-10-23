import { formatLondonDayMonthYear } from "@/lib/london-time";

export const DIRECTORY_TITLE = "GB electricity market organisations and codes | Grid";
export const DIRECTORY_DESCRIPTION =
  "Find who is behind a GB electricity market name or code: organisations, MPIDs and their roles with dates, from Elexon Industry Standing Data.";
export const DIRECTORY_H1 = "Who is behind this name or code?";
export const DIRECTORY_STANDFIRST =
  "Organisations, their identifiers and their published roles, with dates.";

export const IDENTIFIERS_TITLE = "MPID, BM Unit ID and GSP group lookup | Grid";
export const IDENTIFIERS_DESCRIPTION =
  "Which organisation held an MPID, BM Unit ID or GSP group code on a given date in the GB electricity market. Free lookup of Elexon standing data.";
export const IDENTIFIERS_H1 = "Which organisation does this code belong to, and when?";
export const IDENTIFIERS_STANDFIRST = "Search a code. Choose a date to see what applied then.";

export const MPID_LABEL =
  "Market Participant ID: identifies an organisation in electricity settlement. Not a meter number (MPAN).";

export const ROLE_LABEL = "The role the source lists for this identifier between the dates shown.";

export const DIRECTORY_FAQS = [
  {
    question: "What is an MPID?",
    answer:
      "A Market Participant ID identifies an organisation in electricity settlement. It is not a meter number (MPAN).",
  },
  {
    question: "Can I download the data?",
    answer:
      "No. Elexon has not identified Industry Standing Data as open data, so Grid does not offer a download.",
  },
] as const;

export const REDISTRIBUTION_NOT_PERMITTED = "redistribution not permitted";

export const RESOLVE_CODE_LIMIT = 20;

export const IDENTIFIER_SCHEMES = ["MPID", "BM_UNIT_ID", "GSP_GROUP"] as const;

/** Lookup alphabet. BM Unit IDs include a hyphen (`T_ABCD-1`). */
export const IDENTIFIER_CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export type IdentifierScheme = (typeof IDENTIFIER_SCHEMES)[number];

export const SCHEME_LABEL: Record<IdentifierScheme, string> = {
  MPID: "MPID",
  BM_UNIT_ID: "BM Unit ID",
  GSP_GROUP: "GSP group",
};

export const SCHEME_INTRO: Record<IdentifierScheme, string> = {
  MPID: MPID_LABEL,
  BM_UNIT_ID: "BM Unit ID: a balancing-mechanism unit. The code can include a hyphen.",
  GSP_GROUP: "GSP group: the grid supply point group this code belongs to.",
};

export const SCHEME_ROLE: Record<IdentifierScheme, string> = {
  MPID: ROLE_LABEL,
  BM_UNIT_ID: "The participant role with the same MPID, role code, and Effective From Date.",
  GSP_GROUP: "The role the source lists for this GSP group between the dates shown.",
};

export function isIdentifierScheme(value: string): value is IdentifierScheme {
  switch (value) {
    case "MPID":
    case "BM_UNIT_ID":
    case "GSP_GROUP":
      return true;
    default:
      return false;
  }
}

export function effectiveSentence(from: string, to: string | null): string {
  const start = formatLondonDayMonthYear(from);
  if (to === null) {
    return `Valid from ${start}, no end date published`;
  }
  return `Valid from ${start} to ${formatLondonDayMonthYear(to)}`;
}

/** Inclusive civil-date window. An open end stays current. */
export function intervalCovers(from: string | null, to: string | null, day: string): boolean {
  if (!from || day < from) {
    return false;
  }
  if (to !== null && day > to) {
    return false;
  }
  return true;
}

export function roleStanding(current: boolean): "Current on this date" | "Not current on this date" {
  return current ? "Current on this date" : "Not current on this date";
}
