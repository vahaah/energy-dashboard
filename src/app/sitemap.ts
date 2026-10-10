import type { MetadataRoute } from "next";
import {
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { parseUtcDateTime } from "@/lib/london-time";
import { peekThroughCache } from "@/lib/redis-cache";
import { SITE_URL } from "@/lib/site";

export const SITEMAP_PATHS = [
  { path: "", changeFrequency: "hourly" as const, priority: 1 },
  { path: "/today", changeFrequency: "hourly" as const, priority: 0.9 },
  { path: "/records", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/explained/price-cap", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/prices/gas", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/methodology", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/api", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/data-sources", changeFrequency: "monthly" as const, priority: 0.4 },
];

export async function sitemapLastModified(): Promise<Date | undefined> {
  const payload = await peekThroughCache<DashboardPayload>(
    dashboardPayloadCacheKey("day", null),
    dashboardPayloadPolicy("day")
  );
  if (!payload?.facts.referenceTimestamp) {
    return undefined;
  }
  return parseUtcDateTime(payload.facts.referenceTimestamp);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = await sitemapLastModified().catch(() => undefined);
  return SITEMAP_PATHS.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    ...(lastModified ? { lastModified } : {}),
  }));
}
