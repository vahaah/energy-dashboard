import type { MetadataRoute } from "next";
import {
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { parseUtcDateTime } from "@/lib/london-time";
import { peekLatestPrices } from "@/lib/og/peek";
import { peekThroughCache } from "@/lib/redis-cache";
import { SITE_URL } from "@/lib/site";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import type { CommodityPrice } from "@/lib/types";

const GRID_LASTMOD_PATHS = new Set(["", "/today", "/llms.txt"]);
const GAS_LASTMOD_PATHS = new Set(["/prices/gas"]);

export type SitemapStamps = {
  grid?: Date;
  gas?: Date;
};

export function lastModifiedForPath(path: string, stamps: SitemapStamps): Date | undefined {
  if (GRID_LASTMOD_PATHS.has(path)) {
    return stamps.grid;
  }
  if (GAS_LASTMOD_PATHS.has(path)) {
    return stamps.gas;
  }
  return undefined;
}

export function latestCommodityTimestamp(
  prices: CommodityPrice[] | null | undefined
): Date | undefined {
  if (!prices || prices.length === 0) {
    return undefined;
  }
  let latest = "";
  for (const row of prices) {
    if (row.date > latest) {
      latest = row.date;
    }
  }
  if (!latest) {
    return undefined;
  }
  const date = parseUtcDateTime(`${latest}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stamps = await sitemapStamps().catch(() => ({}));
  return SITEMAP_PATHS.map((entry) => {
    const lastModified = lastModifiedForPath(entry.path, stamps);
    return {
      url: `${SITE_URL}${entry.path}`,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      ...(lastModified ? { lastModified } : {}),
    };
  });
}

async function sitemapStamps(): Promise<SitemapStamps> {
  const [payload, prices] = await Promise.all([
    peekThroughCache<DashboardPayload>(
      dashboardPayloadCacheKey("day", null),
      dashboardPayloadPolicy("day")
    ),
    peekLatestPrices(),
  ]);
  return {
    grid: gridTimestamp(payload),
    gas: latestCommodityTimestamp(prices),
  };
}

function gridTimestamp(payload: DashboardPayload | null): Date | undefined {
  if (!payload?.facts.referenceTimestamp) {
    return undefined;
  }
  const date = parseUtcDateTime(payload.facts.referenceTimestamp);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
