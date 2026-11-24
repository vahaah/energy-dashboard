/** Latest dashboard peek. No `date` parameter: a past London date can reach Tinybird. */
export const LIVE_DASHBOARD_PATH = "/api/dashboard?period=day";

/** Derived cleanest-window peek. The route does not return the raw 48-hour series. */
export const LOOK_AHEAD_PATH = "/api/look-ahead";

/** Balancing release. No Tinybird query. */
export const BALANCING_PATH = "/api/v1/balancing";

/** GB freshness. No Tinybird query. */
export const DATA_HEALTH_PATH = "/api/v1/data-health";

export function assertNoHistoricalDate(url: string): void {
  const params = new URL(url, "https://grid.vahaah.com").searchParams;
  if (params.has("date")) {
    throw new Error("WebMCP tools do not read a historical date.");
  }
}
