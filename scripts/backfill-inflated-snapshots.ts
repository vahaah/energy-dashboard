#!/usr/bin/env npx tsx
/**
 * Rewrite energy_snapshots half-hours that fail the like-for-like balance
 * check (generation vs ITSDO + embedded, with export headroom), and revisit
 * timestamps the old 1.25x ITSDO gate recorded or dropped.
 * Dry-run by default. The parent runs --execute.
 *
 * Usage:
 *   npx tsx scripts/backfill-inflated-snapshots.ts
 *   npx tsx scripts/backfill-inflated-snapshots.ts --execute
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { collectSnapshotsForSettlementDate } from "../src/lib/ingest/collect-grid";
import { describeCollection } from "../src/lib/ingest/backfill-report";
import {
  inflatedFuelsForRow,
  integrityReportForRepairedRows,
  integrityTimestampKey,
  loadSnapshotIntegrity,
  missingAffectedTimestamps,
  partitionRepairedSnapshotRows,
  recordSnapshotIntegrity,
  seedIntegrityRepair,
  settlementDatesForIntegrityRepair,
  writtenIntegrityTimestamps,
} from "../src/lib/snapshot-integrity";
import { queryInflatedSnapshots, queryPresentSnapshotTimestamps } from "../src/lib/tinybird-sql";

config({ path: resolve(import.meta.dirname, "..", ".env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const API_URL = process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const TOKEN = process.env.TINYBIRD_TOKEN ?? "";
const args = process.argv.slice(2);
const execute = args.includes("--execute");
const dryRun = !execute;

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function ingestRows(datasource: string, rows: Record<string, unknown>[]) {
  if (dryRun) {
    console.log(`   Would ingest ${rows.length} rows into ${datasource}`);
    return;
  }
  if (!TOKEN) {
    throw new Error("TINYBIRD_TOKEN is not set. Add it to .env.local at the repo root.");
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
    throw new Error(`Tinybird ingest error (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  if (execute && !TOKEN) {
    console.error("TINYBIRD_TOKEN is not set. Add it to .env.local at the repo root.");
    process.exit(1);
  }

  const loaded = await loadSnapshotIntegrity();
  if (loaded.status === "error") {
    console.error("Could not read stored snapshot integrity from Redis.");
    process.exit(1);
  }
  const stored = loaded.value;

  const { rows: inflated, source } = await queryInflatedSnapshots();
  const present = await queryPresentSnapshotTimestamps(
    settlementDatesForIntegrityRepair(
      stored,
      inflated.map((row) => row.timestamp)
    ),
    { sleep }
  );
  const seed = seedIntegrityRepair({
    inflatedTimestamps: inflated.map((row) => row.timestamp),
    stored,
    presentTimestamps: present.timestamps,
  });
  const affected = new Set(seed.affected);
  const dates = seed.collectDates;

  console.log(`\nInflated snapshot backfill`);
  console.log(`   Query: ${source}`);
  console.log(`   Presence: ${present.source} (${present.queries} range quer${present.queries === 1 ? "y" : "ies"})`);
  console.log(`   Stored failing timestamps: ${seed.storedFailing.length}`);
  console.log(`   Missing half-hours on checked dates: ${seed.missing.length}`);
  console.log(`   Affected half-hours: ${affected.size}`);
  console.log(`   Settlement dates: ${dates[0] ?? "—"} → ${dates.at(-1) ?? "—"} (${dates.length} days)`);
  console.log(dryRun ? "   DRY RUN — no data will be ingested\n" : "   EXECUTE — writing corrected rows\n");

  for (const row of inflated.slice(0, 8)) {
    console.log(
      `   ${row.timestamp}  ×${row.ratio.toFixed(2)}  inflated=[${inflatedFuelsForRow(row).join(",") || "demand-only"}]`
    );
  }

  let wouldWrite = 0;
  const written: Record<string, unknown>[] = [];
  const stillFailingWritten: Record<string, unknown>[] = [];
  for (const settlementDate of dates) {
    process.stdout.write(`   ${settlementDate} `);
    const result = await collectSnapshotsForSettlementDate(settlementDate);
    const rows = result.rows.filter((row) => {
      const timestamp = typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "";
      return affected.has(timestamp);
    });
    const { repaired, stillFailing } = partitionRepairedSnapshotRows(rows);
    stillFailingWritten.push(...stillFailing);
    if (repaired.length > 0) {
      await ingestRows("energy_snapshots", repaired);
      wouldWrite += repaired.length;
      written.push(...repaired);
      if (execute) {
        await recordSnapshotIntegrity(integrityReportForRepairedRows(repaired));
      }
    }
    process.stdout.write(
      `${repaired.length} repaired, ${stillFailing.length} still failing / ${describeCollection(result)}\n`
    );
    await sleep(300);
  }

  const missing = missingAffectedTimestamps(affected, written);
  const stillFailingTimestamps = writtenIntegrityTimestamps(stillFailingWritten);
  console.log(`\n   ${dryRun ? "Would write" : "Wrote"} ${wouldWrite} of ${affected.size} affected rows\n`);
  if (stillFailingTimestamps.length > 0) {
    console.error(`   Still failing integrity after re-collect: ${stillFailingTimestamps.length}`);
    for (const timestamp of stillFailingTimestamps.slice(0, 12)) {
      console.error(`   ${timestamp}`);
    }
  }
  if (missing.length > 0) {
    console.error(`   Uncorrected affected timestamps: ${missing.length}`);
    for (const timestamp of missing.slice(0, 12)) {
      console.error(`   ${timestamp}`);
    }
    if (execute) {
      process.exit(1);
    }
  }
  if (dryRun) {
    console.log("Re-run with --execute after review. Do not run from CI or agents.\n");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
