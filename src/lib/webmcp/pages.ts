import {
  CC_BY_4_0_LICENSE_URL,
  EIA_ATTRIBUTION,
  EIA_URL,
  EIRGRID_GROUP_ATTRIBUTION,
  EIRGRID_GROUP_LICENCE_URL,
  ELEXON_BMRS_LICENCE_URL,
  ELEXON_ISD_ATTRIBUTION,
  ELEXON_ISD_URL,
  ENW_POWER_CUTS_ATTRIBUTION,
  GEONAMES_ATTRIBUTION,
  GEONAMES_URL,
  NATIONAL_GAS_ATTRIBUTION,
  NATIONAL_GAS_PORTAL_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  NGED_POWER_CUTS_ATTRIBUTION,
  NPG_OPEN_DATA_LICENCE_URL,
  NPG_POWER_CUTS_ATTRIBUTION,
  OFGEM_CI_CML_ATTRIBUTION,
  OGL_V3_ATTRIBUTION,
  OGL_V3_LICENCE_URL,
  SPEN_POWER_CUTS_ATTRIBUTION,
  UKPN_POWER_CUTS_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_URL,
  elexonBmrsAttribution,
} from "@/lib/attribution";
import { OFGEM_PRICE_CAP_HUB_URL } from "@/lib/price-cap";
import { DNO_ATTRIBUTION, osBasemapAttribution } from "@/lib/map/constants";
import { SHIPPED_PAGE_ROUTES } from "@/lib/site-nav";
import { SITE_ORIGIN } from "@/lib/site";
import { electricitySources, type GridLiveReading } from "@/lib/webmcp/reading";
import type { SourceCredit } from "@/lib/webmcp/result";

const GRID: SourceCredit = {
  name: "Grid",
  attribution: "Grid's derived data is CC BY 4.0. Upstream licences still apply.",
  url: CC_BY_4_0_LICENSE_URL,
};

const OGL: SourceCredit = {
  name: "DESNZ",
  attribution: OGL_V3_ATTRIBUTION,
  url: OGL_V3_LICENCE_URL,
};

const NESO: SourceCredit = {
  name: "NESO",
  attribution: NESO_OPEN_DATA_ATTRIBUTION,
  url: NESO_OPEN_DATA_LICENCE_URL,
};

const GAS: SourceCredit = {
  name: "National Gas",
  attribution: NATIONAL_GAS_ATTRIBUTION,
  url: NATIONAL_GAS_PORTAL_URL,
};

type Route = (typeof SHIPPED_PAGE_ROUTES)[number];

function elexon(year: number): SourceCredit {
  return {
    name: "Elexon BMRS",
    attribution: elexonBmrsAttribution(year),
    url: ELEXON_BMRS_LICENCE_URL,
  };
}

