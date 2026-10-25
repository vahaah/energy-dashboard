import {
  CC_BY_4_0_LICENSE_URL,
  ENW_POWER_CUTS_ATTRIBUTION,
  NGED_POWER_CUTS_ATTRIBUTION,
  NPG_OPEN_DATA_LICENCE_URL,
  NPG_POWER_CUTS_ATTRIBUTION,
  OGL_V3_LICENCE_URL,
  OFGEM_CI_CML_ATTRIBUTION,
  SPEN_POWER_CUTS_ATTRIBUTION,
  UKPN_POWER_CUTS_ATTRIBUTION,
} from "@/lib/attribution";
import type { Operator } from "@/lib/power-cuts/schema";

export const POWER_CUTS_PATH = "/power-cuts";

export const POWER_CUTS_TITLE = "UK power cuts now: live map by area | Grid";

/** Honest about the operators this deployment can actually read. */
export const POWER_CUTS_DESCRIPTION =
  "Power cuts reported by UK Power Networks, Northern Powergrid and National Grid Electricity Distribution across parts of England and Wales, with customers off supply, planned and unplanned, by network operator. Updated every 15 minutes. Scotland, Northern Ireland, north-west England and some other areas are not in this feed yet.";

export const POWER_CUTS_H1 = "Power cuts across the UK";

export const POWER_CUTS_CALL_105 = "Power cut? Call 105";
export const POWER_CUTS_CALL_NI = "In Northern Ireland call 03457 643 643";

export const API_KEY_ABSENT_REASON = "API key not configured";
export const NOT_YET_INCLUDED = "Not yet included";
export const NOT_YET_INCLUDED_NOTE = "This operator is not in the public feed yet.";
export const UNLICENSED_REASON = "Not licensed";

/** Public pages never name a missing key. The stored report can keep the internal reason. */
export function publicOperatorError(error: string | null | undefined): string | null {
  if (error == null || error.length === 0) {
    return null;
  }
  if (error === API_KEY_ABSENT_REASON || /api key/i.test(error)) {
    return `${NOT_YET_INCLUDED}. ${NOT_YET_INCLUDED_NOTE}`;
  }
  return error;
}

export const NO_POWER_CUTS = "No power cuts reported";
export const ALL_FEEDS_FAILED = "None of the operator feeds could be read.";

export type SourceCredit = {
  operator: Operator;
  name: string;
  url: string;
  licenceUrl: string | null;
  attribution: string;
};

export const POWER_CUT_CREDITS: readonly SourceCredit[] = [
  {
    operator: "ukpn",
    name: "UK Power Networks",
    url: "https://ukpowernetworks.opendatasoft.com/explore/dataset/ukpn-live-faults/",
    licenceUrl: CC_BY_4_0_LICENSE_URL,
    attribution: UKPN_POWER_CUTS_ATTRIBUTION,
  },
  {
    operator: "npg",
    name: "Northern Powergrid",
    url: "https://northernpowergrid.opendatasoft.com/explore/dataset/live-power-cuts-data/",
    licenceUrl: NPG_OPEN_DATA_LICENCE_URL,
    attribution: NPG_POWER_CUTS_ATTRIBUTION,
  },
  {
    operator: "nged",
    name: "National Grid Electricity Distribution",
    url: "https://connecteddata.nationalgrid.co.uk/dataset/d6672e1e-c684-4cea-bb78-c7e5248b62a2",
    licenceUrl: null,
    attribution: NGED_POWER_CUTS_ATTRIBUTION,
  },
  {
    operator: "enw",
    name: "Electricity North West",
    url: "https://electricitynorthwest.opendatasoft.com/explore/dataset/live_incidents/",
    licenceUrl: CC_BY_4_0_LICENSE_URL,
    attribution: ENW_POWER_CUTS_ATTRIBUTION,
  },
  {
    operator: "spen",
    name: "SP Energy Networks",
    url: "https://spenergynetworks.opendatasoft.com/explore/dataset/distribution-network-live-outages/",
    licenceUrl: CC_BY_4_0_LICENSE_URL,
    attribution: SPEN_POWER_CUTS_ATTRIBUTION,
  },
];

export const OFGEM_CREDIT = {
  name: "Ofgem",
  url: "https://www.ofgem.gov.uk/transparency-document/riio-2-electricity-distribution-annual-report-2024-2025",
  licenceUrl: OGL_V3_LICENCE_URL,
  attribution: OFGEM_CI_CML_ATTRIBUTION,
} as const;

export function operatorName(operator: Operator): string {
  switch (operator) {
    case "ukpn":
      return "UK Power Networks";
    case "npg":
      return "Northern Powergrid";
    case "nged":
      return "National Grid Electricity Distribution";
    case "enw":
      return "Electricity North West";
    case "spen":
      return "SP Energy Networks";
    case "ssen":
      return "Scottish and Southern Electricity Networks";
    case "nie":
      return "Northern Ireland Electricity";
    default: {
      const exhaustive: never = operator;
      return exhaustive;
    }
  }
}
