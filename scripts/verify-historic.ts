#!/usr/bin/env npx tsx
/**
 * Compare our NESO historic aggregates with an independent reduction.
 *
 * Usage:
 *   npx tsx scripts/verify-historic.ts
 *
 * Fetches the cached weekly SQL (or a live NESO query) and checks yearly
 * carbon / coal / wind averages stay within 0.5% of a second pass.
 */
import {
  historicWeeklySql,
  NESO_HISTORIC_SQL_URL,
  parseNesoHistoricRow,
  periodAverages,
  saneHistoricRows,
  yearlyAverages,
  type NesoHistoricRow,
} from "../src/lib/historic-mix";

const TOLERANCE = 0.005;

async function fetchWeekly(): Promise<NesoHistoricRow[]> {
  const response = await fetch(NESO_HISTORIC_SQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sql: historicWeeklySql() }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`NESO HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    success?: boolean;
    result?: { records?: Record<string, unknown>[] };
  };
  if (json.success === false) {
    throw new Error("NESO query failed");
  }
  return (json.result?.records ?? [])
    .map((raw) => parseNesoHistoricRow(raw))
    .filter((row): row is NesoHistoricRow => row != null);
}

function independentYearly(rows: NesoHistoricRow[]): Map<number, { carbon: number; coal: number; wind: number }> {
  const buckets = new Map<number, { carbon: number; coal: number; wind: number; n: number }>();
  for (const row of saneHistoricRows(rows)) {
    const year = new Date(`${row.DATETIME.endsWith("Z") ? row.DATETIME : `${row.DATETIME}Z`}`).getUTCFullYear();
    const current = buckets.get(year) ?? { carbon: 0, coal: 0, wind: 0, n: 0 };
    current.carbon += row.CARBON_INTENSITY ?? 0;
    current.coal += row.COAL_perc ?? 0;
    current.wind += (row.WIND_perc ?? 0) + (row.WIND_EMB_perc ?? 0);
    current.n += 1;
    buckets.set(year, current);
  }

  const averages = new Map<number, { carbon: number; coal: number; wind: number }>();
  for (const [year, bucket] of buckets) {
    averages.set(year, {
      carbon: bucket.carbon / bucket.n,
      coal: bucket.coal / bucket.n,
      wind: bucket.wind / bucket.n,
    });
  }
  return averages;
}

function drift(actual: number, expected: number): number {
  if (expected === 0) {
    return Math.abs(actual);
  }
  return Math.abs(actual - expected) / Math.abs(expected);
}

const rows = await fetchWeekly();
if (rows.length === 0) {
  throw new Error("NESO returned no historic weekly rows");
}

const ours = yearlyAverages(rows);
const theirs = independentYearly(rows);
let worst = 0;

for (const year of ours) {
  const check = theirs.get(year.year);
  if (!check) {
    throw new Error(`Missing independent year ${year.year}`);
  }
  worst = Math.max(
    worst,
    drift(year.carbon, check.carbon),
    drift(year.coalPct, check.coal),
    drift(year.windPct, check.wind)
  );
}

const allAverages = periodAverages(rows);
const independentCarbon =
  saneHistoricRows(rows).reduce((sum, row) => sum + (row.CARBON_INTENSITY ?? 0), 0) /
  saneHistoricRows(rows).length;

worst = Math.max(worst, drift(allAverages.carbon ?? 0, independentCarbon));

if (worst > TOLERANCE) {
  throw new Error(`Historic averages drifted ${(worst * 100).toFixed(2)}% (limit 0.5%)`);
}

process.stdout.write(
  `ok ${ours.length} years, ${rows.length} weekly points, max drift ${(worst * 100).toFixed(3)}%\n`
);
