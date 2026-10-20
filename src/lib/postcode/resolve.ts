import { CARBON_INTENSITY_ATTRIBUTION, ONS_POSTCODE_ATTRIBUTION } from "@/lib/attribution";
import { API_ERROR_SOURCE_UNAVAILABLE } from "@/lib/api/errors";
import type { DataState } from "@/lib/data-state";
import { DNO_ATTRIBUTION } from "@/lib/map/constants";
import { areaAnalyticsEvent, type AreaAnalyticsEvent } from "@/lib/postcode/analytics";
import { readRegionalIntensity, type IntensityResult } from "@/lib/postcode/intensity";
import { normalizePostcode } from "@/lib/postcode/parse";
import { getPostcodeReader, type PostcodeReader } from "@/lib/postcode/reader";
import { carbonRegionOf, type CarbonRegion, type DnoArea, type LocalAuthority } from "@/lib/postcode/rows";

export type PostcodeSourceCredit = {
  source_id: "ons-nspl" | "neso-dno-areas" | "carbon-intensity";
  attribution: string;
};

export function postcodeSourceCredits(): PostcodeSourceCredit[] {
  return [
    { source_id: "ons-nspl", attribution: ONS_POSTCODE_ATTRIBUTION },
    { source_id: "neso-dno-areas", attribution: DNO_ATTRIBUTION },
    { source_id: "carbon-intensity", attribution: CARBON_INTENSITY_ATTRIBUTION },
  ];
}

export type IntensityBody = {
  state: DataState | null;
  region_id: CarbonRegion["id"];
  from: string | null;
  to: string | null;
  forecast: number | null;
  index: string | null;
  unit: "gCO2/kWh";
  fetched_at: string | null;
};

export type PostcodeFoundBody = {
  status: "found";
  state: DataState | null;
  local_authority: LocalAuthority | null;
  dno: DnoArea | null;
  carbon_intensity_region: CarbonRegion | null;
  intensity: IntensityBody | null;
  sources: PostcodeSourceCredit[];
};

export type PostcodeNotFoundBody = {
  status: "not_found";
  reason: "unknown" | "terminated";
  state: DataState | null;
  sources: PostcodeSourceCredit[];
};

export type PostcodeResolveResult =
  | { http: 200; body: PostcodeFoundBody | PostcodeNotFoundBody; analytics: AreaAnalyticsEvent | null }
  | { http: 503; body: { error: string }; analytics: null };

export type ResolveDeps = {
  reader?: PostcodeReader;
  intensity?: (regionId: CarbonRegion["id"]) => Promise<IntensityResult>;
};

function intensityBody(region: CarbonRegion, result: IntensityResult): IntensityBody {
  return {
    state: result.state,
    region_id: region.id,
    from: result.reading?.from ?? null,
    to: result.reading?.to ?? null,
    forecast: result.reading?.forecast ?? null,
    index: result.reading?.index ?? null,
    unit: "gCO2/kWh",
    fetched_at: result.reading?.fetchedAt ?? null,
  };
}

export async function resolvePostcode(raw: string, deps: ResolveDeps = {}): Promise<PostcodeResolveResult> {
  const parsed = normalizePostcode(raw);
  const sources = postcodeSourceCredits();
  if (!parsed) {
    return {
      http: 200,
      analytics: null,
      body: { status: "not_found", reason: "unknown", state: null, sources },
    };
  }
  const reader = deps.reader ?? getPostcodeReader();
  const lookup = await reader.lookup(parsed.normalised);
  if (!lookup.available) {
    return { http: 503, analytics: null, body: { error: API_ERROR_SOURCE_UNAVAILABLE } };
  }
  if (!lookup.row) {
    return {
      http: 200,
      analytics: null,
      body: { status: "not_found", reason: "unknown", state: lookup.state, sources },
    };
  }
  if (lookup.row.terminated) {
    return {
      http: 200,
      analytics: null,
      body: { status: "not_found", reason: "terminated", state: lookup.state, sources },
    };
  }
  const carbon = carbonRegionOf(lookup.row.ci);
  const areas = {
    localAuthority: lookup.row.la,
    dno: lookup.row.dno,
    carbonIntensityRegion: carbon,
  };
  const intensity = carbon ? await (deps.intensity ?? readRegionalIntensity)(carbon.id) : null;
  return {
    http: 200,
    analytics: areaAnalyticsEvent(areas),
    body: {
      status: "found",
      state: lookup.state,
      local_authority: areas.localAuthority,
      dno: areas.dno,
      carbon_intensity_region: areas.carbonIntensityRegion,
      intensity: carbon && intensity ? intensityBody(carbon, intensity) : null,
      sources,
    },
  };
}
