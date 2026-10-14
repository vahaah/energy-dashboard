/**
 * Download the latest DESNZ Renewable Energy Planning Database quarterly CSV.
 *
 *   npx tsx scripts/catalogue/repd.ts
 *   npx tsx scripts/catalogue/repd.ts --offline
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256Bytes } from "../../src/lib/catalogue/canonical";
import { parseRepdCsv } from "../../src/lib/catalogue/assets/repd";
import type { CatalogueStation } from "../../src/lib/catalogue/assets/types";
import { fetchBytes, fetchText, normalizeInstant, readCache, writeCache } from "./http";

const PUBLICATION_URL =
  "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract";

export type RepdExtract = {
  bytes: Buffer;
  downloadUrl: string;
  publishedAt: string;
  edition: string;
  stations: CatalogueStation[];
  stats: ReturnType<typeof parseRepdCsv>["stats"];
};

function latestCsv(html: string): string {
  const match = /https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[a-z0-9]+\/REPD[^"'\s]+\.csv/i.exec(
    html,
  );
  const url = match?.[0];
  if (!url) {
    throw new Error(`no REPD CSV on ${PUBLICATION_URL}`);
  }
  return url;
}

function editionFromUrl(url: string): string {
  const match = /REPD_(?:P|p)ublication_(Q\d)_(\d{4})/.exec(url);
  if (!match?.[1] || !match[2]) {
    return "REPD";
  }
  return `REPD ${match[1]} ${match[2]}`;
}

export async function loadRepd(offline = false): Promise<RepdExtract> {
  const cache = resolve(process.cwd(), "data/catalogue/raw/repd.csv");
  const metaPath = resolve(process.cwd(), "data/catalogue/raw/repd.json");
  let bytes = offline ? readCache(cache) : null;
  let downloadUrl: string;
  let publishedAt: string;
  let edition: string;
  if (bytes && offline) {
    const meta = JSON.parse(readCache(metaPath)?.toString("utf8") ?? "{}") as {
      downloadUrl?: string;
      publishedAt?: string;
      edition?: string;
    };
    if (!meta.downloadUrl || !meta.publishedAt || !meta.edition) {
      throw new Error("offline REPD cache is missing data/catalogue/raw/repd.json");
    }
    downloadUrl = meta.downloadUrl;
    publishedAt = meta.publishedAt;
    edition = meta.edition;
  } else {
    const html = await fetchText(PUBLICATION_URL);
    downloadUrl = latestCsv(html);
    const instant = /datetime="([^"]+)"/.exec(html)?.[1];
    if (!instant) {
      throw new Error(`no publication time on ${PUBLICATION_URL}`);
    }
    publishedAt = normalizeInstant(instant);
    edition = editionFromUrl(downloadUrl);
    bytes = await fetchBytes(downloadUrl);
    writeCache(cache, bytes);
    writeFileSync(
      metaPath,
      JSON.stringify({ downloadUrl, publishedAt, edition }, null, 2) + "\n",
    );
  }
  const parsed = parseRepdCsv(new TextDecoder("windows-1252").decode(bytes));
  return { bytes, downloadUrl, publishedAt, edition, stations: parsed.stations, stats: parsed.stats };
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  const extract = await loadRepd(offline);
  console.log(
    JSON.stringify(
      {
        edition: extract.edition,
        publishedAt: extract.publishedAt,
        downloadUrl: extract.downloadUrl,
        extract_sha256: sha256Bytes(extract.bytes),
        ...extract.stats,
      },
      null,
      2,
    ),
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("repd.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
