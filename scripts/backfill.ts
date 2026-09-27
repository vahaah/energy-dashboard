#!/usr/bin/env npx tsx
/**
 * Backfill historical data from all sources into Tinybird.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts --days 30
 *   npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18
 *   (--from/--to are inclusive UK settlement dates, not UTC midnights)
 *   npx tsx scripts/backfill.ts --days 90 --dry-run
 *   npx tsx scripts/backfill.ts --days 7 --only prices
 *   npx tsx scripts/backfill.ts --days 7 --only snapshots
 *   npx tsx scripts/backfill.ts --days 30 --only generation
 *
 * Env vars required:
 *   TINYBIRD_URL, TINYBIRD_TOKEN (or set in .env.local at the repo root)
 *   EIA_API_KEY (required for EIA history; DEMO_KEY is not used)
 *   FRED_API_KEY (optional — monthly TTF + LNG in $/MMBtu)
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { backfillSettlementDates } from "../src/lib/backfill-range";
import { EIA_COMMODITIES, FRED_COMMODITIES } from "../src/lib/ingest/collect-prices";
import { collectGenerationForSettlementDate } from "../src/lib/ingest/collect-generation";
import { collectSnapshotsForSettlementDate } from "../src/lib/ingest/collect-grid";

config({ path: resolve(import.meta.dirname, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const EIA_KEY = process.env.EIA_API_KEY ?? "";
const FRED_KEY = process.env.FRED_API_KEY ?? "";

if (!TOKEN) {
  console.error("TINYBIRD_TOKEN is not set. Add it to .env.local at the repo root.");
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const dryRun = hasFlag("dry-run");
const only = getArg("only");
const daysArg = getArg("days");
const fromArg = getArg("from");
const toArg = getArg("to");

const now = new Date();
const settlementDates = backfillSettlementDates({
  from: fromArg,
  to: toArg,
  days: daysArg === undefined ? undefined : Number(daysArg),
  now,
});

if (settlementDates.length === 0) {
  console.error("No UK settlement dates in range. --from/--to are inclusive YYYY-MM-DD dates.");
  process.exit(1);
}

const startDate = settlementDates[0];
const endDate = settlementDates[settlementDates.length - 1];

console.log(`\nBackfill settlement dates: ${startDate} → ${endDate}`);
console.log(`   Days: ${settlementDates.length}`);
if (only) console.log(`   Only: ${only}`);
if (dryRun) console.log("   DRY RUN — no data will be ingested\n");
else console.log("");

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`   ${res.status} ${res.statusText} for ${url.slice(0, 100)}`);
    return null;
  }
  return (await res.json()) as T;
}

async function ingestRows(datasource: string, rows: Record<string, unknown>[]) {
  if (dryRun) {
    console.log(`   Would ingest ${rows.length} rows into ${datasource}`);
    return;
  }
  const ndjson = rows.map((row) => JSON.stringify(row)).join("\n");
  const res = await fetch(`${API_URL}/v0/events?name=${datasource}&format=ndjson`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tinybird ingest error (${res.status}): ${body}`);
  }
}

async function backfillSnapshots() {
  console.log("Backfilling energy snapshots (half-hourly, UK settlement periods)...\n");

  let totalRows = 0;
  for (const settlementDate of settlementDates) {
    process.stdout.write(`   ${settlementDate} `);
    const rows = await collectSnapshotsForSettlementDate(settlementDate);
    if (rows.length > 0) {
      await ingestRows("energy_snapshots", rows);
      totalRows += rows.length;
      process.stdout.write(`${rows.length} periods\n`);
    } else {
      process.stdout.write("no data\n");
    }
    await sleep(300);
  }

  console.log(`\n   Total: ${totalRows} snapshot rows ingested\n`);
}

async function backfillGeneration() {
  console.log("Backfilling generation (FUELINST + NESO wind + Sheffield PV Live)...\n");

  let totalRows = 0;
  for (const settlementDate of settlementDates) {
    process.stdout.write(`   ${settlementDate} `);
    const { rows } = await collectGenerationForSettlementDate(settlementDate, now);
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        await ingestRows("generation_5min", rows.slice(i, i + 500));
      }
      totalRows += rows.length;
      process.stdout.write(`${rows.length} rows\n`);
    } else {
      process.stdout.write("no data\n");
    }
    await sleep(400);
  }

  console.log(`\n   Total: ${totalRows} generation rows ingested\n`);
}

async function backfillPrices() {
  console.log("Backfilling commodity prices...\n");
  let totalRows = 0;

  if (!EIA_KEY || EIA_KEY === "DEMO_KEY") {
    console.log("   Skipping EIA — set EIA_API_KEY (DEMO_KEY is not used)\n");
  } else {
    for (const { series, commodity, unit, currency } of EIA_COMMODITIES) {
      process.stdout.write(`   ${commodity}: `);
      const url =
        `https://api.eia.gov/v2/seriesid/${series}` +
        `?api_key=${EIA_KEY}` +
        `&start=${startDate}` +
        `&end=${endDate}` +
        `&sort[0][column]=period&sort[0][direction]=asc` +
        `&length=5000`;

      const json = await fetchJSON<{ response: { data: Array<{ period: string; value: number | null }> } }>(url);
      const rows = (json?.response?.data ?? [])
        .filter((row) => row.value != null)
        .map((row) => ({
          date: row.period,
          commodity,
          price: row.value,
          currency,
          unit,
        }));

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          await ingestRows("commodity_prices", rows.slice(i, i + 500));
        }
        totalRows += rows.length;
        console.log(`${rows.length} days`);
      } else {
        console.log("no data");
      }
      await sleep(500);
    }
  }

  if (FRED_KEY) {
    for (const { id, commodity, unit, currency } of FRED_COMMODITIES) {
      process.stdout.write(`   ${commodity} (FRED): `);
      const json = await fetchJSON<{ observations: Array<{ date: string; value: string }> }>(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=asc&observation_start=${startDate}&observation_end=${endDate}`
      );
      const rows = (json?.observations ?? [])
        .filter((observation) => observation.value !== ".")
        .map((observation) => ({
          date: observation.date,
          commodity,
          price: Number.parseFloat(observation.value),
          currency,
          unit,
        }));

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          await ingestRows("commodity_prices", rows.slice(i, i + 500));
        }
        totalRows += rows.length;
        console.log(`${rows.length} months`);
      } else {
        console.log("no data");
      }
      await sleep(500);
    }
  } else {
    console.log("   Skipping FRED monthly TTF/LNG — FRED_API_KEY is not set");
  }

  console.log(`\n   Total: ${totalRows} price rows ingested`);
  console.log("   Note: live Dutch TTF (eu_ttf, EUR/MWh) comes from OilPriceAPI via /api/cron-prices, not this backfill.\n");
}

async function main() {
  console.log("Energy Dashboard — Historical Data Backfill\n");

  if (!only || only === "snapshots") {
    await backfillSnapshots();
  }

  if (!only || only === "generation") {
    await backfillGeneration();
  }

  if (!only || only === "prices") {
    await backfillPrices();
  }

  console.log("Backfill complete.\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
