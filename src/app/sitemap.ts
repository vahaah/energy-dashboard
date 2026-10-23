import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MetadataRoute } from "next";
import { getHeadlineSnapshotsQueryParams } from "@/lib/dashboard-data";
import { latestObservedTimestamp } from "@/lib/health";
import { parseUtcDateTime } from "@/lib/london-time";
import { peekLatestPrices } from "@/lib/og/peek";
import { assetHref } from "@/lib/assets/href";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { projectPath } from "@/lib/projects/href";
import { assetDetailIndexable, projectDetailIndexable } from "@/lib/seo/indexable";
import { SITE_URL } from "@/lib/site";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import type { CommodityPrice, EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

const GRID_LASTMOD_PATHS = new Set(["", "/today", "/data-health"]);

export type SitemapId = "pages" | "assets" | "projects";
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

export function generateSitemaps(): { id: SitemapId }[] {
  return [{ id: "pages" }, { id: "assets" }, { id: "projects" }];
}

export function catalogueLastModified(): { assets: Date; projects: Date } {
  const repd = JSON.parse(readFileSync(resolve("data/catalogue/repd_pipeline.json"), "utf8")) as { published_at?: unknown };
  const assets = instantOrEpoch(repd.published_at);
  let projects = assets;
  const lines = readFileSync(resolve("data/catalogue/source_releases.ndjson"), "utf8").split("\n");
  for (const line of lines) {
    if (!line.includes("neso-open-data:tec-register")) {
      continue;
    }
    const row = JSON.parse(line) as { dataset_id?: unknown; published_at?: unknown };
    if (row.dataset_id !== "neso-open-data:tec-register") {
      continue;
    }
    const published = instantOrEpoch(row.published_at);
    if (published > projects) {
      projects = published;
    }
  }
  return { assets, projects };
}

function instantOrEpoch(value: unknown): Date {
  if (typeof value !== "string") {
    return new Date(0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export default async function sitemap(props?: { id?: SitemapId | Promise<SitemapId> }): Promise<MetadataRoute.Sitemap> {
  const id = props?.id == null ? "pages" : await props.id;
  if (id === "assets") {
    return assetEntries(catalogueLastModified().assets);
  }
  if (id === "projects") {
    return projectEntries(catalogueLastModified().projects);
  }
  const stamps = await sitemapStamps().catch(() => ({}));
  return pageEntries(stamps, new Date());
}

function pageEntries(stamps: SitemapStamps, builtAt: Date): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    lastModified: lastModifiedForPath(entry.path, stamps) ?? builtAt,
  }));
}

function assetEntries(lastModified: Date): MetadataRoute.Sitemap {
  return loadAssetCatalogue()
    .rows.filter(assetDetailIndexable)
    .map((row) => ({
      url: `${SITE_URL}${assetHref(row)}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      lastModified,
    }));
}

function projectEntries(lastModified: Date): MetadataRoute.Sitemap {
  return loadProjectCatalogue()
    .projects.filter(projectDetailIndexable)
    .map((project) => ({
      url: `${SITE_URL}${projectPath(project.project_id, project.name)}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
      lastModified,
    }));
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
