import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetDetail, AssetIndexRow } from "@/lib/assets/types";
import { GEONAMES_ATTRIBUTION, GEONAMES_URL } from "@/lib/attribution";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import {
  LINK_FILES,
  SCHEMATIC_LINK_LABEL,
  gasTerminalsFileSchema,
  interconnectorsFileSchema,
} from "@/lib/catalogue/links/schema";
import type { InterconnectorLine } from "@/lib/map/interconnector-layer";

export type LinkCatalogue = {
  rows: AssetIndexRow[];
  details: Map<string, AssetDetail>;
  lines: InterconnectorLine[];
  elexonAttribution: string;
  nationalGasAttribution: string;
};

function geonamesRecord(id: string): { id: string; source: string; edition: string; href: string } {
  return { id, source: "GeoNames", edition: "CC BY 4.0", href: GEONAMES_URL };
}

function attribution(id: "elexon-bmrs" | "national-gas"): string {
  const source = cataloguePageSources().find((item) => item.id === id);
  if (!source) {
    throw new Error(`catalogue is missing ${id}`);
  }
  return source.attribution;
}

export function readLinkCatalogue(root: string): LinkCatalogue {
  const dir = join(root, "data", "catalogue");
  const interconnectors = interconnectorsFileSchema.parse(
    JSON.parse(readFileSync(join(dir, LINK_FILES.interconnectors), "utf8")),
  );
  const terminals = gasTerminalsFileSchema.parse(
    JSON.parse(readFileSync(join(dir, LINK_FILES.gasTerminals), "utf8")),
  );
  const elexonAttribution = attribution("elexon-bmrs");
  const nationalGasAttribution = attribution("national-gas");
  const rows: AssetIndexRow[] = [];
  const details = new Map<string, AssetDetail>();
  const lines: InterconnectorLine[] = [];

  for (const record of interconnectors) {
    const row: AssetIndexRow = {
      id: record.interconnector_id,
      name: record.name,
      operator: "",
      technology: "interconnector",
      status: record.status,
      mw: null,
      region: "Great Britain",
      location: `Schematic link to ${record.remote_country}`,
      country: record.remote_country,
      source: "Elexon",
      sources: ["Elexon"],
      latitude: null,
      longitude: null,
      aka: `${record.fuelinst_code} ${record.remote_country} ${SCHEMATIC_LINK_LABEL}`,
    };
    const line = {
      code: record.fuelinst_code,
      gbLabel: record.gb_label,
      remoteLabel: record.remote_label,
      gbLongitude: record.gb_longitude,
      gbLatitude: record.gb_latitude,
      remoteLongitude: record.remote_longitude,
      remoteLatitude: record.remote_latitude,
    };
    rows.push(row);
    details.set(row.id, {
      row,
      projects: [],
      capacity: [],
      matches: [],
      link: {
        fuelinstCode: record.fuelinst_code,
        citation: record.citation,
        area: `${record.gb_label} and ${record.remote_country}`,
        line,
        sourceRecords: [
          {
            id: `${record.source_id}:${record.fuelinst_code}`,
            source: "Elexon BMRS",
            edition: "FUELINST",
            href: record.source_url,
          },
          ...(record.coordinate_licence === "CC BY 4.0"
            ? [geonamesRecord(`geonames:${record.gb_geonames_id}`)]
            : []),
        ],
        attributions: [
          elexonAttribution,
          ...(record.coordinate_licence === "CC BY 4.0" ? [GEONAMES_ATTRIBUTION] : []),
        ],
      },
    });
    lines.push({
      id: row.id,
      name: row.name,
      code: record.fuelinst_code,
      gbLongitude: line.gbLongitude,
      gbLatitude: line.gbLatitude,
      remoteLongitude: line.remoteLongitude,
      remoteLatitude: line.remoteLatitude,
    });
  }

  for (const record of terminals) {
    const located = record.latitude !== null && record.longitude !== null;
    const row: AssetIndexRow = {
      id: record.asset_id,
      name: record.name,
      operator: "",
      technology: "gas_terminal",
      status: record.status,
      mw: null,
      region: "Great Britain",
      location: located ? "Approximate site" : "Location unavailable",
      country: "Great Britain",
      source: "National Gas",
      sources: ["National Gas"],
      latitude: record.latitude,
      longitude: record.longitude,
      aka: record.key,
    };
    rows.push(row);
    details.set(row.id, {
      row,
      projects: [],
      capacity: [],
      matches: [],
      link: {
        fuelinstCode: null,
        citation: record.citation,
        area: "Great Britain",
        line: null,
        sourceRecords: [
          {
            id: `${record.source_id}:${record.key}`,
            source: "National Gas",
            edition: "NTS terminal names",
            href: record.source_url,
          },
          ...(record.coordinate_licence === "CC BY 4.0" ? [geonamesRecord(`geonames:${record.key}`)] : []),
        ],
        attributions: [
          nationalGasAttribution,
          ...(record.coordinate_licence === "CC BY 4.0" ? [GEONAMES_ATTRIBUTION] : []),
        ],
      },
    });
  }

  rows.sort((left, right) => left.id.localeCompare(right.id));
  return { rows, details, lines, elexonAttribution, nationalGasAttribution };
}
