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
    expect(source).toContain("const execute = args.includes(\"--execute\")");
    expect(source).toContain("const dryRun = !execute");
    expect(source).toContain("affected.has(timestamp)");
    expect(source).toContain("collectSnapshotsForSettlementDate");
    expect(source).toContain("missingAffectedTimestamps");
    expect(source).toContain("integrityReportForRepairedRows");
    expect(source).toContain("recordSnapshotIntegrity");
    expect(source).toContain("if (execute)");
    expect(source).toContain("process.exit(1)");
    expect(source.indexOf('await ingestRows("energy_snapshots"')).toBeLessThan(
      source.lastIndexOf("recordSnapshotIntegrity")
    );
    expect(source.lastIndexOf("recordSnapshotIntegrity")).toBeLessThan(
      source.lastIndexOf("missingAffectedTimestamps")
    );
  });
});
