#!/usr/bin/env npx tsx
/**
 * Submit sitemap URLs to IndexNow.
 *
 *   npm run indexnow
 *   npm run indexnow -- --all
 *   npx tsx scripts/indexnow.ts
 *   npx tsx scripts/indexnow.ts --all
 *
 * Fetches https://grid.vahaah.com/sitemap.xml, follows one sitemap index,
 * and reads `<loc>` plus `<lastmod>` from each child urlset. POSTs
 * { host, key, keyLocation, urlList } to
 * https://api.indexnow.org/indexnow in batches of at most 10,000.
 * 200 and 202 are success. Other statuses and network errors retry
 * when they are transient, then the batch is a failure.
 *
 * The default submits URLs whose lastmod is newer than that child
 * sitemap's checkpoint. GitHub Actions stores the checkpoint in
 * `.indexnow/marker.json` (`INDEXNOW_MARKER_FILE`). Redis or Vercel Blob
 * is used only when that store is configured and the file env is unset.
 * A missing marker submits every sitemap URL and does not fail. A pages
 * build time does not hide an older catalogue stream. `--all` submits
 * every page URL and needs no store. The key is the checked-in public
 * file and is never printed.
 */
import { pathToFileURL } from "node:url";
import { runIndexNow, type IndexNowMode } from "../src/lib/indexnow";

export function invokedDirectly(moduleUrl = import.meta.url, entry = process.argv[1]): boolean {
  if (!entry) return false;
  return moduleUrl === pathToFileURL(entry).href;
}

export function parseIndexNowArgs(argv: readonly string[]): IndexNowMode {
  if (argv.length === 0) return "changed";
  if (argv.length === 1 && argv[0] === "--all") return "all";
  throw new Error("usage: tsx scripts/indexnow.ts [--all]");
}

async function main(): Promise<void> {
  let mode: IndexNowMode;
  try {
    mode = parseIndexNowArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const code = await runIndexNow({ mode });
  if (code !== 0) process.exit(code);
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
