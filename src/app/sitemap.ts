import type { MetadataRoute } from "next";
import {
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { parseUtcDateTime } from "@/lib/london-time";
import { peekThroughCache } from "@/lib/redis-cache";
import { SITE_URL } from "@/lib/site";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = await sitemapLastModified().catch(() => undefined);
  return SITEMAP_PATHS.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    ...(lastModified ? { lastModified } : {}),
  }));
}

async function sitemapLastModified(): Promise<Date | undefined> {
  const payload = await peekThroughCache<DashboardPayload>(
    dashboardPayloadCacheKey("day", null),
    dashboardPayloadPolicy("day")
  );
  if (!payload?.facts.referenceTimestamp) {
    return undefined;
  }
  return parseUtcDateTime(payload.facts.referenceTimestamp);
}
