#!/usr/bin/env npx tsx
/**
 * Backfill historical data from all sources into Tinybird.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts --days 30
 *   npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18
 *   npx tsx scripts/backfill.ts --days 90 --dry-run
 *   npx tsx scripts/backfill.ts --days 7 --only prices
 *   npx tsx scripts/backfill.ts --days 7 --only snapshots
 *   npx tsx scripts/backfill.ts --days 30 --only generation
 *
 * Env vars required:
 *   TINYBIRD_URL, TINYBIRD_TOKEN (or set in .env.local)
 *   EIA_API_KEY (defaults to DEMO_KEY)
 *   OIL_PRICE_API_KEY (optional — for TTF + LNG)
 *   FRED_API_KEY (optional — for TTF + LNG monthly history)
 *
 * Data sources:
 *   1. Carbon Intensity API  — /intensity/{from}/{to} + /generation/{from}/{to}
 *      Max 14 days per request, half-hourly → aggregated to hourly
 *   2. Elexon BMRS — system prices, demand (ITSDO), generation (AGPT) per date
 *   3. Elexon FUELINST — 5-min generation by fuel type → generation_5min
 *   4. NESO — embedded solar/wind from distribution networks → generation_5min
 *   5. EIA — Brent, WTI, Henry Hub daily prices (up to 5000 rows = ~20 years)
 *   6. OilPriceAPI — EU TTF gas, LNG Asia JKM → commodity_prices
 *   7. FRED — monthly TTF + LNG (deep history) → commodity_prices
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(import.meta.dirname ?? ".", ".env.local") });

// ─── Config ──────────────────────────────────────────────────

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const EIA_KEY = process.env.EIA_API_KEY ?? "DEMO_KEY";
const OIL_API_KEY = process.env.OIL_PRICE_API_KEY ?? "";
const FRED_KEY = process.env.FRED_API_KEY ?? "";

if (!TOKEN) {
  console.error("❌ TINYBIRD_TOKEN is not set. Add it to .env.local or export it.");
  process.exit(1);
}

// ─── CLI args ────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const dryRun = hasFlag("dry-run");
const only = getArg("only"); // "snapshots" | "prices" | "generation" | undefined (all)
const daysArg = getArg("days");
const fromArg = getArg("from");
const toArg = getArg("to");

const endDate = toArg ? new Date(toArg + "T23:59:59Z") : new Date();
const startDate = fromArg
  ? new Date(fromArg + "T00:00:00Z")
  : new Date(endDate.getTime() - (Number(daysArg ?? 30)) * 24 * 60 * 60 * 1000);

console.log(`\n📅 Backfill range: ${fmt(startDate)} → ${fmt(endDate)}`);
console.log(`   Days: ${Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)}`);
if (only) console.log(`   Only: ${only}`);
if (dryRun) console.log(`   🧪 DRY RUN — no data will be ingested\n`);
else console.log("");

// ─── Helpers ─────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtISO(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`   ⚠ ${res.status} ${res.statusText} for ${url.slice(0, 100)}`);
      return null;
    }
    return await res.json() as T;
  } catch (e) {
    console.warn(`   ⚠ Fetch error: ${e}`);
    return null;
  }
}

async function ingestRows(datasource: string, rows: Record<string, unknown>[]) {
  if (dryRun) {
    console.log(`   🧪 Would ingest ${rows.length} rows into ${datasource}`);
    return;
  }
  const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");
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

// ─── Elexon fuel type mapping (same as cron route) ───────────

function mapElexonFuel(psrType: string): string {
  const map: Record<string, string> = {
    "Fossil Gas": "gas",
    "Fossil Hard coal": "coal",
    "Fossil Oil": "oil",
    Nuclear: "nuclear",
    Wind: "wind",
    "Wind Onshore": "wind",
    "Wind Offshore": "wind",
    Solar: "solar",
    "Hydro Pumped Storage": "hydro",
    "Hydro Run-of-river and poundage": "hydro",
    Biomass: "biomass",
    Other: "other",
  };
  return map[psrType] ?? "other";
}

// ═══════════════════════════════════════════════════════════════
// BACKFILL: Energy Snapshots (hourly)
// ═══════════════════════════════════════════════════════════════

async function backfillSnapshots() {
  console.log("⚡ Backfilling energy snapshots...\n");

  // Process in day-by-day chunks
  const current = new Date(startDate);
  let totalRows = 0;

  while (current < endDate) {
    const dayStr = fmt(current);
    const nextDay = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const nextDayStr = fmt(nextDay);

    process.stdout.write(`   ${dayStr} `);

    // ── Carbon Intensity + Generation Mix ─────────────────
    // Max 14 days per request, but we do day-by-day for simplicity
    const ciFrom = `${dayStr}T00:00Z`;
    const ciTo = `${nextDayStr}T00:00Z`;

    interface CIRow {
      from: string;
      to: string;
      intensity: { actual: number | null; forecast: number; index: string };
    }
    interface GenRow {
      from: string;
      to: string;
      generationmix: { fuel: string; perc: number }[];
    }

    const [intensityData, genData] = await Promise.all([
      fetchJSON<{ data: CIRow[] }>(
        `https://api.carbonintensity.org.uk/intensity/${ciFrom}/${ciTo}`
      ),
      fetchJSON<{ data: GenRow[] }>(
        `https://api.carbonintensity.org.uk/generation/${ciFrom}/${ciTo}`
      ),
    ]);

    // Index by hour
    const ciByHour = new Map<string, CIRow>();
    for (const row of intensityData?.data ?? []) {
      // Use the "from" time, take only :00 slots (start of hour)
      if (row.from.includes(":00Z") && !row.from.includes(":30")) {
        const hour = row.from.slice(0, 13) + ":00:00"; // "2026-03-01T05:00:00"
        ciByHour.set(hour, row);
      }
    }

    const genByHour = new Map<string, Record<string, number>>();
    for (const row of genData?.data ?? []) {
      if (row.from.includes(":00Z") && !row.from.includes(":30")) {
        const hour = row.from.slice(0, 13) + ":00:00";
        const mix: Record<string, number> = {};
        for (const item of row.generationmix) {
          mix[item.fuel] = item.perc;
        }
        genByHour.set(hour, mix);
      }
    }

    // ── Elexon — System Prices, Demand, Generation by Fuel ─
    interface PriceRow {
      settlementPeriod: number;
      systemBuyPrice: number;
    }
    interface DemandRow {
      settlementPeriod: number;
      demand: number;
    }
    interface GenMWRow {
      settlementPeriod: number;
      psrType: string;
      quantity: number;
    }

    const elexonFrom = `${dayStr}T00:00:00Z`;
    const elexonTo = `${nextDayStr}T00:00:00Z`;

    const [priceData, demandData, agptData] = await Promise.all([
      fetchJSON<{ data: PriceRow[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${dayStr}`
      ),
      fetchJSON<{ data: DemandRow[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/datasets/ITSDO?publishDateTimeFrom=${elexonFrom}&publishDateTimeTo=${elexonTo}`
      ),
      fetchJSON<{ data: GenMWRow[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/datasets/AGPT?publishDateTimeFrom=${elexonFrom}&publishDateTimeTo=${elexonTo}`
      ),
    ]);

    // Index Elexon data by settlement period → hour
    // Settlement periods: 1=00:00, 2=00:30, 3=01:00 ... so period (2*hour+1) = start of hour
    const priceByPeriod = new Map<number, number>();
    for (const row of priceData?.data ?? []) {
      priceByPeriod.set(row.settlementPeriod, row.systemBuyPrice);
    }

    const demandByPeriod = new Map<number, number>();
    for (const row of demandData?.data ?? []) {
      demandByPeriod.set(row.settlementPeriod, row.demand);
    }

    // AGPT: aggregate by period then fuel
    const genMwByPeriod = new Map<number, Record<string, number>>();
    for (const row of agptData?.data ?? []) {
      if (!genMwByPeriod.has(row.settlementPeriod)) {
        genMwByPeriod.set(row.settlementPeriod, {});
      }
      const fuel = mapElexonFuel(row.psrType);
      const m = genMwByPeriod.get(row.settlementPeriod)!;
      m[fuel] = (m[fuel] ?? 0) + row.quantity;
    }

    // ── Build hourly rows ─────────────────────────────────
    const rows: Record<string, unknown>[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(current);
      hourDate.setUTCHours(hour, 0, 0, 0);
      if (hourDate >= endDate) break;

      const hourKey =
        hourDate.toISOString().slice(0, 13) + ":00:00"; // "2026-03-01T05:00:00"
      const timestamp = hourDate
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);

      // Settlement period for this hour's start: hour*2 + 1
      const period = hour * 2 + 1;

      const ci = ciByHour.get(hourKey);
      const genPct = genByHour.get(hourKey) ?? {};
      const price = priceByPeriod.get(period) ?? 0;
      const demand = demandByPeriod.get(period) ?? 0;
      const genMw = genMwByPeriod.get(period) ?? {};

      rows.push({
        timestamp,
        carbon_intensity: ci?.intensity.actual ?? ci?.intensity.forecast ?? 0,
        carbon_forecast: ci?.intensity.forecast ?? 0,
        carbon_index: ci?.intensity.index ?? "unknown",
        demand_mw: demand,
        price_gbp_mwh: price,
        gen_gas_pct: genPct["gas"] ?? 0,
        gen_coal_pct: genPct["coal"] ?? 0,
        gen_nuclear_pct: genPct["nuclear"] ?? 0,
        gen_wind_pct: genPct["wind"] ?? 0,
        gen_solar_pct: genPct["solar"] ?? 0,
        gen_hydro_pct: genPct["hydro"] ?? 0,
        gen_biomass_pct: genPct["biomass"] ?? 0,
        gen_imports_pct: genPct["imports"] ?? 0,
        gen_other_pct: genPct["other"] ?? 0,
        gen_gas_mw: genMw["gas"] ?? 0,
        gen_coal_mw: genMw["coal"] ?? 0,
        gen_nuclear_mw: genMw["nuclear"] ?? 0,
        gen_wind_mw: genMw["wind"] ?? 0,
        gen_solar_mw: genMw["solar"] ?? 0,
        gen_hydro_mw: genMw["hydro"] ?? 0,
        gen_biomass_mw: genMw["biomass"] ?? 0,
        gen_other_mw: genMw["other"] ?? 0,
      });
    }

    // Ingest the day's rows
    if (rows.length > 0) {
      await ingestRows("energy_snapshots", rows);
      totalRows += rows.length;
      process.stdout.write(`✓ ${rows.length} hours\n`);
    } else {
      process.stdout.write(`— no data\n`);
    }

    // Rate-limit: small delay between days to avoid hammering APIs
    await sleep(300);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  console.log(`\n   Total: ${totalRows} snapshot rows ingested\n`);
}

// ═══════════════════════════════════════════════════════════════
// BACKFILL: 5-min Generation (FUELINST + NESO)
// ═══════════════════════════════════════════════════════════════

async function backfillGeneration() {
  console.log("⚡ Backfilling 5-min generation (FUELINST + NESO)...\n");

  const current = new Date(startDate);
  let totalRows = 0;

  while (current < endDate) {
    const dayStr = fmt(current);
    const nextDay = new Date(current.getTime() + 24 * 60 * 60 * 1000);

    process.stdout.write(`   ${dayStr} `);

    // ── FUELINST — 5-min generation by fuel ──────────────
    const fuelFrom = `${dayStr}T00:00:00Z`;
    const fuelTo = `${fmt(nextDay)}T00:00:00Z`;

    interface FuelInstRow {
      startTime: string;
      fuelType: string;
      generation: number;
    }

    const fuelData = await fetchJSON<FuelInstRow[]>(
      `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${fuelFrom}&publishDateTimeTo=${fuelTo}`
    );

    const rows: Record<string, unknown>[] = [];

    if (fuelData && fuelData.length > 0) {
      for (const row of fuelData) {
        rows.push({
          timestamp: row.startTime.replace("T", " ").replace("Z", "").slice(0, 19),
          fuel_type: row.fuelType.toLowerCase(),
          generation_mw: row.generation,
          source: "fuelinst",
        });
      }
    }

    // ── NESO — Embedded solar & wind ─────────────────────
    interface NesoRecord {
      SETTLEMENT_DATE: string;
      SETTLEMENT_PERIOD: string;
      EMBEDDED_SOLAR_GENERATION?: string;
      EMBEDDED_WIND_GENERATION?: string;
    }

    const nesoData = await fetchJSON<{ result: { records: NesoRecord[] } }>(
      `https://api.neso.energy/api/3/action/datastore_search_sql?sql=SELECT * FROM "177f6fa4-ae49-4182-81ea-0c6b35f26ca6" WHERE "SETTLEMENT_DATE"='${dayStr}' AND "FORECAST_ACTUAL_INDICATOR"='A' ORDER BY "SETTLEMENT_PERIOD" ASC`
    );

    const nesoRecords = nesoData?.result?.records ?? [];
    for (const rec of nesoRecords) {
      const sp = parseInt(rec.SETTLEMENT_PERIOD ?? "0");
      const hours = Math.floor((sp - 1) / 2);
      const mins = ((sp - 1) % 2) * 30;
      const ts = `${dayStr} ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;

      const solar = parseFloat(rec.EMBEDDED_SOLAR_GENERATION ?? "0");
      if (solar > 0) {
        rows.push({
          timestamp: ts,
          fuel_type: "embedded_solar",
          generation_mw: solar,
          source: "neso",
        });
      }

      const wind = parseFloat(rec.EMBEDDED_WIND_GENERATION ?? "0");
      if (wind > 0) {
        rows.push({
          timestamp: ts,
          fuel_type: "embedded_wind",
          generation_mw: wind,
          source: "neso",
        });
      }
    }

    // Ingest in batches of 500
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        await ingestRows("generation_5min", batch);
      }
      totalRows += rows.length;
      process.stdout.write(`✓ ${rows.length} rows\n`);
    } else {
      process.stdout.write(`— no data\n`);
    }

    await sleep(400);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  console.log(`\n   Total: ${totalRows} generation rows ingested\n`);
}

// ═══════════════════════════════════════════════════════════════
// BACKFILL: Commodity Prices (daily)
// ═══════════════════════════════════════════════════════════════

async function backfillPrices() {
  console.log("🛢️  Backfilling commodity prices...\n");

  // ── EIA prices ─────────────────────────────────────────────
  const eiaCommodities = [
    { series: "PET.RBRTE.D", commodity: "brent_crude", unit: "$/BBL" },
    { series: "PET.RWTC.D", commodity: "wti_crude", unit: "$/BBL" },
    { series: "NG.RNGWHHD.D", commodity: "henry_hub_gas", unit: "$/MMBTU" },
  ];

  let totalRows = 0;

  for (const { series, commodity, unit } of eiaCommodities) {
    process.stdout.write(`   ${commodity}: `);

    // EIA v2 seriesid with start/end date range — returns up to 5000 rows
    const url =
      `https://api.eia.gov/v2/seriesid/${series}` +
      `?api_key=${EIA_KEY}` +
      `&start=${fmt(startDate)}` +
      `&end=${fmt(endDate)}` +
      `&sort[0][column]=period&sort[0][direction]=asc` +
      `&length=5000`;

    interface EIARow {
      period: string;
      value: number | null;
    }

    const json = await fetchJSON<{ response: { data: EIARow[] } }>(url);
    const data = json?.response?.data ?? [];

    const rows = data
      .filter((r) => r.value != null)
      .map((r) => ({
        date: r.period,
        commodity,
        price: r.value,
        currency: "USD",
        unit,
      }));

    if (rows.length > 0) {
      // Ingest in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        await ingestRows("commodity_prices", batch);
      }
      totalRows += rows.length;
      console.log(`✓ ${rows.length} days`);
    } else {
      console.log(`— no data`);
    }

    await sleep(500); // EIA rate limit with DEMO_KEY
  }

  // ── FRED — monthly TTF + LNG history ──────────────────────
  // OilPriceAPI free tier only supports /latest, not /historical.
  // FRED provides reliable monthly data for EU gas (PNGASEUUSDM) and Asia LNG (PNGASJPUSDM).
  if (FRED_KEY) {
    const fredSeries = [
      { id: "PNGASEUUSDM", commodity: "eu_natural_gas", unit: "$/MMBTU" },
      { id: "PNGASJPUSDM", commodity: "lng_asia", unit: "$/MMBTU" },
    ];

    for (const { id, commodity, unit } of fredSeries) {
      process.stdout.write(`   ${commodity} (FRED): `);

      interface FredObs {
        date: string;
        value: string;
      }

      const json = await fetchJSON<{ observations: FredObs[] }>(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=asc&observation_start=${fmt(startDate)}&observation_end=${fmt(endDate)}`
      );

      const obs = (json?.observations ?? []).filter((o) => o.value !== ".");
      const rows = obs.map((o) => ({
        date: o.date,
        commodity,
        price: parseFloat(o.value),
        currency: "USD",
        unit,
      }));

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          await ingestRows("commodity_prices", rows.slice(i, i + 500));
        }
        totalRows += rows.length;
        console.log(`✓ ${rows.length} months`);
      } else {
        console.log(`— no data`);
      }

      await sleep(500);
    }
  }

  console.log(`\n   Total: ${totalRows} price rows ingested\n`);
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("🔋 Energy Dashboard — Historical Data Backfill\n");

  if (!only || only === "snapshots") {
    await backfillSnapshots();
  }

  if (!only || only === "generation") {
    await backfillGeneration();
  }

  if (!only || only === "prices") {
    await backfillPrices();
  }

  console.log("✅ Backfill complete!\n");
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
