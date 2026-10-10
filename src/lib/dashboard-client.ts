import type { CommodityRange, CommodityPrice } from "@/lib/types";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";

export async function fetchDashboardPayload(
  period: DashboardPeriod,
  date: string | null,
  commodityRange: CommodityRange = "90d"
): Promise<DashboardPayload> {
  const params = new URLSearchParams({ period, commodityRange });
  if (date) {
    params.set("date", date);
  }
  const response = await fetch(`/api/dashboard?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Dashboard query failed (${response.status})`);
  }
  return hydrateDashboardPayload((await response.json()) as DashboardPayload);
}

export async function fetchPublicPrices(range: CommodityRange): Promise<CommodityPrice[]> {
  const response = await fetch(`/api/prices?range=${range}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Prices query failed (${response.status})`);
  }
  const json = (await response.json()) as { data: CommodityPrice[] };
  return json.data;
}
