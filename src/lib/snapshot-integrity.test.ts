import { afterEach, describe, expect, it } from "vitest";
import { setRedisForTests } from "@/lib/redis-cache";
import { listSettlementPeriods, settlementTimestamp } from "@/lib/settlement-period";
import {
  GENERATION_OVER_DEMAND_LIMIT,
  INTEGRITY_REPAIR_DATE_BATCH_DAYS,
  LOW_IMPORT_SHARE_PCT,
  SNAPSHOT_BALANCE_TOLERANCE,
  SNAPSHOT_EXPORT_HEADROOM,
  batchSettlementDateRanges,
  inflatedFuelsForRow,
  inflatedSnapshotFromWideRow,
  inflatedSnapshotSql,
  inspectSnapshotRows,
  integrityReportForRepairedRows,
  integrityReportForWrittenRows,
  integritySourceStatus,
  integrityTimestampKey,
  mergeStoredIntegrity,
  missingAffectedTimestamps,
  partitionRepairedSnapshotRows,
  readSnapshotIntegrity,
  recordSnapshotIntegrity,
  seedIntegrityRepair,
  shouldRecordSnapshotIntegrity,
  snapshotDomesticGenerationMw,
  snapshotHeadlineDemandMw,
  snapshotIntegrityIssues,
  snapshotRowFailsIntegrity,
  snapshotRowHasIntegrityIssues,
  snapshotTimestampsInRangeSql,
  type InflatedSnapshotRow,
  type StoredSnapshotIntegrity,
} from "@/lib/snapshot-integrity";

/** Confirmed AGPT double-publish: 75.1 GW vs 37.7 GW ITSDO, solar 7.07 GW. */
function nov18Doubled(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return snapshot({
    timestamp: "2025-11-18 12:30:00",
    demand_mw: 37_736,
    gen_imports_pct: 3,
    gen_gas_mw: 35_446,
    gen_coal_mw: 0,
    gen_nuclear_mw: 7_418,
    gen_wind_mw: 16_640.7,
    gen_solar_mw: 7_070,
    gen_hydro_mw: 1_022,
    gen_biomass_mw: 6_636,
    gen_other_mw: 874,
    gen_pumped_mw: 0,
    gen_battery_mw: 0,
    ...overrides,
  });
}

/** Sunny export midday: excess vs ITSDO ≈ embedded-inclusive solar. */
function sunnyMidday(
  timestamp: string,
  demandMw: number,
  solarMw: number,
  generationMw: number
): Record<string, unknown> {
  const transmission = generationMw - solarMw;
  const nuclear = Math.round(transmission * 0.22);
  const wind = Math.round(transmission * 0.38);
  const hydro = Math.round(transmission * 0.02);
  const biomass = Math.round(transmission * 0.05);
  return snapshot({
    timestamp,
    demand_mw: demandMw,
    gen_imports_pct: 2,
    gen_gas_mw: transmission - nuclear - wind - hydro - biomass,
    gen_coal_mw: 0,
    gen_nuclear_mw: nuclear,
    gen_wind_mw: wind,
    gen_solar_mw: solarMw,
    gen_hydro_mw: hydro,
    gen_biomass_mw: biomass,
    gen_other_mw: 0,
    gen_pumped_mw: null,
    gen_battery_mw: null,
  });
}

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

/** 2× generation that stays under per-fuel maxima — soft balance only. */
function doubledUnderMaxima(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return snapshot({
    demand_mw: 37_736,
    gen_imports_pct: 3,
    gen_gas_mw: 20_000,
    gen_nuclear_mw: 8_000,
    gen_wind_mw: 24_000,
    gen_solar_mw: 7_070,
    gen_hydro_mw: 800,
    gen_biomass_mw: 4_000,
    gen_other_mw: 1_400,
    gen_pumped_mw: 400,
    ...overrides,
  });
}

