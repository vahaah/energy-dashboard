#!/usr/bin/env npx tsx
/**
 * Submit every URL in the live sitemap to IndexNow.
 *
 *   npm run indexnow
 *   npx tsx scripts/indexnow.ts
 *
 * Fetches https://grid.vahaah.com/sitemap.xml, collects unique <loc> values,
 * and POSTs { host, key, keyLocation, urlList } to
 * https://api.indexnow.org/indexnow in batches of at most 10,000.
 * Prints each batch status. Exits non-zero if the sitemap fetch or a batch fails.
 */
import { pathToFileURL } from "node:url";
import { runIndexNow } from "../src/lib/indexnow";

export function invokedDirectly(moduleUrl = import.meta.url, entry = process.argv[1]): boolean {
  if (!entry) return false;
  return moduleUrl === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  runIndexNow()
    .then((code) => {
      if (code !== 0) process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
