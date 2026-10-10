import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("snapshot integrity scripts", () => {
  it("falls back to one snapshots_range pipe when SQL is forbidden", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/tinybird-sql.ts"), "utf8");
    expect(source).toContain("inflatedSnapshotSql()");
    expect(source).toContain("TinybirdSqlPermissionError");
    expect(source).toContain('pipeName: string');
    expect(source).toContain('"snapshots_range"');
    expect(source).toContain("queryInflatedSnapshots");
    expect(source).toContain("tinybirdSqlRequestInit");
    expect(source).toContain("application/x-www-form-urlencoded");
    expect(source).not.toContain("/v0/events");
    expect(source).not.toContain("text/plain");
  });

  it("diagnoses with one Tinybird SQL query and never writes", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/diagnose-snapshot-generation.ts"), "utf8");
    expect(source).toContain("queryInflatedSnapshots");
    expect(source).not.toContain("/v0/events");
    expect(source).not.toContain("ingestRows");
  });

  it("backfills only affected snapshot rows and stays dry-run without --execute", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/backfill-inflated-snapshots.ts"), "utf8");
    expect(source).toContain("queryInflatedSnapshots");
    expect(source).toContain("queryPresentSnapshotTimestamps");
    expect(source).toContain("loadSnapshotIntegrity");
    expect(source).toContain("seedIntegrityRepair");
    expect(source).toContain("settlementDatesForIntegrityRepair");
    expect(source).toContain("const execute = args.includes(\"--execute\")");
    expect(source).toContain("const dryRun = !execute");
    expect(source).toContain("affected.has(timestamp)");
    expect(source).toContain("collectSnapshotsForSettlementDate");
    expect(source).toContain("missingAffectedTimestamps");
    expect(source).toContain("partitionRepairedSnapshotRows");
    expect(source).toContain("integrityReportForRepairedRows");
    expect(source).toContain("recordSnapshotIntegrity");
    expect(source).toContain("writtenIntegrityTimestamps");
    expect(source).toContain("if (execute)");
    expect(source).toContain("Still failing integrity after re-collect");
    expect(source).toContain('await ingestRows("energy_snapshots", repaired)');
    expect(source).not.toContain('await ingestRows("energy_snapshots", rows)');
    expect(source).toContain("process.exit(1)");
    expect(source.indexOf("loadSnapshotIntegrity")).toBeLessThan(
      source.indexOf("queryPresentSnapshotTimestamps")
    );
    expect(source.indexOf("queryPresentSnapshotTimestamps")).toBeLessThan(
      source.indexOf("seedIntegrityRepair")
    );
    expect(source.indexOf("partitionRepairedSnapshotRows")).toBeLessThan(
      source.indexOf('await ingestRows("energy_snapshots"')
    );
    expect(source.indexOf('await ingestRows("energy_snapshots"')).toBeLessThan(
      source.lastIndexOf("recordSnapshotIntegrity")
    );
    expect(source.lastIndexOf("recordSnapshotIntegrity")).toBeLessThan(
      source.lastIndexOf("missingAffectedTimestamps")
    );
  });
});
