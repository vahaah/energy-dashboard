import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addUtcDays } from "@/lib/london-time";
import { loadNationalGasCatalogue } from "@/lib/ingest/national-gas/catalogue";
import { checkGasRelease, checkNationalGasSpike, gasFixtureDir } from "@/lib/ingest/national-gas/check";
import { gasDayContaining, gasDayFromLabel } from "@/lib/ingest/national-gas/gas-day";
import { parseGasCsv, type GasObservation } from "@/lib/ingest/national-gas/parse";
import { GAS_PUBLICATION_IDS } from "@/lib/ingest/national-gas/publications";
import { takeGasBasis, takeGasQuantityKind } from "@/lib/ingest/national-gas/quantity";
import { buildGasRelease, GAS_SPIKE_RETRIEVED_AT, gasReleaseSchema } from "@/lib/ingest/national-gas/release";
import { partsReconcile, sumDayTotals } from "@/lib/ingest/national-gas/total";

const catalogue = loadNationalGasCatalogue();
const fixtures = gasFixtureDir();
const RELEASE_DAY = "2026-10-13";

function readFixture(id: string): string {
  return readFileSync(join(fixtures, `${id}.csv`), "utf8");
}

function observations(id: string): GasObservation[] {
  return parseGasCsv(readFixture(id), catalogue).observations;
}

describe("gas day", () => {
  it("uses 23 hours across the March 2026 clock change and 25 across October", () => {
    expect(gasDayFromLabel("2026-03-28")).toEqual({
      label: "2026-03-28",
      start: "2026-03-28T05:00:00.000Z",
      end: "2026-03-29T04:00:00.000Z",
    });
    expect(gasDayFromLabel("2026-03-29")).toEqual({
      label: "2026-03-29",
      start: "2026-03-29T04:00:00.000Z",
      end: "2026-03-30T04:00:00.000Z",
    });
    expect(gasDayContaining(new Date("2026-03-29T03:30:00.000Z"))).toEqual(gasDayFromLabel("2026-03-28"));

    expect(gasDayFromLabel("2026-10-24")).toEqual({
      label: "2026-10-24",
      start: "2026-10-24T04:00:00.000Z",
      end: "2026-10-25T05:00:00.000Z",
    });
    expect(gasDayFromLabel("2026-10-25")).toEqual({
      label: "2026-10-25",
      start: "2026-10-25T05:00:00.000Z",
      end: "2026-10-26T05:00:00.000Z",
    });
    expect(gasDayContaining(new Date("2026-10-25T04:30:00.000Z"))).toEqual(gasDayFromLabel("2026-10-24"));
    expect(gasDayContaining(new Date("2026-10-25T05:00:00.000Z")).label).toBe("2026-10-25");
  });

  it("puts a rate before 05:00 on the previous gas day and 05:00 on the new one", () => {
    const national = observations("PUBOB2042");
    const before = national.find((row) => row.applicable_at === "2026-10-14T03:00:05.000Z");
    const atStart = national.find((row) => row.applicable_at === "2026-10-14T04:00:12.000Z");
    expect(before?.gas_day).toEqual(gasDayFromLabel("2026-10-13"));
    expect(atStart?.gas_day).toEqual(gasDayFromLabel("2026-10-14"));
  });
});

