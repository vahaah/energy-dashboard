import rawSources from "../../../data/catalogue/sources.json";
import { elexonBmrsAttribution, type DataSourceRecord } from "@/lib/attribution";
import { sourcesFileSchema, type CatalogueSource } from "@/lib/catalogue/schema";
import { osBasemapAttribution } from "@/lib/map/constants";

export type CataloguePageSource = {
  id: CatalogueSource["source_id"];
  name: string;
  usedFor: string;
  url: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
};

const sources = sourcesFileSchema.parse(rawSources);

/** Display rows for /data-sources. The JSON file is the only copy of this list. */
export function cataloguePageSources(): CataloguePageSource[] {
  return sources.map((source) => ({
    id: source.source_id,
    name: source.name,
    usedFor: source.used_for,
    url: source.url,
    licence: source.licence,
    licenceUrl: source.licence_url,
    attribution: source.attribution,
  }));
}

/** Methodology table label. The catalogue cadence stays ISO-8601. */
export function sourceRefreshLabel(id: CataloguePageSource["id"]): string {
  switch (id) {
    case "eia":
    case "world-bank-pink-sheet":
      return "Every 6 hours";
    case "desnz-repd":
      return "Quarterly";
    case "desnz-dukes":
      return "Annual";
    case "neso-dno-areas":
      return "Daily";
    case "os-open-zoomstack":
      return "Twice a year";
    case "geonames":
      return "Curated";
    case "eirgrid-group":
      return "Hourly";
    case "elexon-isd":
      return "Weekly";
    case "elexon-bmrs":
    case "neso-open-data":
    case "carbon-intensity":
    case "sheffield-pv-live":
    case "national-gas":
      return "Hourly";
    default: {
      const neverId: never = id;
      return neverId;
    }
  }
}

/** Same rows, with the Elexon copyright year restamped for callers that pass one. */
export function dataSources(year = new Date().getUTCFullYear()): DataSourceRecord[] {
  return cataloguePageSources().map((source) => ({
    ...source,
    attribution:
      source.id === "elexon-bmrs"
        ? elexonBmrsAttribution(year)
        : source.id === "os-open-zoomstack"
          ? osBasemapAttribution(year)
          : source.attribution,
  }));
}
