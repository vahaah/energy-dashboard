import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertMeasuredKind, assertSingleAxis, measuredCostChart, measuredVolumeChart } from "@/lib/constraints/chart-series";
import { CONSTRAINTS_TINYBIRD_OPS } from "@/lib/constraints/budget";
import { buildConstraintsPage } from "@/lib/constraints/page-model";
import { fixtureConstraintsHistory } from "@/lib/constraints/reader";
import { measuredBreakdownLagNote } from "@/lib/constraints/copy";
import { nesoFinancialYear, parseBreakdownCsv, parseDayAheadCsv } from "@/lib/constraints/parse";
import { ckanInstant, selectNesoResource } from "@/lib/constraints/neso";

const BANNED = /\b(live|real-time|right now|flow now|wind curtailment|UK)\b/i;

describe("constraint parsers", () => {
  it("keeps a negative thermal volume and rejects an unknown column", () => {
    const parsed = parseBreakdownCsv(readFileSync(join(process.cwd(), "tests/fixtures/constraints/breakdown.csv"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const thermal = parsed.rows.find((row) => row.settlement_date === "2026-10-08" && row.category === "thermal");
    expect(thermal?.volume_mwh).toBe(-41);
    const extra = `${readFileSync(join(process.cwd(), "tests/fixtures/constraints/breakdown.csv"), "utf8").trim()}\n`.replace(
      "Thermal constraints volume",
      "Thermal constraints volume,Surprise",
    );
    expect(parseBreakdownCsv(`${extra.split("\n")[0]},Surprise\n`).ok).toBe(false);
    expect(parseBreakdownCsv("Date,Reducing largest loss cost\n2026-10-01,1\n")).toMatchObject({
      ok: false,
      reason: "header",
    });
  });

  it("quarantines an unknown boundary and keeps the sign of flow", () => {
    const unknown = parseDayAheadCsv(
      "Constraint Group,Date_ Time GMT_BST,Limit_MW,Flow_MW\nNEWGROUP,2026-10-15T00:00:00,1,2\n",
    );
    expect(unknown).toMatchObject({ ok: false, reason: "unknown_boundary" });
    const parsed = parseDayAheadCsv(readFileSync(join(process.cwd(), "tests/fixtures/constraints/day-ahead.csv"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.rows.find((row) => row.boundary === "FLOWSTH" && row.settlement_date === "2026-10-15")?.flow_mw).toBe(-50);
  });

  it("skips a blank limit or flow and accepts a wall time without seconds", () => {
    const csv = [
      "Constraint Group,Date_ Time GMT_BST,Limit_MW,Flow_MW",
      "FLOWSTH,2023-01-03T00:00:00,,",
      "FLOWSTH,2026-10-23T00:00,1200,-40",
      "FLOWSTH,2026-10-23T00:30:00,abc,1",
    ].join("\n");
    expect(parseDayAheadCsv(csv)).toMatchObject({ ok: false, reason: "row" });
    const kept = parseDayAheadCsv(
      [
        "Constraint Group,Date_ Time GMT_BST,Limit_MW,Flow_MW",
        "FLOWSTH,2023-01-03T00:00:00,,",
        "ESTEX,2026-10-23T00:00,1200,-40",
      ].join("\n"),
    );
    expect(kept.ok).toBe(true);
    if (!kept.ok) {
      return;
    }
    expect(kept.rows).toHaveLength(1);
    expect(kept.rows[0]).toMatchObject({ boundary: "ESTEX", settlement_date: "2026-10-23", flow_mw: -40, limit_mw: 1200 });
    expect(kept.retainedDates).toEqual(["2026-10-23"]);
  });

  it("keeps both instants when the wall clock repeats", () => {
    const csv = [
      "Constraint Group,Date_ Time GMT_BST,Limit_MW,Flow_MW",
      "ESTEX,2026-10-25T01:00:00,10,1",
      "ESTEX,2026-10-25T01:30:00,10,2",
      "ESTEX,2026-10-25T01:00:00,10,3",
      "ESTEX,2026-10-25T01:30:00,10,4",
    ].join("\n");
    const parsed = parseDayAheadCsv(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const starts = parsed.rows.map((row) => row.interval_start);
    expect(new Set(starts).size).toBe(starts.length);
    expect(starts[2]! > starts[0]!).toBe(true);
  });

  it("uses the NESO financial year from the London date", () => {
    expect(nesoFinancialYear(new Date("2026-03-31T22:59:00.000Z"))).toBe("2025-2026");
    expect(nesoFinancialYear(new Date("2026-03-31T23:00:00.000Z"))).toBe("2026-2027");
  });

  it("normalises a CKAN timestamp and requires one named CSV", () => {
    expect(ckanInstant("2026-10-14T16:11:39.738976")).toBe("2026-10-14T16:11:39.738Z");
    expect(new Date("2026-10-14T16:11:39.738Z").toISOString()).toBe("2026-10-14T16:11:39.738Z");
    const selected = selectNesoResource(
      [
        { name: "Day Ahead Constraint Flows and Limits", format: "CSV", url: "https://api.neso.energy/a.csv", last_modified: null },
        { name: "Other", format: "CSV", url: "https://api.neso.energy/b.csv", last_modified: null },
      ],
      "Day Ahead Constraint Flows and Limits",
    );
    expect(selected?.url).toBe("https://api.neso.energy/a.csv");
    expect(
      selectNesoResource(
        [
          { name: "Day Ahead Constraint Flows and Limits", format: "CSV", url: "https://api.neso.energy/a.csv", last_modified: null },
          { name: "Day Ahead Constraint Flows and Limits", format: "CSV", url: "https://api.neso.energy/b.csv", last_modified: null },
        ],
        "Day Ahead Constraint Flows and Limits",
      ),
    ).toBeNull();
  });
});

describe("measured charts", () => {
  it("refuses a forecast series and refuses a shared £ and MWh axis", () => {
    expect(() => assertMeasuredKind({ kind: "forecast" })).toThrow("A forecast series cannot render on a measured chart");
    expect(() => assertSingleAxis(["GBP", "MWh"])).toThrow("£ and MWh never share an axis");
    expect(() =>
      measuredCostChart({ kind: "forecast", unit: "GBP", points: [] } as never),
    ).toThrow("A forecast series cannot render on a measured chart");
    expect(() => measuredVolumeChart({ kind: "forecast", unit: "MWh", points: [] } as never)).toThrow(
      "A forecast series cannot render on a measured chart",
    );
    const page = fixtureConstraintsHistory("breakdown");
    const model = buildConstraintsPage({
      breakdown: page.latest,
      breakdownPrevious: page.previous,
      dayAhead: fixtureConstraintsHistory("day-ahead").latest,
    });
    expect(model.cost?.unit).toBe("GBP");
    expect(model.volume?.unit).toBe("MWh");
    expect(model.cost?.kind).toBe("measured");
    expect(measuredCostChart(model.cost!).unit).toBe("GBP");
    expect(measuredVolumeChart(model.volume!).unit).toBe("MWh");
    expect(CONSTRAINTS_TINYBIRD_OPS).toBe(0);
  });
});

describe("constraint page model", () => {
  it("reconciles cost shares and keeps the earlier release", () => {
    const model = buildConstraintsPage({
      breakdown: fixtureConstraintsHistory("breakdown").latest,
      breakdownPrevious: fixtureConstraintsHistory("breakdown").previous,
      dayAhead: fixtureConstraintsHistory("day-ahead").latest,
    });
    expect(model.earlierReleaseKept).toBe(true);
    expect(model.latest).not.toBeNull();
    const latest = model.latest!;
    expect(latest.rows.reduce((sum, row) => sum + row.gbp, 0)).toBe(latest.totalGbp);
    expect(latest.rows.reduce((sum, row) => sum + (row.share ?? 0), 0)).toBe(100);
    expect(model.dayAhead?.issuedLabel.startsWith("Day-ahead forecast, issued ")).toBe(true);
    expect(model.publishingLag).toBeNull();
    const settlement = latest.settlementDate;
    const within = buildConstraintsPage({
      breakdown: fixtureConstraintsHistory("breakdown").latest,
      breakdownPrevious: null,
      dayAhead: null,
      now: new Date(Date.parse(`${settlement}T12:00:00.000Z`) + 7 * 86_400_000),
    });
    const late = buildConstraintsPage({
      breakdown: fixtureConstraintsHistory("breakdown").latest,
      breakdownPrevious: null,
      dayAhead: null,
      now: new Date(Date.parse(`${settlement}T12:00:00.000Z`) + 8 * 86_400_000),
    });
    expect(within.publishingLag).toBeNull();
    expect(late.publishingLag).toBe(measuredBreakdownLagNote(settlement));
    expect(model.dayAhead?.boundaries.map((row) => row.boundary)).toEqual(["ESTEX", "FLOWSTH"]);
    const joined = JSON.stringify(model);
    expect(joined).not.toMatch(BANNED);
    expect(joined).not.toMatch(/curtailment/i);
  });
});
