import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { SITE_ORIGIN } from "@/lib/site";

export async function loadHomepagePayload(): Promise<DashboardPayload | null> {
  const payload = await loadDashboardPayload({ period: "day" }).catch(() => null);
  if (payload?.facts.referenceTimestamp) {
    return payload;
  }

  const response = await fetch(`${SITE_ORIGIN}/api/dashboard?period=day`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    return payload;
  }

  return hydrateDashboardPayload((await response.json()) as DashboardPayload);
}