describe("national gas parsers", () => {
  it("keeps the homepage free of the gas parser and MapLibre", () => {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    const dashboard = readFileSync(join(process.cwd(), "src/components/dashboard.tsx"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).not.toContain("ingest/national-gas");
    expect(dashboard).not.toContain("ingest/national-gas");
    expect(home).not.toContain("maplibre");
    expect(dashboard).not.toContain("maplibre");
  });

  it("reconciles north and south with the national rate at every timestamp", () => {
    const byInstant = new Map<string, Record<string, number>>();
    for (const id of ["PUBOB2042", "PUBOB2043", "PUBOB2044"]) {
      for (const row of observations(id)) {
        const slot = byInstant.get(row.applicable_at) ?? {};
        expect(row.value).not.toBeNull();
        slot[id] = row.value ?? 0;
        byInstant.set(row.applicable_at, slot);
      }
    }
    expect(byInstant.size).toBeGreaterThan(10);
    for (const [instant, slot] of byInstant) {
      expect(partsReconcile(slot.PUBOB2042 ?? Number.NaN, [slot.PUBOB2043 ?? Number.NaN, slot.PUBOB2044 ?? Number.NaN]), instant).toBe(true);
    }
  });

  it("does not sum rates", () => {
    const forced = observations("PUBOB2042")
      .slice(0, 2)
      .map((row) => ({ ...row, counts: true }));
    const total = sumDayTotals(forced);
    expect(total.ok).toBe(false);
    if (!total.ok) {
      expect(total.quarantine.map((item) => item.reason)).toContain("rate_not_summed");
    }
    const arithmetic = (forced[0]?.value ?? 0) + (forced[1]?.value ?? 0);
    expect(JSON.stringify(total)).not.toContain(String(arithmetic));
  });

  it("does not sum cumulative readings", () => {
    const forced = observations("PUBOB2042")
      .slice(0, 2)
      .map((row) => ({ ...row, quantity_kind: "cumulative" as const, counts: true }));
    const total = sumDayTotals(forced);
    expect(total.ok).toBe(false);
    if (!total.ok) {
      expect(total.quarantine.map((item) => item.reason)).toContain("cumulative_not_summed");
    }
    const arithmetic = (forced[0]?.value ?? 0) + (forced[1]?.value ?? 0);
    expect(JSON.stringify(total)).not.toContain(String(arithmetic));
  });

  it("counts the NTS demand parent and not its offtake children", () => {
    const rows = [
      ...observations("PUBOB637"),
      ...observations("PUBOBJ1015"),
      ...observations("PUBOBJ1016"),
      ...observations("PUBOBJ1017"),
      ...observations("PUBOBJ1018"),
      ...observations("PUBOBJ1020"),
    ].filter((row) => row.gas_day.label === RELEASE_DAY);
    const total = sumDayTotals(rows);
    const parent = rows.find((row) => row.publication_id === "PUBOB637");
    expect(parent?.value).not.toBeNull();
    expect(total).toEqual({
      ok: true,
      value: parent?.value,
      unit: "mscm",
      publication_ids: ["PUBOB637"],
    });
    const arithmetic = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    expect(total.ok && total.value).not.toBe(arithmetic);
  });

  it("does not treat the offtake sum as NTS demand", () => {
    const day = (id: string) => observations(id).find((row) => row.gas_day.label === RELEASE_DAY);
    const parent = day("PUBOB637")?.value ?? Number.NaN;
    const children = ["PUBOBJ1015", "PUBOBJ1016", "PUBOBJ1017", "PUBOBJ1018", "PUBOBJ1020"].map(
      (id) => day(id)?.value ?? Number.NaN,
    );
    expect(partsReconcile(parent, children)).toBe(false);
  });

  it("matches closing linepack to the next opening linepack", () => {
    const opening = observations("PUBOB693");
    const closing = observations("PUBOB694");
    const pairs = closing.flatMap((close) => {
      const open = opening.find((row) => row.gas_day.label === addUtcDays(close.gas_day.label, 1));
      return open ? [[close.value, open.value] as const] : [];
    });
    expect(pairs.length).toBeGreaterThan(0);
    for (const [close, open] of pairs) {
      expect(open).toBe(close);
    }
  });

  it("keeps forecast_issued_at and two gas days on one issue time", () => {
    const rows = observations("PUBOB19");
    expect(rows.every((row) => row.forecast_issued_at === row.applicable_at)).toBe(true);
    const byIssue = new Map<string, string[]>();
    for (const row of rows) {
      const labels = byIssue.get(row.applicable_at) ?? [];
      labels.push(row.gas_day.label);
      byIssue.set(row.applicable_at, labels);
    }
    const overlap = [...byIssue.values()].find((labels) => new Set(labels).size > 1);
    expect(overlap?.sort()).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("treats storage injection and withdrawal as one day total each", () => {
    for (const id of ["PUBOB4423", "PUBOB4424"] as const) {
      const rows = observations(id);
      const byDay = new Map<string, number>();
      for (const row of rows) {
        byDay.set(row.gas_day.label, (byDay.get(row.gas_day.label) ?? 0) + 1);
        expect(row.quantity_kind).toBe("day total");
      }
      expect([...byDay.values()].every((count) => count === 1)).toBe(true);
    }
    expect(observations("PUBOB4423").every((row) => (row.value ?? 0) > 0)).toBe(true);
    expect(observations("PUBOB4424").every((row) => (row.value ?? 0) < 0)).toBe(true);
    const both = [...observations("PUBOB4423").slice(0, 1), ...observations("PUBOB4424").slice(0, 1)];
    expect(sumDayTotals(both).ok).toBe(false);
  });

  it("defers the repeated NTS energy demand extract", () => {
    const parsed = parseGasCsv(readFixture("PUBOB4422"), catalogue);
    expect(parsed.observations.length).toBe(31);
    expect(new Set(parsed.observations.map((row) => row.value))).toEqual(new Set([199.057290731661]));
    expect(parsed.observations.every((row) => row.counts === false)).toBe(true);
    expect(parsed.observations.every((row) => row.quantity_kind === "day total")).toBe(true);
    expect(parsed.quarantine.map((item) => item.reason)).toContain("unverified_series");
  });

  it("quarantines an unknown basis and keeps an unknown column", () => {
    const basis = takeGasBasis("to-date");
    expect(basis.ok).toBe(false);
    if (!basis.ok) {
      expect(basis.quarantine).toEqual({
        reason: "unknown_enum",
        publication_id: null,
        field: "basis",
        value: "to-date",
      });
    }
    expect(takeGasQuantityKind("banana").ok).toBe(false);

    const header = readFixture("PUBOB2042").split("\n").slice(0, 6).join("\n");
    const text = `${header}\nApplicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator,Extra\n14/10/2026 06:00:10,14/10/2026,"System Entry Flows, National, Physical",159.9,14/10/2026 06:05:00,,nope\n15/10/2026 06:00:10,15/10/2026,Not a series,,15/10/2026 06:05:00,\n`;
    const parsed = parseGasCsv(text, catalogue);
    expect(parsed.quarantine).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "unknown_column", field: "Extra" }),
        expect.objectContaining({ reason: "unknown_publication", value: "Not a series" }),
      ]),
    );
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.observations[0]?.value).toBe(159.9);
    expect(parsed.observations.map((row) => row.name)).not.toContain("Not a series");
  });

  it("stores a blank value as null", () => {
    const header = readFixture("PUBOB2042").split("\n").slice(0, 6).join("\n");
    const text = `${header}\nApplicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator\n14/10/2026 06:00:10,14/10/2026,"System Entry Flows, National, Physical",,14/10/2026 06:05:00,\n`;
    const parsed = parseGasCsv(text, catalogue);
    expect(parsed.observations[0]?.value).toBeNull();
    expect(parsed.quarantine).toEqual([]);
  });
});

