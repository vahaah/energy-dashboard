import { gasDayContaining, gasDayFromLabel } from "@/lib/ingest/national-gas/gas-day";
import { GAS_PUBLICATIONS } from "@/lib/ingest/national-gas/publications";
import { addUtcDays } from "@/lib/london-time";
import { GAS_METRICS } from "@/lib/metrics";

export const GAS_BUNDLES = ["intraday", "completed-day"] as const;

export type GasBundle = (typeof GAS_BUNDLES)[number];

/** Portal download. One GET, ids joined with commas. SAP is not in either bundle. */
export const GAS_DOWNLOAD_URL = "https://data.nationalgas.com/api/find-gas-data-download";

export const GAS_CATALOGUE_URL = "https://api.nationalgas.com/operationaldata/v1/publications/catalogue";

const INTRADAY_CADENCE = "PT1H";
const COMPLETED_CADENCE = "P1D";

export const GAS_INTRADAY_PUBLICATION_IDS = GAS_PUBLICATIONS.filter(
  (row) => metricCadence(row.metric_id) === INTRADAY_CADENCE,
).map((row) => row.publication_id);

export const GAS_COMPLETED_DAY_PUBLICATION_IDS = GAS_PUBLICATIONS.filter(
  (row) => metricCadence(row.metric_id) === COMPLETED_CADENCE,
).map((row) => row.publication_id);

function metricCadence(metricId: string): string {
  if (!Object.prototype.hasOwnProperty.call(GAS_METRICS, metricId)) {
    return "";
  }
  return GAS_METRICS[metricId as keyof typeof GAS_METRICS].expected_cadence;
}

export function gasBundlePublicationIds(bundle: GasBundle): readonly string[] {
  switch (bundle) {
    case "intraday":
      return GAS_INTRADAY_PUBLICATION_IDS;
    case "completed-day":
      return GAS_COMPLETED_DAY_PUBLICATION_IDS;
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

/** 19-character London wall timestamps, the form the portal documents. */
export function gasBundleCsvUrl(ids: readonly string[], dateFrom: string, dateTo: string): string {
  const url = new URL(GAS_DOWNLOAD_URL);
  url.searchParams.set("applicableFor", "Y");
  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("dateTo", dateTo);
  url.searchParams.set("dateType", "GASDAY");
  url.searchParams.set("latestFlag", "Y");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("type", "CSV");
  return url.toString();
}

export function gasBundleWindow(bundle: GasBundle, now: Date): { from: string; to: string } {
  const current = gasDayContaining(now).label;
  switch (bundle) {
    case "intraday":
      return { from: londonGasStamp(current), to: londonGasStamp(gasDayFromLabel(addUtcDays(current, 1)).label) };
    case "completed-day":
      return { from: londonGasStamp(addUtcDays(current, -3)), to: londonGasStamp(current) };
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

function londonGasStamp(label: string): string {
  return `${label}T05:00:00`;
}
