import {
  ENW_SOURCE_URL,
  NGED_SOURCE_URL,
  NIE_SOURCE_URL,
  NPG_SOURCE_URL,
  SPEN_SOURCE_URL,
  SSEN_SOURCE_URL,
  UKPN_SOURCE_URL,
} from "@/lib/power-cuts/parse";
import { FETCH_MAX_BYTES, FETCH_TIMEOUT_MS, type Operator } from "@/lib/power-cuts/schema";

const UKPN_FIELDS =
  "incidentreference,powercuttype,creationdatetime,estimatedrestorationdate,restoreddatetime,nocustomeraffected,noplannedcustomers,postcodesaffected,geopoint,operatingzone";
const NPG_FIELDS =
  "incidentid,reference,totalconfirmedpowercut,totalpredictedpowercut,type,natureofoutage,loggedtime,estimatedtimetillresolution,postcode,area,lat,lng";
const ENW_FIELDS =
  "incident_num,incident_type,outage_time,customers_affected,customers_off_supply,incident_status,estimated_restoration_time,geo_point_2d";
const SPEN_FIELDS =
  "fault_id,licence_area,region,status,planned,planned_outage_start_date,date_of_reported_fault,etr,voltage,postcode_sector";

function ods(url: string, fields: string): string {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}select=${encodeURIComponent(fields)}`;
}

export type PowerCutEndpoint = {
  operator: Operator;
  url: string;
  format: "json" | "csv";
  apiKeyEnv: "ENW_ODS_API_KEY" | "SPEN_ODS_API_KEY" | null;
};

export const POWER_CUT_ENDPOINTS: readonly PowerCutEndpoint[] = [
  {
    operator: "ukpn",
    url: ods(
      "https://ukpowernetworks.opendatasoft.com/api/explore/v2.1/catalog/datasets/ukpn-live-faults/exports/json",
      UKPN_FIELDS,
    ),
    format: "json",
    apiKeyEnv: null,
  },
  {
    operator: "npg",
    url: ods(
      "https://northernpowergrid.opendatasoft.com/api/explore/v2.1/catalog/datasets/live-power-cuts-data/exports/json",
      NPG_FIELDS,
    ),
    format: "json",
    apiKeyEnv: null,
  },
  {
    operator: "nged",
    url: "https://connecteddata.nationalgrid.co.uk/dataset/d6672e1e-c684-4cea-bb78-c7e5248b62a2/resource/292f788f-4339-455b-8cc0-153e14509d4d/download/power_outage_ext.csv",
    format: "csv",
    apiKeyEnv: null,
  },
  {
    operator: "enw",
    url: ods(
      "https://electricitynorthwest.opendatasoft.com/api/explore/v2.1/catalog/datasets/live_incidents/exports/json",
      ENW_FIELDS,
    ),
    format: "json",
    apiKeyEnv: "ENW_ODS_API_KEY",
  },
  {
    operator: "spen",
    url: ods(
      "https://spenergynetworks.opendatasoft.com/api/explore/v2.1/catalog/datasets/distribution-network-live-outages/exports/json",
      SPEN_FIELDS,
    ),
    format: "json",
    apiKeyEnv: "SPEN_ODS_API_KEY",
  },
  {
    operator: "ssen",
    url: "https://ssen-powertrack-api.opcld.com/gridiview/reporter/info/livefaults",
    format: "json",
    apiKeyEnv: null,
  },
  {
    operator: "nie",
    url: "https://powercheck.nienetworks.co.uk/NIEPowerCheckerWebAPI/api/faults",
    format: "json",
    apiKeyEnv: null,
  },
];

export const SOURCE_PAGE_URL: Record<Operator, string> = {
  ukpn: UKPN_SOURCE_URL,
  npg: NPG_SOURCE_URL,
  nged: NGED_SOURCE_URL,
  enw: ENW_SOURCE_URL,
  spen: SPEN_SOURCE_URL,
  ssen: SSEN_SOURCE_URL,
  nie: NIE_SOURCE_URL,
};

export { FETCH_MAX_BYTES, FETCH_TIMEOUT_MS };
