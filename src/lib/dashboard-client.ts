import type { CommodityRange, CommodityPrice } from "@/lib/types";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";

export async function fetchDashboardPayload(
  period: DashboardPeriod,
  date: string | null
): Promise<DashboardPayload> {
  const params = new URLSearchParams({ period });
  if (date) {
    params.set("date", date);
  }
  const response = await fetch(`/api/dashboard?${params.toString()}`, {
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Dashboard query failed (${response.status})`);
  }
  return hydrateDashboardPayload((await response.json()) as DashboardPayload);
}

export async function fetchPublicPrices(range: CommodityRange): Promise<CommodityPrice[]> {
  const response = await fetch(`/api/prices?range=${range}`, {
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Prices query failed (${response.status})`);
  }
  const json = (await response.json()) as { data: CommodityPrice[] };
  return json.data;
}
