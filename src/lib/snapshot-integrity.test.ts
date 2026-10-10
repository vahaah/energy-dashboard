import { afterEach, describe, expect, it } from "vitest";
import { setRedisForTests } from "@/lib/redis-cache";
import {
  GENERATION_OVER_DEMAND_DIAGNOSTIC,
  GENERATION_OVER_DEMAND_LIMIT,
  inflatedFuelsForRow,
  inflatedSnapshotFromWideRow,
  inflatedSnapshotSql,
  inspectSnapshotRows,
  integrityReportForRepairedRows,
  integrityReportForWrittenRows,
  integrityTimestampKey,
  mergeStoredIntegrity,
  missingAffectedTimestamps,
  readSnapshotIntegrity,
  recordSnapshotIntegrity,
  shouldRecordSnapshotIntegrity,
  snapshotDomesticGenerationMw,
  snapshotIntegrityIssues,
  snapshotRowFailsIntegrity,
  type InflatedSnapshotRow,
} from "@/lib/snapshot-integrity";

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: "2025-11-18 12:30:00",
    demand_mw: 37_700,
    carbon_intensity: 120,
    gen_gas_pct: 30,
    gen_coal_pct: 0,
    gen_nuclear_pct: 10,
    gen_wind_pct: 30,
    gen_solar_pct: 20,
    gen_hydro_pct: 2,
    gen_biomass_pct: 5,
    gen_imports_pct: 3,
    gen_other_pct: 0,
    gen_gas_mw: 10_000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 4_000,
    gen_wind_mw: 12_000,
    gen_solar_mw: 8_000,
    gen_hydro_mw: 400,
    gen_biomass_mw: 2_000,
    gen_other_mw: 700,
    gen_pumped_mw: 200,
    gen_battery_mw: 0,
    ...overrides,
  };
}

