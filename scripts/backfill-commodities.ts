#!/usr/bin/env npx tsx
/**
 * Idempotent commodity-desk backfill into Tinybird commodity_prices.
 *
 * Usage:
 *   npx tsx scripts/backfill-commodities.ts --dry-run
 *   npx tsx scripts/backfill-commodities.ts --from 2025-01-01 --to 2026-09-27
 *   npx tsx scripts/backfill-commodities.ts --purge-stray --dry-run
 *   npx tsx scripts/backfill-commodities.ts --purge-stray
 *
 * Re-runs are safe: rows are de-duplicated on (commodity, date) and the
 * datasource is ReplacingMergeTree(date, commodity).
 *
 * Env vars (from .env.local at the repo root):
 *   TINYBIRD_URL, TINYBIRD_TOKEN  — required to ingest or --purge-stray
 *   EIA_API_KEY                   — required for Brent/WTI/Henry Hub (never DEMO_KEY)
 *
 * World Bank Pink Sheet and National Gas SAP need no keys.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_COMMODITIES,
  STRAY_DAILY_MONTHLY_SQL,
  isStrayDailyMonthlyCommodity,
} from "../src/lib/commodity-series";
import {
  EIA_COMMODITIES,
  eiaApiKeyFromEnv,
  fetchEiaRange,
  rejectStoredPriceRows,
  type PriceRow,
} from "../src/lib/ingest/collect-prices";
import { fetchGbGasSapRange, inclusiveDateChunks } from "../src/lib/gb-gas-sap";
import { formatIsoDate } from "../src/lib/london-time";
import { fetchWorldBankMonthly } from "../src/lib/world-bank-pink-sheet";
import { reportPublicCommodityGaps } from "../src/lib/commodity-gaps";

const scriptDir = import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(scriptDir, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const EIA_KEY = eiaApiKeyFromEnv(process.env.EIA_API_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const purgeStray = args.includes("--purge-stray");

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

const from = getArg("from") ?? "2025-01-01";
const to = getArg("to") ?? formatIsoDate(new Date());

const existingSql = [
  "SELECT commodity, toString(date) AS date",
  "FROM commodity_prices FINAL",
  `WHERE commodity IN (${PUBLIC_COMMODITIES.map((commodity) => `'${commodity}'`).join(", ")})`,
  "ORDER BY commodity, date",
].join("\n");

const straySql = [
  "SELECT toString(date) AS date, commodity, price, currency, unit",
  "FROM commodity_prices FINAL",
  `WHERE ${STRAY_DAILY_MONTHLY_SQL}`,
  "ORDER BY commodity, date",
].join("\n");

async function querySql<T>(sql: string): Promise<T[]> {
  if (!TOKEN) {
    return [];
  }
  const response = await fetch(`${API_URL}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: `${sql} FORMAT JSON` }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Tinybird SQL failed (${response.status}): ${body}`);
  }
  const json = JSON.parse(body) as { data?: T[] };
  return json.data ?? [];
}

async function ingestRows(rows: PriceRow[]) {
  const ndjson = rows.map((row) => JSON.stringify(row)).join("\n");
  const response = await fetch(`${API_URL}/v0/events?name=commodity_prices&format=ndjson`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tinybird ingest error (${response.status}): ${body}`);
  }
}

async function deleteStrayRows() {
  const response = await fetch(`${API_URL}/v0/datasources/commodity_prices/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ delete_condition: STRAY_DAILY_MONTHLY_SQL }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Tinybird delete failed (${response.status}): ${body}`);
  }
  return body;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function printRows(label: string, rows: PriceRow[]) {
  console.log(`${label}: ${rows.length}`);
  for (const row of rows.slice(0, 8)) {
    console.log(`   ${row.date} ${row.commodity} ${row.price} ${row.unit}`);
  }
  if (rows.length > 8) {
    console.log(`   … ${rows.length - 8} more`);
  }
}

async function purgeStrayRows() {
  console.log("\n--purge-stray: daily leftover rows on monthly series\n");
  console.log(straySql);
  console.log("");

  const listed = TOKEN
    ? await querySql<PriceRow>(straySql)
    : [];
  const stray = listed.filter((row) => isStrayDailyMonthlyCommodity(row));
  printRows("Stray rows", stray);

  if (stray.length === 0) {
    console.log("No stray daily monthly rows to delete.\n");
    return;
  }

  if (dryRun) {
    console.log("Dry-run only. Re-run with --purge-stray (no --dry-run) to delete these rows.\n");
    return;
  }

  if (!TOKEN) {
    console.error("TINYBIRD_TOKEN is not set. Cannot delete stray rows.");
    process.exit(1);
  }

  const result = await deleteStrayRows();
  console.log(`Delete accepted:\n${result}\n`);
}

async function collectRows(): Promise<PriceRow[]> {
  const collected: PriceRow[] = [];

  if (!EIA_KEY) {
    console.log("Skipping EIA — set EIA_API_KEY (DEMO_KEY is not used).\n");
  } else {
    console.log(`Fetching EIA ${from} → ${to}`);
    for (const { commodity } of EIA_COMMODITIES) {
      process.stdout.write(`   ${commodity}… `);
    }
    const eia = await fetchEiaRange(EIA_KEY, from, to);
    collected.push(...eia);
    console.log(`\n   ${eia.length} EIA rows\n`);
  }

  console.log(`Fetching World Bank Pink Sheet ${from} → ${to}`);
  const pinkSheet = await fetchWorldBankMonthly({ from, to });
  collected.push(...pinkSheet);
  console.log(`   ${pinkSheet.length} monthly rows\n`);

  console.log(`Fetching National Gas SAP ${from} → ${to}`);
  const chunks = inclusiveDateChunks(from, to);
  let sapCount = 0;
  for (const chunk of chunks) {
    process.stdout.write(`   ${chunk.from} → ${chunk.to} `);
    const sap = await fetchGbGasSapRange(chunk.from, chunk.to);
    collected.push(...sap);
    sapCount += sap.length;
    process.stdout.write(`${sap.length} rows\n`);
    await sleep(250);
  }
  console.log(`   ${sapCount} SAP rows\n`);

  return collected;
}

async function main() {
  console.log(`Commodity desk backfill: ${from} → ${to}`);
  console.log(dryRun ? "Mode: --dry-run\n" : "Mode: ingest\n");

  if (!dryRun && !TOKEN) {
    console.error("TINYBIRD_TOKEN is not set. Add it to .env.local at the repo root.");
    process.exit(1);
  }

  if (purgeStray) {
    await purgeStrayRows();
  }

  const fetched = await collectRows();
  const stored = TOKEN
    ? await querySql<Array<{ commodity: string; date: string }>>(existingSql)
    : [];
  const fresh = rejectStoredPriceRows(fetched, stored);
  const reports = reportPublicCommodityGaps(fetched, from, to);

  console.log("Fetched coverage (source, not Tinybird):");
  for (const report of reports) {
    console.log(
      `   ${report.commodity}: ${report.count} ${report.cadence} ${report.firstDate ?? "—"} → ${report.lastDate ?? "—"} missing=${report.missingDates.length} stray=${report.strayDates.length}`
    );
  }
  console.log("");
  printRows(dryRun ? "Would ingest (not already stored)" : "Ingesting new rows", fresh);
  console.log(`Already stored (skipped): ${fetched.length - fresh.length}`);

  if (dryRun) {
    console.log("\nDry-run only. Re-run without --dry-run to append the new rows.");
    return;
  }

  for (let index = 0; index < fresh.length; index += 500) {
    await ingestRows(fresh.slice(index, index + 500));
  }
  console.log(`\nIngested ${fresh.length} rows into commodity_prices.`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
