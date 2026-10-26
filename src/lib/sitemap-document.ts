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
const GAS_LASTMOD_PATHS = new Set(["/prices/gas"]);

/** Google's uncompressed limits. https://www.sitemaps.org/protocol.html */
export const SITEMAP_URL_LIMIT = 50_000;
export const SITEMAP_BYTE_LIMIT = 50 * 1024 * 1024;

export const SITEMAP_XML_CONTENT_TYPE = "application/xml; charset=utf-8";

export type SitemapId = "pages" | "assets" | "projects";

export const SITEMAP_IDS = ["pages", "assets", "projects"] as const satisfies readonly SitemapId[];

export type SitemapStamps = {
  grid?: Date;
  gas?: Date;
};

export function generateSitemaps(): { id: SitemapId }[] {
  return SITEMAP_IDS.map((id) => ({ id }));
}

export function sitemapChildPath(id: SitemapId): string {
  return `/sitemap/${id}.xml`;
}

export function sitemapIdFromParam(param: string): SitemapId | null {
  if (!param.endsWith(".xml")) {
    return null;
  }
  const id = param.slice(0, -".xml".length);
  switch (id) {
    case "pages":
    case "assets":
    case "projects":
      return id;
    default:
      return null;
  }
}

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
  prices: CommodityPrice[] | null | undefined,
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

export function catalogueLastModified(): { assets: Date; projects: Date } {
  const repd = JSON.parse(readFileSync(resolve("data/catalogue/repd_pipeline.json"), "utf8")) as {
    published_at?: unknown;
  };
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

export default async function sitemap(props?: {
  id?: SitemapId | Promise<SitemapId>;
}): Promise<MetadataRoute.Sitemap> {
  const id = props?.id == null ? "pages" : await props.id;
  return sitemapEntries(id);
}

export async function sitemapEntries(id: SitemapId, now = new Date()): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case "assets":
      return assetEntries(catalogueLastModified().assets);
    case "projects":
      return projectEntries(catalogueLastModified().projects);
    case "pages": {
      const stamps = await sitemapStamps(now).catch(() => ({}));
      return pageEntries(stamps, now);
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

export async function sitemapIndexXml(now = new Date()): Promise<string> {
  const catalogue = catalogueLastModified();
  const pages = await sitemapEntries("pages", now);
  const children = SITEMAP_IDS.map((id) => ({
    loc: `${SITE_URL}${sitemapChildPath(id)}`,
    lastmod: indexLastModified(id, pages, catalogue, now),
  }));
  return renderSitemapIndex(children);
}

export async function sitemapChildXml(id: SitemapId, now = new Date()): Promise<string> {
  const entries = await sitemapEntries(id, now);
  if (entries.length > SITEMAP_URL_LIMIT) {
    throw new Error(`Sitemap ${id} has ${entries.length} URLs`);
  }
  const xml = renderUrlset(entries);
  const bytes = Buffer.byteLength(xml, "utf8");
  if (bytes > SITEMAP_BYTE_LIMIT) {
    throw new Error(`Sitemap ${id} is ${bytes} bytes`);
  }
  return xml;
}

export function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": SITEMAP_XML_CONTENT_TYPE,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function indexLastModified(
  id: SitemapId,
  pages: MetadataRoute.Sitemap,
  catalogue: { assets: Date; projects: Date },
  builtAt: Date,
): Date {
  switch (id) {
    case "pages":
      return latestEntryLastModified(pages, builtAt);
    case "assets":
      return catalogue.assets;
    case "projects":
      return catalogue.projects;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function latestEntryLastModified(entries: MetadataRoute.Sitemap, fallback: Date): Date {
  let latest = fallback.getTime();
  for (const entry of entries) {
    const value = entry.lastModified;
    const time = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (Number.isFinite(time) && time > latest) {
      latest = time;
    }
  }
  return new Date(latest);
}

function renderSitemapIndex(children: readonly { loc: string; lastmod: Date }[]): string {
  const body = children
    .map(
      (child) =>
        `<sitemap>\n<loc>${escapeXml(child.loc)}</loc>\n<lastmod>${escapeXml(child.lastmod.toISOString())}</lastmod>\n</sitemap>\n`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</sitemapindex>\n`;
}

function renderUrlset(entries: MetadataRoute.Sitemap): string {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
  content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const item of entries) {
    content += "<url>\n";
    content += `<loc>${escapeXml(item.url)}</loc>\n`;
    if (item.lastModified) {
      const serialized = item.lastModified instanceof Date ? item.lastModified.toISOString() : item.lastModified;
      content += `<lastmod>${escapeXml(serialized)}</lastmod>\n`;
    }
    if (item.changeFrequency) {
      content += `<changefreq>${escapeXml(item.changeFrequency)}</changefreq>\n`;
    }
    if (typeof item.priority === "number") {
      content += `<priority>${item.priority}</priority>\n`;
    }
    content += "</url>\n";
  }
  content += "</urlset>\n";
  return content;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

async function sitemapStamps(now: Date): Promise<SitemapStamps> {
  const [snapshots, prices] = await Promise.all([
    peekWarmedPipe<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
      range: "24h",
      now,
    }),
    peekLatestPrices(now),
  ]);
  return {
    grid: gridTimestamp(snapshots, now),
    gas: latestCommodityTimestamp(prices),
  };
}

function gridTimestamp(rows: EnergySnapshot[] | null, now: Date): Date | undefined {
  const latest = latestObservedTimestamp(
    (rows ?? []).map((row) => row.timestamp),
    now,
  );
  if (!latest) {
    return undefined;
  }
  const date = parseUtcDateTime(latest);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function instantOrEpoch(value: unknown): Date {
  if (typeof value !== "string") {
    return new Date(0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}
