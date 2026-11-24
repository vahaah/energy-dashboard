import { fetchBounded } from "@/lib/http/bounded-json";
import type { CommodityRange, CommodityPrice } from "@/lib/types";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";

const READ_TIMEOUT_MS = 8_000;

export async function fetchDashboardPayload(
  period: DashboardPeriod,
  date: string | null
): Promise<DashboardPayload> {
  const params = new URLSearchParams({ period });
  if (date) {
    params.set("date", date);
  }
  const url = `/api/dashboard?${params.toString()}`;
  // A dated read can reach Tinybird. Time out, and do not retry it.
  const response = date
    ? await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(READ_TIMEOUT_MS) })
    : await fetchBounded(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Dashboard query failed (${response.status})`);
  }
  return hydrateDashboardPayload((await response.json()) as DashboardPayload);
}

export async function fetchPublicPrices(range: CommodityRange): Promise<CommodityPrice[]> {
  const response = await fetch(`/api/prices?range=${range}`, {
    credentials: "omit",
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Prices query failed (${response.status})`);
  }
  const json = (await response.json()) as { data: CommodityPrice[] };
  return json.data;
}
