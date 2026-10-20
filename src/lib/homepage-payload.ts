import { cache } from "react";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { SITE_ORIGIN } from "@/lib/site";

export const loadHomepagePayload = cache(async function loadHomepagePayload(): Promise<DashboardPayload | null> {
  const payload = await loadDashboardPayload({ period: "day" }).catch(() => null);
  if (payload?.facts.referenceTimestamp) {
    return payload;
  }

  return (await loadPublicDashboardFallback()) ?? payload;
});

async function loadPublicDashboardFallback(): Promise<DashboardPayload | null> {
  const response = await fetch(`${SITE_ORIGIN}/api/dashboard?period=day`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const body = await response.json().catch(() => null);
  if (!body) {
    return null;
  }

  return hydrateDashboardPayload(body as DashboardPayload);
}
