#!/usr/bin/env npx tsx
/**
 * Preview / delete OilPriceAPI daily TTF leftovers stored as eu_natural_gas.
 *
 * Those rows are daily (not the 1st of the month) and were labelled $/MMBtu
 * even though the values are EUR/MWh. FRED monthly TTF stays on YYYY-MM-01.
 *
 * Usage:
 *   npx tsx scripts/cleanup-mislabelled-ttf.ts
 *   npx tsx scripts/cleanup-mislabelled-ttf.ts --execute
 *
 * Default is preview only. --execute runs the DELETE after you have reviewed
 * the preview. Do not run --execute from CI or agents.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { OILPRICE_DAILY_EU_NATURAL_GAS_SQL } from "../src/lib/commodity-series";

config({ path: resolve(import.meta.dirname, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const execute = process.argv.includes("--execute");

const previewSql = [
  "SELECT date, commodity, price, currency, unit",
  "FROM commodity_prices FINAL",
  `WHERE ${OILPRICE_DAILY_EU_NATURAL_GAS_SQL}`,
  "ORDER BY date",
].join("\n");

const deleteSql = `DELETE FROM commodity_prices WHERE ${OILPRICE_DAILY_EU_NATURAL_GAS_SQL}`;

const inspectMonthStartSql = [
  "SELECT date, commodity, price, currency, unit",
  "FROM commodity_prices FINAL",
  "WHERE commodity = 'eu_natural_gas'",
  "  AND toDayOfMonth(date) = 1",
  "  AND (price > 40 OR currency != 'USD')",
  "ORDER BY date",
].join("\n");

async function main() {
  console.log("Target: OilPriceAPI daily leftovers on eu_natural_gas.");
  console.log("Keeps FRED monthly rows (date = YYYY-MM-01).\n");
  console.log("Preview SQL:\n");
  console.log(previewSql);
  console.log("\nDelete SQL (review before --execute):\n");
  console.log(deleteSql);
  console.log("\nOptional 1st-of-month inspection (do not auto-delete):\n");
  console.log(inspectMonthStartSql);
  console.log("");

  if (!TOKEN) {
    console.log("TINYBIRD_TOKEN is not set. Printed SQL only — nothing was sent.");
    process.exit(execute ? 1 : 0);
  }

  const previewResponse = await fetch(`${API_URL}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: `${previewSql} FORMAT JSON` }),
  });

  const previewBody = await previewResponse.text();
  if (!previewResponse.ok) {
    console.error(`Preview query failed (${previewResponse.status}): ${previewBody}`);
    process.exit(1);
  }

  console.log("Preview result:\n");
  console.log(previewBody);

  if (!execute) {
    console.log("Preview only. Re-run with --execute after you have reviewed the rows.");
    process.exit(0);
  }

  const deleteResponse = await fetch(`${API_URL}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: deleteSql }),
  });

  const deleteBody = await deleteResponse.text();
  if (!deleteResponse.ok) {
    console.error(`Delete failed (${deleteResponse.status}): ${deleteBody}`);
    process.exit(1);
  }

  console.log("Delete accepted:\n");
  console.log(deleteBody);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
