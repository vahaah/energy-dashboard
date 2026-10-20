/**
 * The 14 Carbon Intensity regions. Country totals (15 England, 16 Scotland,
 * 17 Wales, 18 GB) are not cached and are not fetched.
 * Names are the API `shortname` values read on 20 Oct 2026.
 */

export const CI_REGIONS = [
  { id: 1, shortname: "North Scotland" },
  { id: 2, shortname: "South Scotland" },
  { id: 3, shortname: "North West England" },
  { id: 4, shortname: "North East England" },
  { id: 5, shortname: "Yorkshire" },
  { id: 6, shortname: "North Wales & Merseyside" },
  { id: 7, shortname: "South Wales" },
  { id: 8, shortname: "West Midlands" },
  { id: 9, shortname: "East Midlands" },
  { id: 10, shortname: "East England" },
  { id: 11, shortname: "South West England" },
  { id: 12, shortname: "South England" },
  { id: 13, shortname: "London" },
  { id: 14, shortname: "South East England" },
] as const;

export type CiRegionId = (typeof CI_REGIONS)[number]["id"];

const CI_REGION_IDS = new Set<number>(CI_REGIONS.map((region) => region.id));

export function isCiRegionId(value: number): value is CiRegionId {
  return CI_REGION_IDS.has(value);
}

/** Freshness window. One refresh per region per window is 48 a day. */
export const CI_REGION_FRESH_MS = 30 * 60 * 1000;

export const CI_REGION_REFRESHES_PER_DAY = (24 * 60) / 30;

/** 14 regions × 48 refreshes. Retries stay inside one refresh. */
export const CI_REGION_UPSTREAM_DAILY_CAP = CI_REGIONS.length * CI_REGION_REFRESHES_PER_DAY;

/**
 * The key outlives the freshness window so a failed refresh can still return
 * the last reading. Freshness is `freshUntil` inside the value.
 */
export const CI_REGION_RETAIN_SECONDS = 7 * 24 * 60 * 60;

export function ciRegionCacheKey(id: CiRegionId): string {
  if (!isCiRegionId(id)) {
    throw new Error("carbon intensity cache key is a region id");
  }
  return `grid:ci-region:${id}`;
}

export const CI_REGION_CACHE_KEYS: readonly string[] = CI_REGIONS.map((region) =>
  ciRegionCacheKey(region.id),
);

/** Region id only. The postcode endpoint is not used. */
export function regionalIntensityUrl(id: CiRegionId): string {
  if (!isCiRegionId(id)) {
    throw new Error("carbon intensity request is a region id");
  }
  return `https://api.carbonintensity.org.uk/regional/regionid/${id}`;
}

export function ciRegionShortname(id: CiRegionId): string {
  const region = CI_REGIONS.find((item) => item.id === id);
  if (!region) {
    throw new Error("carbon intensity region is not in the 14");
  }
  return region.shortname;
}
