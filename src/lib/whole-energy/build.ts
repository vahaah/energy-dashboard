import {
  CONVERSION_STATEMENT,
  DISPLAY_QUANTUM_TWH,
  KTOE_DECIMALS,
  KTOE_TO_TWH_FACTOR,
  TOE_KWH,
} from "@/lib/whole-energy/convert";
import type { ParsedBalanceRow } from "@/lib/whole-energy/parse";
import { parseWholeEnergyEdition, type WholeEnergyEdition } from "@/lib/whole-energy/schema";

export function buildWholeEnergyEdition(input: {
  year: number;
  publishedAt: string;
  downloadUrl: string;
  extractSha256: string;
  bytes: number;
  rows: readonly ParsedBalanceRow[];
}): WholeEnergyEdition {
  return parseWholeEnergyEdition({
    edition: `DUKES ${input.publishedAt.slice(0, 4)}`,
    table: "1.1",
    year: input.year,
    published_at: input.publishedAt,
    download_url: input.downloadUrl,
    extract_sha256: input.extractSha256,
    bytes: input.bytes,
    geography: "UK",
    basis: "gross calorific values",
    source_unit: "ktoe",
    unit: "TWh",
    conversion: {
      toe_kwh: TOE_KWH,
      factor_twh_per_ktoe: KTOE_TO_TWH_FACTOR,
      ktoe_decimals: KTOE_DECIMALS,
      display_quantum_twh: String(DISPLAY_QUANTUM_TWH),
      statement: CONVERSION_STATEMENT,
    },
    rows: input.rows.map((row) => ({
      id: row.id,
      label: row.label,
      source_label: row.sourceLabel,
      role: row.role,
      ktoe: row.ktoe,
    })),
  });
}
