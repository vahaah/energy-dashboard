import type { MetadataRoute } from "next";
import { getHeadlineSnapshotsQueryParams } from "@/lib/dashboard-data";
import { latestObservedTimestamp } from "@/lib/health";
import { parseUtcDateTime } from "@/lib/london-time";
import { peekLatestPrices } from "@/lib/og/peek";
import { assetHref } from "@/lib/assets/href";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { SITE_URL } from "@/lib/site";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import type { CommodityPrice, EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

const GRID_LASTMOD_PATHS = new Set(["", "/today", "/llms.txt", "/data-health"]);
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
  const pages = SITEMAP_PATHS.map((entry) => {
    const lastModified = lastModifiedForPath(entry.path, stamps);
    return {
      url: `${SITE_URL}${entry.path}`,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      ...(lastModified ? { lastModified } : {}),
    };
  });
  const assets = loadAssetCatalogue().rows.map((row) => ({
    url: `${SITE_URL}${assetHref(row)}`,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
  return [...pages, ...assets];
}

async function sitemapStamps(): Promise<SitemapStamps> {
  const now = new Date();
  const [snapshots, prices] = await Promise.all([
    peekWarmedPipe<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
      range: "24h",
      now,
    }),
    peekLatestPrices(),
  ]);
  return {
    grid: gridTimestamp(snapshots, now),
    gas: latestCommodityTimestamp(prices),
  };
}

function gridTimestamp(rows: EnergySnapshot[] | null, now: Date): Date | undefined {
  const latest = latestObservedTimestamp(
    (rows ?? []).map((row) => row.timestamp),
    now
  );
  if (!latest) {
    return undefined;
  }
  const date = parseUtcDateTime(latest);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
