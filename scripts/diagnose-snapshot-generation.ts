#!/usr/bin/env npx tsx
/**
 * Read-only scan of energy_snapshots half-hours that fail the like-for-like
 * balance check (generation vs ITSDO + embedded, with export headroom).
 * One Tinybird SQL query (free-plan quota). Does not write.
 *
 * Usage:
 *   npx tsx scripts/diagnose-snapshot-generation.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { inflatedFuelsForRow, type InflatedSnapshotRow } from "../src/lib/snapshot-integrity";
import { NESO_HISTORIC_RESOURCE_ID, NESO_HISTORIC_SQL_URL } from "../src/lib/historic-mix";
import { queryInflatedSnapshots } from "../src/lib/tinybird-sql";

config({ path: resolve(import.meta.dirname, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const FUEL_FLAGS = [
  "gas",
  "coal",
  "nuclear",
  "wind",
  "solar",
  "hydro",
  "biomass",
  "other",
  "pumped",
] as const;

function gw(mw: number | null | undefined): string {
  return mw == null ? "—" : `${(mw / 1000).toFixed(1)}`;
}

function nesoSqlForTimestamps(timestamps: string[]): string {
  const literals = timestamps
    .map((timestamp) => `'${timestamp.replace(" ", "T")}'`)
    .join(",");
  return [
    'SELECT "DATETIME","GAS","COAL","NUCLEAR","WIND","WIND_EMB","HYDRO","IMPORTS",',
    '"BIOMASS","OTHER","SOLAR","STORAGE","GENERATION"',
    `FROM "${NESO_HISTORIC_RESOURCE_ID}"`,
    `WHERE replace("DATETIME", 'T', ' ') IN (${timestamps.map((timestamp) => `'${timestamp}'`).join(",")})`,
    `OR "DATETIME" IN (${literals})`,
  ].join(" ");
}

type NesoCompareRow = {
  DATETIME: string;
  GAS: number | null;
  COAL: number | null;
  NUCLEAR: number | null;
  WIND: number | null;
  WIND_EMB: number | null;
  HYDRO: number | null;
  IMPORTS: number | null;
  BIOMASS: number | null;
  OTHER: number | null;
  SOLAR: number | null;
  STORAGE: number | null;
  GENERATION: number | null;
};

async function fetchNesoForPeriods(timestamps: string[]): Promise<Map<string, NesoCompareRow>> {
  if (timestamps.length === 0) {
    return new Map();
  }
  const response = await fetch(NESO_HISTORIC_SQL_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ sql: nesoSqlForTimestamps(timestamps) }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    process.stderr.write(`NESO historic HTTP ${response.status} — skipping NESO compare\n`);
    return new Map();
  }
  const json = (await response.json()) as {
    success?: boolean;
    result?: { records?: NesoCompareRow[] };
  };
  const byTime = new Map<string, NesoCompareRow>();
  for (const row of json.result?.records ?? []) {
    byTime.set(row.DATETIME.replace("T", " ").slice(0, 19), row);
  }
  return byTime;
}

function summarize(
  rows: InflatedSnapshotRow[],
  neso: Map<string, NesoCompareRow>,
  source: "sql" | "snapshots_range"
) {
  const fuelCounts: Record<string, number> = {};
  for (const fuel of FUEL_FLAGS) {
    fuelCounts[fuel] = 0;
  }
  for (const row of rows) {
    for (const fuel of inflatedFuelsForRow(row)) {
      fuelCounts[fuel] = (fuelCounts[fuel] ?? 0) + 1;
    }
  }

  const first = rows[0];
  const last = rows.at(-1);
  const worst = [...rows].sort((left, right) => right.ratio - left.ratio).slice(0, 15);

  process.stdout.write(`\nInflated energy_snapshots (generation > headline demand × limit)\n`);
  process.stdout.write(`  Periods: ${rows.length}\n`);
  if (source === "snapshots_range") {
    process.stdout.write(
      `  Source: one snapshots_range pipe (SQL 403 — FUELINST join skipped; compare fuels vs Elexon/NESO below)\n`
    );
  } else {
    process.stdout.write(`  Source: one Tinybird SQL query (energy_snapshots ⋈ FUELINST)\n`);
  }
  if (first && last) {
    process.stdout.write(`  Range: ${first.timestamp} → ${last.timestamp}\n`);
  }
  process.stdout.write(`  Fuel columns inflated vs FUELINST (1.25×):\n`);
  for (const fuel of FUEL_FLAGS) {
    process.stdout.write(`    ${fuel}: ${fuelCounts[fuel] ?? 0}\n`);
  }

  process.stdout.write(`\nWorst 15 by generation/demand:\n`);
  for (const row of worst) {
    const fuels = inflatedFuelsForRow(row);
    const nesoRow = neso.get(row.timestamp.replace(" ", "T").slice(0, 19)) ?? neso.get(row.timestamp);
    const nesoGen =
      nesoRow == null
        ? null
        : (nesoRow.GAS ?? 0) +
          (nesoRow.COAL ?? 0) +
          (nesoRow.NUCLEAR ?? 0) +
          (nesoRow.WIND ?? 0) +
          (nesoRow.WIND_EMB ?? 0) +
          (nesoRow.HYDRO ?? 0) +
          (nesoRow.BIOMASS ?? 0) +
          (nesoRow.OTHER ?? 0) +
          (nesoRow.SOLAR ?? 0) +
          (nesoRow.STORAGE ?? 0);
    process.stdout.write(
      `  ${row.timestamp}  gen ${gw(row.generation_mw)} GW  demand ${gw(row.demand_mw)} GW  ×${row.ratio.toFixed(2)}  inflated=[${fuels.join(",") || "demand-only"}]`
    );
    if (nesoGen != null) {
      process.stdout.write(`  neso-domestic ${gw(nesoGen)} GW`);
    }
    process.stdout.write("\n");
  }

  const example = rows.find((row) => row.timestamp.startsWith("2025-11-18 12:30"));
  if (example) {
    process.stdout.write(`\nExample 18 Nov 2025 12:30:\n`);
    process.stdout.write(
      `  snapshot gen ${gw(example.generation_mw)} GW vs demand ${gw(example.demand_mw)} GW (×${example.ratio.toFixed(2)})\n`
    );
    process.stdout.write(
      `  wind ${gw(example.gen_wind_mw)} / fuelinst ${gw(example.fuelinst_wind_mw)}  solar ${gw(example.gen_solar_mw)} / fuelinst ${gw(example.fuelinst_solar_mw)}  gas ${gw(example.gen_gas_mw)} / fuelinst ${gw(example.fuelinst_gas_mw)}\n`
    );
    process.stdout.write(
      `  hydro ${gw(example.gen_hydro_mw)} / fuelinst ${gw(example.fuelinst_hydro_mw)}  pumped ${gw(example.gen_pumped_mw)} / fuelinst ${gw(example.fuelinst_pumped_mw)}\n`
    );
  }

  return { fuelCounts, worst };
}

async function main() {
  const { rows, source } = await queryInflatedSnapshots();
  const neso = await fetchNesoForPeriods(rows.map((row) => row.timestamp));
  const summary = summarize(rows, neso, source);

  process.stdout.write("\nJSON summary\n");
  process.stdout.write(
    `${JSON.stringify(
      {
        count: rows.length,
        source,
        from: rows[0]?.timestamp ?? null,
        to: rows.at(-1)?.timestamp ?? null,
        fuelCounts: summary.fuelCounts,
        timestamps: rows.map((row) => row.timestamp),
        worst: summary.worst.map((row) => ({
          timestamp: row.timestamp,
          demandMw: row.demand_mw,
          generationMw: row.generation_mw,
          ratio: row.ratio,
          inflated: inflatedFuelsForRow(row),
        })),
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
