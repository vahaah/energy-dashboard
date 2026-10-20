import type { CarbonRegion, DnoArea, LocalAuthority } from "@/lib/postcode/rows";

/**
 * Plausible props for a resolved area. The postcode is not a parameter, so it
 * cannot be attached to the event.
 */
export type AreaAnalyticsEvent = {
  name: "area";
  props: {
    local_authority: string;
    dno: string;
    carbon_intensity_region: string;
  };
};

export function areaAnalyticsEvent(areas: {
  localAuthority: LocalAuthority | null;
  dno: DnoArea | null;
  carbonIntensityRegion: CarbonRegion | null;
}): AreaAnalyticsEvent {
  return {
    name: "area",
    props: {
      local_authority: areas.localAuthority?.code ?? "",
      dno: areas.dno?.id ?? "",
      carbon_intensity_region:
        areas.carbonIntensityRegion == null ? "" : String(areas.carbonIntensityRegion.id),
    },
  };
}

export type PostcodeLogStatus = "found" | "not_found" | "error";

/** The log line. The postcode is not a field. */
export function postcodeLogFields(status: PostcodeLogStatus): { status: PostcodeLogStatus } {
  return { status };
}
