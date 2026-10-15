import { RESIDUAL_IMPORTS_CODE } from "@/lib/catalogue/links/schema";
import type { InterconnectorFlow } from "@/lib/types";

/**
 * FUELINST codes are published as INTFR. Ingest stores `fuelType.toLowerCase()`,
 * so the warmed `interconnector_flows` row uses that exact stored code.
 * Matching is the code, never the interconnector name.
 */
export function storedFuelinstCode(published: string): string {
  return published.toLowerCase();
}

export function isResidualImportsCode(code: string): boolean {
  return code.toUpperCase() === RESIDUAL_IMPORTS_CODE;
}

export function sameFuelinstCode(published: string, stored: string): boolean {
  if (isResidualImportsCode(published) || isResidualImportsCode(stored)) {
    return false;
  }
  return stored === published || stored === storedFuelinstCode(published);
}

export function flowsForCode(published: string, rows: readonly InterconnectorFlow[]): InterconnectorFlow[] {
  if (isResidualImportsCode(published) || !published.startsWith("INT")) {
    return [];
  }
  return rows.filter((row) => sameFuelinstCode(published, row.interconnector));
}

export function flowDirection(mw: number): "import" | "export" {
  return mw >= 0 ? "import" : "export";
}

export function latestFlow(rows: readonly InterconnectorFlow[]): InterconnectorFlow | null {
  let latest: InterconnectorFlow | null = null;
  for (const row of rows) {
    if (!latest || row.timestamp > latest.timestamp) {
      latest = row;
    }
  }
  return latest;
}
