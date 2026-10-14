import rawSources from "../../../data/catalogue/sources.json";
import { elexonBmrsAttribution, type DataSourceRecord } from "@/lib/attribution";
import { sourcesFileSchema, type CatalogueSource } from "@/lib/catalogue/schema";

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

/** Same rows, with the Elexon copyright year restamped for callers that pass one. */
export function dataSources(year = new Date().getUTCFullYear()): DataSourceRecord[] {
  return cataloguePageSources().map((source) => ({
    ...source,
    attribution: source.id === "elexon-bmrs" ? elexonBmrsAttribution(year) : source.attribution,
  }));
}
