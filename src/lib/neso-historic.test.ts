import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { historicWeeklySql } from "@/lib/historic-mix";
import { nesoSqlRequestInit } from "@/lib/neso-historic";

describe("NESO historic request", () => {
  it("POSTs SQL in the body so long queries are not 403'd on GET", () => {
    const sql = historicWeeklySql();
    const init = nesoSqlRequestInit(sql);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ sql }));
    expect(init.headers).toMatchObject({
      accept: "application/json",
      "content-type": "application/json",
    });
  });

  it("loads weekly rows before records so the two NESO calls stay serial", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./neso-historic.ts"), "utf8");
    expect(source).toContain("await getHistoricWeeklyRows()");
    expect(source).toContain("() => cachedRecordRows()");
    expect(source.indexOf("await getHistoricWeeklyRows()")).toBeLessThan(
      source.indexOf("() => cachedRecordRows()")
    );
    expect(source).toContain("emptyRecordsWithDocumentedCoal");
    expect(source).toContain("readSnapshotIntegrity");
    expect(source).toContain("stored?.failingTimestamps");
    expect(source).not.toContain("residualCoalAfterPowerEnded");
    expect(source).not.toContain("console.info");
  });
});
