import { EIRGRID_GROUP_ATTRIBUTION } from "@/lib/attribution";

export const NI_PATH = "/electricity/northern-ireland";

export const NI_TITLE = "Northern Ireland electricity: demand, wind, mix | Grid";
export const NI_DESCRIPTION =
  "Northern Ireland and all-island electricity: demand, generation, wind, solar, Moyle flows and fuel mix from SONI and EirGrid, kept apart from GB figures.";

export const NI_H1 = "What's powering Northern Ireland?";

export const NI_SCOPE_BANNER =
  "Outside GB. This page covers Northern Ireland and the all-island Single Electricity Market (Northern Ireland and Ireland). Grid's GB figures never include Northern Ireland.";

export const NI_EMPTY = "Grid does not have Northern Ireland data yet. It will appear here once SONI data is added.";

export const NI_PARTIAL =
  "Some of Northern Ireland's data is missing for this period. Totals may be lower than the full figure.";

export const NI_NAV_LABEL = "Northern Ireland (outside GB)";

export const NI_OUTSIDE_GB = "Outside GB";

export const NI_SCOPE_NI = "Northern Ireland";

export const NI_SCOPE_ALL = "All-island";

export const NI_ATTRIBUTION = EIRGRID_GROUP_ATTRIBUTION;

export function niLatestSentence(observedAt: string): string {
  return `Latest data from SONI is from ${observedAt}.`;
}
