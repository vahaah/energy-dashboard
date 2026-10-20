/** NESO Interconnector Register resource. Built rows only. Duplicate stages are not summed. */
export const NESO_INTERCONNECTOR_REGISTER_RESOURCE = "64f7908f-f787-4977-93e1-5342a5f1357f";

export const NESO_INTERCONNECTOR_REGISTER_URL =
  "https://www.neso.energy/data-portal/interconnector-register";

const PROJECT_CODES: Record<string, string> = {
  "IFA Interconnector": "INTFR",
  "IFA2 Interconnector": "INTIFA2",
  ElecLink: "INTELEC",
  Britned: "INTNED",
  "Nemo Link": "INTNEM",
  "NS Link": "INTNSL",
  "Viking Link Denmark Interconnect": "INTVKL",
  "Auchencrosh (interconnector CCT)": "INTIRL",
  "East West Interconnector": "INTEW",
  Greenlink: "INTGRNL",
};

export type RegisterCapacityRow = {
  projectName?: unknown;
  projectStatus?: unknown;
  connectionSite?: unknown;
  importCurrent?: unknown;
  exportCurrent?: unknown;
};

export type InterconnectorCapacity = {
  code: string;
  importMw: number | null;
  exportMw: number | null;
  connectionSite: string;
  projectName: string;
};

export type CapacityRelease = {
  generated_at: string;
  published_at: string;
  rows: InterconnectorCapacity[];
};

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Current connected MW from Built rows. Two stages of one project keep the
 * larger current figure and are not added together.
 */
/** CKAN rows use the register's column titles. Values arrive as numbers or numeric strings. */
export function capacityRowsFromCkan(records: readonly Record<string, unknown>[]): RegisterCapacityRow[] {
  return records.map((record) => ({
    projectName: record["Project Name"],
    projectStatus: record["Project Status"],
    connectionSite: record["Connection Site"],
    importCurrent: record["MW Import - Current"],
    exportCurrent: record["MW Export - Current"],
  }));
}

export function capacityFromRegister(records: readonly RegisterCapacityRow[], now: Date, publishedAt: string): CapacityRelease {
  const chosen = new Map<string, InterconnectorCapacity>();
  for (const record of records) {
    if (typeof record.projectName !== "string" || record.projectStatus !== "Built") {
      continue;
    }
    const code = PROJECT_CODES[record.projectName];
    if (!code) {
      continue;
    }
    const next: InterconnectorCapacity = {
      code,
      importMw: finite(record.importCurrent),
      exportMw: finite(record.exportCurrent),
      connectionSite: typeof record.connectionSite === "string" ? record.connectionSite : "",
      projectName: record.projectName,
    };
    const current = chosen.get(code);
    const nextRank = next.importMw ?? -1;
    const currentRank = current?.importMw ?? -1;
    const nextExport = next.exportMw ?? -1;
    const currentExport = current?.exportMw ?? -1;
    if (!current || nextRank > currentRank || (nextRank === currentRank && nextExport > currentExport)) {
      chosen.set(code, next);
    }
  }
  return {
    generated_at: now.toISOString(),
    published_at: publishedAt,
    rows: [...chosen.values()].sort((left, right) => left.code.localeCompare(right.code)),
  };
}