describe("snapshot integrity", () => {
  afterEach(() => {
    setRedisForTests(null);
  });

  it("flags the 18 Nov 2025 12:30 doubled AGPT row (75.1 GW vs 37.7 GW ITSDO)", () => {
    const doubled = nov18Doubled();
    expect(snapshotDomesticGenerationMw(doubled)).toBeCloseTo(75_106.7, 5);
    expect(snapshotHeadlineDemandMw(doubled)).toBe(44_806);
    const issues = snapshotIntegrityIssues(doubled);
    expect(issues.some((issue) => issue.code === "balance")).toBe(true);
    expect(inspectSnapshotRows([doubled]).failing).toHaveLength(1);
  });

  it("keeps a 2× total that stays under per-fuel maxima and only fails the soft balance check", () => {
    const row = doubledUnderMaxima();
    expect(snapshotRowFailsIntegrity(row)).toBe(false);
    expect(snapshotRowHasIntegrityIssues(row)).toBe(true);
    expect(snapshotIntegrityIssues(row).some((issue) => issue.code === "balance")).toBe(true);
    expect(integritySourceStatus(inspectSnapshotRows([row])).ok).toBe(true);
  });

  it("passes sunny export middays once solar is treated as embedded on ITSDO", () => {
    const apr5 = sunnyMidday("2025-04-05 13:00:00", 18_200, 11_800, 29_700);
    const may10 = sunnyMidday("2025-05-10 13:00:00", 19_400, 10_200, 30_100);
    const jun1 = sunnyMidday("2025-06-01 13:00:00", 20_100, 12_000, 32_400);

    expect(snapshotDomesticGenerationMw(apr5)).toBe(29_700);
    expect(snapshotHeadlineDemandMw(apr5)).toBe(30_000);
    for (const row of [apr5, may10, jun1]) {
      expect(snapshotIntegrityIssues(row)).toEqual([]);
      expect(snapshotRowFailsIntegrity(row)).toBe(false);
    }
  });

  it("rejects out-of-bounds fields and per-fuel maxima as hard failures", () => {
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
    expect(snapshotRowFailsIntegrity(snapshot({ gen_wind_mw: 32_000 }))).toBe(true);
  });

  it("merges nightly results so a later pass can clear a previously failing period", () => {
    const first = inspectSnapshotRows([
      nov18Doubled(),
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

    const report = inspectSnapshotRows([nov18Doubled()]);
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

    const report = inspectSnapshotRows([nov18Doubled()]);
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

    const report = inspectSnapshotRows([nov18Doubled()]);
    await recordSnapshotIntegrity(report);
    expect(sets).toEqual([]);
  });

  it("records failures even when no snapshot rows were written", () => {
    const failing = nov18Doubled();
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
    const failing = nov18Doubled();
    const ok = snapshot({ timestamp: "2025-11-18 13:00:00" });
    const report = inspectSnapshotRows([failing, ok]);
    const persisted = integrityReportForWrittenRows(report, [ok, failing]);

    expect(persisted.checkedTimestamps).toEqual(["2025-11-18 12:30:00", "2025-11-18 13:00:00"]);
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
      nov18Doubled(),
      nov18Doubled({ timestamp: "2025-12-16 12:30:00" }),
    ]));
    expect(stored.failingTimestamps).toEqual(["2025-11-18 12:30:00", "2025-12-16 12:30:00"]);

    const repaired = integrityReportForRepairedRows([
      snapshot({ timestamp: "2025-11-18 12:30:00" }),
    ]);
    expect(repaired.failing).toEqual([]);
    expect(mergeStoredIntegrity(stored, repaired).failingTimestamps).toEqual(["2025-12-16 12:30:00"]);
  });

  it("does not mark a re-collected row repaired when it still fails the balance check", () => {
    const stillInflated = doubledUnderMaxima();
    expect(snapshotRowFailsIntegrity(stillInflated)).toBe(false);
    expect(snapshotRowHasIntegrityIssues(stillInflated)).toBe(true);

    const { repaired, stillFailing } = partitionRepairedSnapshotRows([stillInflated]);
    expect(repaired).toEqual([]);
    expect(stillFailing).toEqual([stillInflated]);

    const stored = mergeStoredIntegrity(null, inspectSnapshotRows([stillInflated]));
    expect(stored.failingTimestamps).toEqual(["2025-11-18 12:30:00"]);

    const onlyRepaired = integrityReportForRepairedRows(repaired);
    expect(onlyRepaired.checkedTimestamps).toEqual([]);
    expect(onlyRepaired.failing).toEqual([]);
    expect(mergeStoredIntegrity(stored, onlyRepaired).failingTimestamps).toEqual([
      "2025-11-18 12:30:00",
    ]);

    const accidentalRewrite = integrityReportForRepairedRows(stillFailing);
    expect(accidentalRewrite.failing.map((finding) => finding.timestamp)).toEqual([
      "2025-11-18 12:30:00",
    ]);
    expect(mergeStoredIntegrity(stored, accidentalRewrite).failingTimestamps).toEqual([
      "2025-11-18 12:30:00",
    ]);
  });

  it("builds one Tinybird SQL statement that joins FUELINST and uses FINAL", () => {
    const sql = inflatedSnapshotSql();
    expect(sql).toContain("energy_snapshots FINAL");
    expect(sql).toContain("generation_5min FINAL");
    expect(sql).toContain("headline_demand_mw");
    expect(sql).toContain(String(SNAPSHOT_BALANCE_TOLERANCE));
    expect(sql).toContain(String(SNAPSHOT_EXPORT_HEADROOM));
    expect(sql).toContain(String(LOW_IMPORT_SHARE_PCT));
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

  it("revisits a half-hour dropped by the old gate with no energy_snapshots row", () => {
    const timestamp = "2025-04-05 12:00:00";
    const stored: StoredSnapshotIntegrity = {
      checkedAt: "2025-04-06 10:00:00",
      settlementDates: ["2025-04-05"],
      failingTimestamps: [],
    };
    const present = listSettlementPeriods("2025-04-05")
      .map((period) => settlementTimestamp(period))
      .filter((value) => value !== timestamp);

    const inflatedOnly = seedIntegrityRepair({
      inflatedTimestamps: [],
      stored: null,
      presentTimestamps: present,
    });
    expect(inflatedOnly.affected).toEqual([]);

    const seed = seedIntegrityRepair({
      inflatedTimestamps: [],
      stored,
      presentTimestamps: present,
    });
    expect(seed.missing).toContain(timestamp);
    expect(seed.affected).toContain(timestamp);
    expect(seed.collectDates).toEqual(["2025-04-05"]);

    const collected = sunnyMidday(timestamp, 18_200, 11_800, 29_700);
    expect(inflatedSnapshotFromWideRow(collected)).toBeNull();
    const { repaired, stillFailing } = partitionRepairedSnapshotRows([collected]);
    expect(stillFailing).toEqual([]);
    expect(repaired).toEqual([collected]);

    const storedWithFailure: StoredSnapshotIntegrity = {
      ...stored,
      failingTimestamps: [timestamp],
    };
    expect(
      mergeStoredIntegrity(storedWithFailure, integrityReportForRepairedRows(repaired))
        .failingTimestamps
    ).toEqual([]);
  });

  it("revisits a stale failingTimestamps entry that now passes the headline-demand check", () => {
    const timestamp = "2025-04-05 13:00:00";
    const existing = sunnyMidday(timestamp, 18_200, 11_800, 29_700);
    expect(inflatedSnapshotFromWideRow(existing)).toBeNull();

    const stored: StoredSnapshotIntegrity = {
      checkedAt: "2025-04-06 10:00:00",
      settlementDates: ["2025-04-05"],
      failingTimestamps: [timestamp],
    };
    const present = listSettlementPeriods("2025-04-05").map((period) =>
      settlementTimestamp(period)
    );

    const inflatedOnly = seedIntegrityRepair({
      inflatedTimestamps: [],
      stored: null,
      presentTimestamps: present,
    });
    expect(inflatedOnly.affected).toEqual([]);

    const seed = seedIntegrityRepair({
      inflatedTimestamps: [],
      stored,
      presentTimestamps: present,
    });
    expect(seed.missing).not.toContain(timestamp);
    expect(seed.storedFailing).toEqual([timestamp]);
    expect(seed.affected).toContain(timestamp);

    const { repaired, stillFailing } = partitionRepairedSnapshotRows([existing]);
    expect(stillFailing).toEqual([]);
    expect(
      mergeStoredIntegrity(stored, integrityReportForRepairedRows(repaired)).failingTimestamps
    ).toEqual([]);
  });

  it("batches presence queries by settlement-date range instead of per timestamp", () => {
    const ranges = batchSettlementDateRanges(
      ["2025-04-05", "2025-04-06", "2025-05-10", "2025-05-11", "2025-05-12"],
      14
    );
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({ startDate: "2025-04-05", endDate: "2025-04-06" });
    expect(ranges[1]).toMatchObject({ startDate: "2025-05-10", endDate: "2025-05-12" });
    expect(INTEGRITY_REPAIR_DATE_BATCH_DAYS).toBe(14);

    const long = batchSettlementDateRanges(
      ["2025-04-01", "2025-04-02", "2025-04-03", "2025-04-15", "2025-04-16"],
      14
    );
    expect(long).toHaveLength(2);
    expect(long[0]?.endDate).toBe("2025-04-03");
    expect(long[1]?.startDate).toBe("2025-04-15");

    const sql = snapshotTimestampsInRangeSql("2025-04-04 23:00:00", "2025-04-06 23:00:00");
    expect(sql).toContain("energy_snapshots FINAL");
    expect(sql).toContain("SELECT timestamp");
    expect(sql).toContain("timestamp >= '2025-04-04 23:00:00'");
    expect(sql).toContain("timestamp < '2025-04-06 23:00:00'");
    expect(sql).not.toContain("IN (");
    expect(() => snapshotTimestampsInRangeSql("2025-04-05", "2025-04-06")).toThrow(
      "invalid Tinybird datetime"
    );
  });

  it("converts a wide snapshots_range row when SQL cannot join FUELINST", () => {
    const row = inflatedSnapshotFromWideRow(nov18Doubled());
    expect(row?.ratio).toBeCloseTo(75_106.7 / 44_806, 5);
    expect(row?.headline_demand_mw).toBe(44_806);
    expect(row?.fuelinst_gas_mw).toBeNull();
    expect(inflatedSnapshotFromWideRow(snapshot())).toBeNull();
    expect(
      inflatedSnapshotFromWideRow(sunnyMidday("2025-04-05 13:00:00", 18_200, 11_800, 29_700))
    ).toBeNull();
  });
});
