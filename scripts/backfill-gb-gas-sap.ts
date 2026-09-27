#!/usr/bin/env npx tsx
/**
 * One-off backfill of National Gas System Average Price (PUBOB603) into
 * commodity_prices as gb_gas_sap (GBP, p/kWh).
 *
 * Usage:
 *   npx tsx scripts/backfill-gb-gas-sap.ts
 *   npx tsx scripts/backfill-gb-gas-sap.ts --from 2025-01-01 --to 2026-09-27
 *   npx tsx scripts/backfill-gb-gas-sap.ts --execute
 *
 * Default is dry-run (preview only). --execute POSTs new rows to Tinybird
 * Events API. Skips dates already stored. Do not run --execute from CI or
 * agents against production.
 *
 * Env vars:
 *   TINYBIRD_URL, TINYBIRD_TOKEN (required for --execute and skip-existing)
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import {
  fetchGbGasSapRange,
  GB_GAS_SAP_COMMODITY,
  inclusiveDateChunks,
  rejectStoredSapDates,
} from "../src/lib/gb-gas-sap";
import { getLondonDate } from "../src/lib/london-time";

config({ path: resolve(import.meta.dirname, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const args = process.argv.slice(2);
const execute = args.includes("--execute");

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

const from = getArg("from") ?? "2025-01-01";
const to = getArg("to") ?? getLondonDate(new Date());
const chunks = inclusiveDateChunks(from, to);

const existingSql = [
  "SELECT DISTINCT toString(date) AS date",
  "FROM commodity_prices FINAL",
  `WHERE commodity = '${GB_GAS_SAP_COMMODITY}'`,
  "ORDER BY date",
].join("\n");

async function queryExistingDates(): Promise<string[]> {
  if (!TOKEN) {
    console.log("TINYBIRD_TOKEN is not set. Treating stored dates as empty.\n");
    return [];
  }

  const response = await fetch(`${API_URL}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: `${existingSql} FORMAT JSON` }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Existing-date query failed (${response.status}): ${body}`);
  }

  const json = JSON.parse(body) as { data?: Array<{ date: string }> };
  return (json.data ?? []).map((row) => row.date);
}

async function ingestRows(rows: Array<Record<string, unknown>>) {
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

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  console.log(`GB gas SAP backfill: ${from} → ${to}`);
  console.log(`Chunks: ${chunks.length} × up to 90 gas days`);
  console.log(execute ? "Mode: --execute\n" : "Mode: dry-run (pass --execute to ingest)\n");
  console.log("Existing-date SQL:\n");
  console.log(existingSql);
  console.log("");

  if (execute && !TOKEN) {
    console.error("TINYBIRD_TOKEN is not set. Add it to .env.local at the repo root.");
    process.exit(1);
  }

  const storedDates = await queryExistingDates();
  console.log(`Already stored: ${storedDates.length} gb_gas_sap dates\n`);

  let fetched = 0;
  let skipped = 0;
  let ingested = 0;

  for (const chunk of chunks) {
    process.stdout.write(`   ${chunk.from} → ${chunk.to} `);
    const rows = await fetchGbGasSapRange(chunk.from, chunk.to);
    const fresh = rejectStoredSapDates(rows, storedDates);
    fetched += rows.length;
    skipped += rows.length - fresh.length;

    if (fresh.length === 0) {
      process.stdout.write(`fetched ${rows.length}, skipped ${rows.length}\n`);
      await sleep(250);
      continue;
    }

    if (execute) {
      await ingestRows(fresh);
      ingested += fresh.length;
      process.stdout.write(`fetched ${rows.length}, ingested ${fresh.length}\n`);
    } else {
      process.stdout.write(`fetched ${rows.length}, would ingest ${fresh.length}\n`);
    }

    await sleep(250);
  }

  console.log("");
  console.log(`Fetched ${fetched} SAP rows, skipped ${skipped} already stored.`);
  if (execute) {
    console.log(`Ingested ${ingested} new gb_gas_sap rows into commodity_prices.`);
  } else {
    console.log(`Dry-run only. Re-run with --execute to append ${fetched - skipped} new rows.`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
