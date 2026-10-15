#!/usr/bin/env npx tsx
/**
 * Post-deploy IndexNow one-shot.
 *
 *   INDEXNOW_KEY=... npm run indexnow:once
 *
 * Waits until https://grid.vahaah.com/release-1a.txt serves the Phase 1A marker,
 * then POSTs only the sitemap URLs that are not in INDEXNOW_SETTLED_PATHS.
 * A 200 from /gas is not enough: that route is already on the previous
 * production deployment. The key is read from the environment and is never
 * printed. A second run of the full sitemap script is a separate command
 * and is not this path.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY_PATH,
  INDEXNOW_RELEASE_PROBE_PATH,
  indexNowReleaseReady,
  indexNowReleaseSitemapUrl,
  redactIndexNow,
  runIndexNow,
  sitemapLocs,
  unsubmittedIndexNowUrls,
} from "../src/lib/indexnow";

const PROBE_URL = process.env.INDEXNOW_PROBE_URL ?? `https://${INDEXNOW_HOST}${INDEXNOW_RELEASE_PROBE_PATH}`;
const WAIT_MS = 10 * 60 * 1000;
const INTERVAL_MS = 15_000;

function fail(key: string, line: string): never {
  console.error(redactIndexNow(line, key));
  process.exit(1);
}

function keyFromEnv(): string {
  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  if (key.length === 0) {
    console.error("INDEXNOW_KEY is unset");
    process.exit(1);
  }
  const published = readFileSync(resolve(process.cwd(), `public${INDEXNOW_KEY_PATH}`), "utf8").trim();
  if (key !== published) {
    fail(key, "INDEXNOW_KEY does not match the public key file");
  }
  return key;
}

async function waitForProbe(key: string): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    try {
      const response = await fetch(PROBE_URL, { redirect: "manual", cache: "no-store" });
      const body = await response.text();
      if (indexNowReleaseReady(response.status, body)) {
        return;
      }
      console.error(redactIndexNow(`probe: ${response.status}`, key));
    } catch (error) {
      const message = error instanceof Error ? error.message : "probe failed";
      console.error(redactIndexNow(`probe: ${message}`, key));
    }
    if (Date.now() >= deadline) {
      fail(key, "release marker was not served");
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, INTERVAL_MS));
  }
}

export async function submitNewIndexNowUrls(key: string): Promise<number> {
  await waitForProbe(key);
  let sitemap: Response;
  try {
    sitemap = await fetch(indexNowReleaseSitemapUrl(), { redirect: "manual", cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sitemap failed";
    console.error(redactIndexNow(`sitemap: ${message}`, key));
    return 1;
  }
  if (!sitemap.ok) {
    console.error(redactIndexNow(`sitemap: ${sitemap.status}`, key));
    return 1;
  }
  const urls = unsubmittedIndexNowUrls(sitemapLocs(await sitemap.text()));
  console.log(redactIndexNow(`submitting ${urls.length} urls`, key));
  return runIndexNow({
    key,
    urls,
    log: (line) => console.log(redactIndexNow(line, key)),
  });
}

async function main(): Promise<void> {
  const code = await submitNewIndexNowUrls(keyFromEnv());
  if (code !== 0) {
    process.exit(code);
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("indexnow-once.ts") || entry.endsWith("indexnow-once.js")) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "indexnow failed";
    console.error(redactIndexNow(message, process.env.INDEXNOW_KEY ?? ""));
    process.exit(1);
  });
}