function sourcesFor(route: Route, year: number): SourceCredit[] {
  switch (route) {
    case "/":
    case "/today":
      return [GRID, ...electricitySources(year)];
    case "/prices/gas":
      return [
        GRID,
        GAS,
        { name: "U.S. EIA", attribution: EIA_ATTRIBUTION, url: EIA_URL },
        {
          name: "World Bank Pink Sheet",
          attribution: WORLD_BANK_PINK_SHEET_ATTRIBUTION,
          url: WORLD_BANK_PINK_SHEET_URL,
        },
      ];
    case "/gas":
      return [GRID, GAS];
    case "/explained/price-cap":
      return [{ name: "Ofgem", attribution: "Source: Ofgem.", url: OFGEM_PRICE_CAP_HUB_URL }, GRID];
    case "/records":
      return [GRID, NESO, elexon(year)];
    case "/methodology":
    case "/data-sources":
    case "/api":
    case "/privacy":
    case "/terms":
    case "/tools":
      return [GRID];
    case "/data-health":
      return [GRID, ...electricitySources(year), GAS];
    case "/map":
      return [
        GRID,
        elexon(year),
        GAS,
        { name: "GeoNames", attribution: GEONAMES_ATTRIBUTION, url: GEONAMES_URL },
        { name: "OS Open Zoomstack", attribution: osBasemapAttribution(year), url: OGL_V3_LICENCE_URL },
        { name: "NESO DNO areas", attribution: DNO_ATTRIBUTION, url: NESO_OPEN_DATA_LICENCE_URL },
      ];
    case "/assets":
    case "/pipeline":
      return [GRID, OGL];
    case "/projects":
    case "/changes":
      return [GRID, OGL, NESO];
    case "/system/constraints":
      return [GRID, NESO];
    case "/system/balancing":
    case "/system/storage":
      return [GRID, NESO, elexon(year), OGL];
    case "/system/whole-energy":
      return [GRID, OGL];
    case "/electricity/northern-ireland":
      return [
        GRID,
        {
          name: "EirGrid Group",
          attribution: EIRGRID_GROUP_ATTRIBUTION,
          url: EIRGRID_GROUP_LICENCE_URL,
        },
      ];
    case "/directory":
    case "/directory/identifiers":
      return [
        GRID,
        { name: "Elexon ISD", attribution: ELEXON_ISD_ATTRIBUTION, url: ELEXON_ISD_URL },
      ];
    case "/power-cuts":
      return [
        GRID,
        { name: "UK Power Networks", attribution: UKPN_POWER_CUTS_ATTRIBUTION },
        { name: "Northern Powergrid", attribution: NPG_POWER_CUTS_ATTRIBUTION, url: NPG_OPEN_DATA_LICENCE_URL },
        { name: "National Grid Electricity Distribution", attribution: NGED_POWER_CUTS_ATTRIBUTION },
        { name: "Electricity North West", attribution: ENW_POWER_CUTS_ATTRIBUTION },
        { name: "SP Energy Networks", attribution: SPEN_POWER_CUTS_ATTRIBUTION },
        { name: "Ofgem", attribution: OFGEM_CI_CML_ATTRIBUTION, url: OGL_V3_LICENCE_URL },
      ];
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

export function canonicalPath(path: string): string {
  const bare = path.split("?")[0]?.split("#")[0] ?? "/";
  if (bare.length > 1 && bare.endsWith("/")) {
    return bare.slice(0, -1);
  }
  return bare.length > 0 ? bare : "/";
}

export type AssetSourceHint = {
  technology: string;
};

/** Id segment of `/assets/{id}` or `/assets/{id}/{slug}`. The directory itself has none. */
export function assetIdFromPath(path: string): string | null {
  const parts = canonicalPath(path).split("/").filter((part) => part.length > 0);
  if (parts[0] !== "assets" || !parts[1]) {
    return null;
  }
  return parts[1];
}

/**
 * Interconnectors and gas terminals share `/assets/` with plants.
 * Their credits are the Elexon or National Gas sentence plus GeoNames, the same pair the asset page shows.
 */
export function sourcesForAsset(asset: AssetSourceHint, year: number): SourceCredit[] {
  switch (asset.technology) {
    case "interconnector":
      return [
        GRID,
        {
          name: "Elexon BMRS",
          attribution: elexonBmrsAttribution(year),
          url: ELEXON_BMRS_LICENCE_URL,
        },
        { name: "GeoNames", attribution: GEONAMES_ATTRIBUTION, url: GEONAMES_URL },
      ];
    case "gas_terminal":
      return [
        GRID,
        { name: "National Gas", attribution: NATIONAL_GAS_ATTRIBUTION, url: NATIONAL_GAS_PORTAL_URL },
        { name: "GeoNames", attribution: GEONAMES_ATTRIBUTION, url: GEONAMES_URL },
      ];
    default:
      return [GRID, OGL];
  }
}

export function sourcesForPath(path: string, year: number, asset?: AssetSourceHint | null): SourceCredit[] {
  const canonical = canonicalPath(path);
  if ((SHIPPED_PAGE_ROUTES as readonly string[]).includes(canonical)) {
    return sourcesFor(canonical as Route, year);
  }
  if (assetIdFromPath(canonical)) {
    return asset ? sourcesForAsset(asset, year) : [GRID, dataSourcesPointer()];
  }
  if (canonical.startsWith("/assets/")) {
    return [GRID, OGL];
  }
  if (canonical.startsWith("/projects/")) {
    return [GRID, OGL, NESO];
  }
  return [GRID, dataSourcesPointer()];
}

function dataSourcesPointer(): SourceCredit {
  return {
    name: "Grid",
    attribution: "Sources for this page are listed on the data sources page.",
    url: `${SITE_ORIGIN}/data-sources`,
  };
}

export type PageDataset = {
  title: string;
  url: string;
  path: string;
  citation: string;
  figures: GridLiveReading | null;
  sources: SourceCredit[];
};

export function pageDataset(input: {
  title: string;
  url: string;
  path: string;
  retrievedAt: string;
  year: number;
  reading: GridLiveReading | null;
  embeddedPath: string | null;
  asset?: AssetSourceHint | null;
}): PageDataset {
  const path = canonicalPath(input.path);
  const figures = input.embeddedPath === path ? input.reading : null;
  const sources = figures?.sources ?? sourcesForPath(path, input.year, input.asset);
  return {
    title: input.title,
    url: input.url,
    path,
    citation: `Grid, "${input.title}", ${input.url}, retrieved ${input.retrievedAt}.`,
    figures,
    sources,
  };
}
