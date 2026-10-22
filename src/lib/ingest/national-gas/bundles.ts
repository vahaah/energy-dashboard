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

/**
 * 19-character London wall timestamps, the form the portal documents.
 * Completed days use latestFlag=N so every gas day in the window is returned.
 * latestFlag=Y keeps the latest row of an hourly series and would drop earlier days.
 */
export function gasBundleCsvUrl(
  ids: readonly string[],
  dateFrom: string,
  dateTo: string,
  latestFlag: "Y" | "N" = "Y",
): string {
  const url = new URL(GAS_DOWNLOAD_URL);
  url.searchParams.set("applicableFor", "Y");
  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("dateTo", dateTo);
  url.searchParams.set("dateType", "GASDAY");
  url.searchParams.set("latestFlag", latestFlag);
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("type", "CSV");
  return url.toString();
}

/**
 * Intraday starts at midnight. PUBOB29/30/31 use Applicable For at 00:00, which a
 * 05:00 dateFrom excludes. Completed runs through the next 05:00 so a D+1 row
 * published around 12:00 London is inside the same day's prices run.
 */
export function gasBundleWindow(bundle: GasBundle, now: Date): { from: string; to: string } {
  const current = gasDayContaining(now).label;
  const next = gasDayFromLabel(addUtcDays(current, 1)).label;
  switch (bundle) {
    case "intraday":
      return { from: `${current}T00:00:00`, to: londonGasStamp(next) };
    case "completed-day":
      return { from: londonGasStamp(addUtcDays(current, -3)), to: londonGasStamp(next) };
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

/** Finished labels inside the download window. The last label is the primary release. */
export function gasDaysForBundle(bundle: GasBundle, labels: readonly string[], now: Date): string[] {
  const current = gasDayContaining(now).label;
  const window = gasBundleWindow(bundle, now);
  const from = window.from.slice(0, 10);
  const to = window.to.slice(0, 10);
  const inside = [...new Set(labels)].filter((label) => label >= from && label < to).sort();
  switch (bundle) {
    case "intraday":
      return inside.includes(current) ? [current] : [];
    case "completed-day":
      return inside.filter((label) => label < current);
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

export function gasBundleLatestFlag(bundle: GasBundle): "Y" | "N" {
  switch (bundle) {
    case "intraday":
      return "Y";
    case "completed-day":
      return "N";
    default: {
      const neverBundle: never = bundle;
      return neverBundle;
    }
  }
}

function londonGasStamp(label: string): string {
  return `${label}T05:00:00`;
}