describe("snapshot integrity", () => {
  afterEach(() => {
    setRedisForTests(null);
  });

  it("keeps a normal half-hour and flags a 2× total under per-fuel maxima", () => {
    const ok = snapshot();
    expect(snapshotDomesticGenerationMw(ok)).toBe(37_300);
    expect(snapshotRowFailsIntegrity(ok)).toBe(false);

    const doubled = snapshot({
      gen_gas_mw: 20_000,
      gen_nuclear_mw: 8_000,
      gen_wind_mw: 24_000,
      gen_solar_mw: 16_000,
      gen_hydro_mw: 800,
      gen_biomass_mw: 4_000,
      gen_other_mw: 1_400,
      gen_pumped_mw: 400,
    });
    expect(snapshotDomesticGenerationMw(doubled)).toBe(74_600);
    expect(snapshotRowFailsIntegrity(doubled)).toBe(true);
    expect(snapshotIntegrityIssues(doubled).some((issue) => issue.code === "generation_vs_demand")).toBe(
      true
    );
  });

  it("allows generation 1.2× demand for exports and rejects out-of-bounds fields", () => {
    expect(
      snapshotRowFailsIntegrity(
        snapshot({
          demand_mw: 37_700,
          gen_gas_mw: 17_900,
        })
      )
    ).toBe(false);
    expect(snapshotIntegrityIssues(snapshot({ carbon_intensity: 1_200 }))[0]?.code).toBe("out_of_bounds");
    expect(snapshotIntegrityIssues(snapshot({ gen_wind_mw: 32_000 }))[0]?.code).toBe("fuel_maxima");
    expect(snapshotIntegrityIssues(snapshot({ gen_gas_pct: 140 }))[0]?.code).toBe("out_of_bounds");
  });

  it("merges nightly results so a later pass can clear a previously failing period", () => {
    const first = inspectSnapshotRows([
      snapshot({ timestamp: "2025-11-18 12:30:00", gen_wind_mw: 24_000, gen_solar_mw: 16_000, gen_gas_mw: 20_000 }),
      snapshot({ timestamp: "2025-11-18 13:00:00" }),
    ]);
    expect(first.failing).toHaveLength(1);

    const stored = mergeStoredIntegrity(null, first);
    expect(stored.failingTimestamps).toEqual(["2025-11-18 12:30:00"]);

    const healed = inspectSnapshotRows([snapshot({ timestamp: "2025-11-18 12:30:00" })]);
    expect(mergeStoredIntegrity(stored, healed).failingTimestamps).toEqual([]);
  });

  it("records failing timestamps in Redis for /records to read", async () => {
    const store = new Map<string, string>();
    setRedisForTests({
      get: async <T>(key: string) => (store.get(key) ?? null) as T | null,
      set: async (key, value) => {
        store.set(key, typeof value === "string" ? value : JSON.stringify(value));
        return "OK";
      },
      del: async () => 1,
      incr: async () => 1,
    });

    const report = inspectSnapshotRows([
      snapshot({
        timestamp: "2025-11-18 12:30:00",
        gen_wind_mw: 24_000,
        gen_solar_mw: 16_000,
        gen_gas_mw: 20_000,
        gen_nuclear_mw: 8_000,
        gen_biomass_mw: 4_000,
      }),
    ]);
    const stored = await recordSnapshotIntegrity(report);
    expect(stored.failingTimestamps).toEqual(["2025-11-18 12:30:00"]);
    expect(integrityTimestampKey("2025-11-18T12:30:00.000Z")).toBe("2025-11-18 12:30:00");
  });

  it("treats Redis get/set failures as non-fatal so ingest can continue", async () => {
    setRedisForTests({
      get: async () => {
        throw new Error("timeout");
      },
      set: async () => {
        throw new Error("timeout");
      },
      del: async () => 1,
      incr: async () => 1,
    });

    const report = inspectSnapshotRows([
      snapshot({
        timestamp: "2025-11-18 12:30:00",
        gen_wind_mw: 24_000,
        gen_solar_mw: 16_000,
        gen_gas_mw: 20_000,
        gen_nuclear_mw: 8_000,
        gen_biomass_mw: 4_000,
      }),
    ]);
    await expect(readSnapshotIntegrity()).resolves.toBeNull();
    await expect(recordSnapshotIntegrity(report)).resolves.toMatchObject({
      failingTimestamps: ["2025-11-18 12:30:00"],
    });
  });

  it("does not overwrite Redis when the existing integrity key cannot be read", async () => {
    const sets: string[] = [];
    setRedisForTests({
      get: async () => {
        throw new Error("timeout");
      },
      set: async (_key, value) => {
        sets.push(typeof value === "string" ? value : JSON.stringify(value));
        return "OK";
      },
      del: async () => 1,
      incr: async () => 1,
    });

    const report = inspectSnapshotRows([
      snapshot({
        timestamp: "2025-11-18 12:30:00",
        gen_wind_mw: 24_000,
        gen_solar_mw: 16_000,
        gen_gas_mw: 20_000,
        gen_nuclear_mw: 8_000,
        gen_biomass_mw: 4_000,
      }),
    ]);
    await recordSnapshotIntegrity(report);
    expect(sets).toEqual([]);
  });

  it("records failures even when no snapshot rows were written", () => {
    const failing = snapshot({
      timestamp: "2025-11-18 12:30:00",
      gen_wind_mw: 24_000,
      gen_solar_mw: 16_000,
      gen_gas_mw: 20_000,
      gen_nuclear_mw: 8_000,
      gen_biomass_mw: 4_000,
    });
    const report = inspectSnapshotRows([failing]);
    expect(shouldRecordSnapshotIntegrity(report, [], false)).toBe(true);
    expect(shouldRecordSnapshotIntegrity(report, [], true)).toBe(false);
    expect(shouldRecordSnapshotIntegrity(inspectSnapshotRows([snapshot()]), [], false)).toBe(false);

    const persisted = integrityReportForWrittenRows(report, []);
    expect(persisted.checkedTimestamps).toEqual([]);
    expect(persisted.failing.map((finding) => finding.timestamp)).toEqual(["2025-11-18 12:30:00"]);
    expect(mergeStoredIntegrity(null, persisted).failingTimestamps).toEqual(["2025-11-18 12:30:00"]);
  });

  it("persists only written timestamps and keeps unwritten failures", () => {
    const failing = snapshot({
      timestamp: "2025-11-18 12:30:00",
      gen_wind_mw: 24_000,
      gen_solar_mw: 16_000,
      gen_gas_mw: 20_000,
      gen_nuclear_mw: 8_000,
      gen_biomass_mw: 4_000,
    });
    const ok = snapshot({ timestamp: "2025-11-18 13:00:00" });
    const report = inspectSnapshotRows([failing, ok]);
    const persisted = integrityReportForWrittenRows(report, [ok]);

    expect(persisted.checkedTimestamps).toEqual(["2025-11-18 13:00:00"]);
    expect(persisted.failing.map((finding) => finding.timestamp)).toEqual(["2025-11-18 12:30:00"]);

    const previous = mergeStoredIntegrity(null, inspectSnapshotRows([failing, ok]));
    expect(mergeStoredIntegrity(previous, persisted).failingTimestamps).toEqual([
      "2025-11-18 12:30:00",
    ]);
    expect(missingAffectedTimestamps(["2025-11-18 12:30:00", "2025-11-18 13:00:00"], [ok])).toEqual([
      "2025-11-18 12:30:00",
    ]);
  });

  it("clears repaired timestamps from the stored integrity report", () => {
    const stored = mergeStoredIntegrity(null, inspectSnapshotRows([
      snapshot({
        timestamp: "2025-11-18 12:30:00",
        gen_wind_mw: 24_000,
        gen_solar_mw: 16_000,
        gen_gas_mw: 20_000,
        gen_nuclear_mw: 8_000,
        gen_biomass_mw: 4_000,
      }),
      snapshot({
        timestamp: "2025-12-16 12:30:00",
        gen_wind_mw: 24_000,
        gen_solar_mw: 16_000,
        gen_gas_mw: 20_000,
        gen_nuclear_mw: 8_000,
        gen_biomass_mw: 4_000,
      }),
    ]));
    expect(stored.failingTimestamps).toEqual(["2025-11-18 12:30:00", "2025-12-16 12:30:00"]);

    const repaired = integrityReportForRepairedRows([
      snapshot({ timestamp: "2025-11-18 12:30:00" }),
    ]);
    expect(repaired.failing).toEqual([]);
    expect(mergeStoredIntegrity(stored, repaired).failingTimestamps).toEqual(["2025-12-16 12:30:00"]);
  });

  it("builds one Tinybird SQL statement that joins FUELINST and uses FINAL", () => {
    const sql = inflatedSnapshotSql();
    expect(sql).toContain("energy_snapshots FINAL");
    expect(sql).toContain("generation_5min FINAL");
    expect(sql).toContain(String(GENERATION_OVER_DEMAND_DIAGNOSTIC));
    expect(sql).toContain(String(GENERATION_OVER_DEMAND_LIMIT));
    expect(sql).toContain("source = 'fuelinst'");
    expect(sql).toContain("sumIf(generation_mw, fuel_type IN ('ccgt', 'ocgt'))");
    expect(sql).toContain("sumIf(generation_mw, fuel_type IN ('other', 'oil'))");
    expect(sql).toContain("avg(gas_mw) AS fuelinst_gas_mw");
    expect(sql.indexOf("fuelinst_5min")).toBeLessThan(sql.indexOf("avg(gas_mw)"));
    expect(sql.match(/FROM energy_snapshots FINAL/g)).toHaveLength(1);
    expect(inflatedFuelsForRow({ wind_inflated: 1, gas_inflated: 0 } as InflatedSnapshotRow)).toEqual([
      "wind",
    ]);
  });

  it("converts a wide snapshots_range row when SQL cannot join FUELINST", () => {
    const row = inflatedSnapshotFromWideRow(
      snapshot({
        gen_gas_mw: 35_446,
        gen_nuclear_mw: 7_418,
        gen_wind_mw: 16_640.7,
        gen_solar_mw: 7_070,
        gen_hydro_mw: 1_022,
        gen_biomass_mw: 6_636,
        gen_other_mw: 874,
        gen_pumped_mw: 0,
        demand_mw: 37_736,
      })
    );
    expect(row?.ratio).toBeCloseTo(75_106.7 / 37_736, 5);
    expect(row?.fuelinst_gas_mw).toBeNull();
    expect(inflatedSnapshotFromWideRow(snapshot())).toBeNull();
  });
});