describe("gas release contract", () => {
  const rows = GAS_PUBLICATION_IDS.flatMap((id) => observations(id));
  const release = buildGasRelease({
    catalogue,
    observations: rows,
    quarantine: [],
    gasDayLabel: RELEASE_DAY,
    retrievedAt: GAS_SPIKE_RETRIEVED_AT,
  });

  it("matches the committed fixture", () => {
    const committed = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/gas/release.json"), "utf8"));
    expect(gasReleaseSchema.parse(committed)).toEqual(release);
    expect(checkGasRelease(JSON.stringify(committed))).toEqual([]);
    expect(checkNationalGasSpike()).toEqual([]);
    expect(release.gas_day).toEqual(gasDayFromLabel(RELEASE_DAY));
    expect(release.bases).toEqual(["completed", "flow"]);
    expect(release.coverage.deferred_publication_ids).toEqual(["PUBOB4422"]);
    expect(release.coverage.counted_publication_ids).not.toContain("PUBOB2042");
    expect(release.coverage.counted_publication_ids).toContain("PUBOB637");
    expect(release.coverage.uncounted_publication_ids).toContain("PUBOBJ1015");
    expect(release.components.every((component) => component.retrieved_at === GAS_SPIKE_RETRIEVED_AT)).toBe(true);
  });

  it("rejects a release that counts a rate", () => {
    const broken = structuredClone(release);
    const rate = broken.components.find((component) => component.quantity_kind === "rate");
    expect(rate).toBeDefined();
    if (rate) {
      rate.counts = true;
    }
    const errors = checkGasRelease(JSON.stringify(broken));
    expect(errors.join("\n")).toMatch(/rate/);
    expect(errors.join("\n")).toMatch(/must not count/);
  });
});
