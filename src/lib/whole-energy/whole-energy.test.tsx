import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { METRICS, WHOLE_ENERGY_METRICS } from "@/lib/metrics";
import { buildOgCard, ogCacheControl } from "@/lib/og/model";
import { OG_CACHE_CONTROL, OG_HOURLY_CACHE_CONTROL } from "@/lib/site";
import { DISPLAY_QUANTUM_TWH, ktoeTextToTwh } from "@/lib/whole-energy/convert";
import {
  FINAL_CONSUMPTION_BASE,
  PRIMARY_SUPPLY_BASE,
  WHOLE_ENERGY_ATTRIBUTION,
  WHOLE_ENERGY_EDITION_YEAR,
  WHOLE_ENERGY_FLOW_LABEL,
  WHOLE_ENERGY_H1,
  WHOLE_ENERGY_TITLE,
  wholeEnergyStandfirst,
  wholeEnergyUnitLabel,
} from "@/lib/whole-energy/copy";
import { loadWholeEnergyEdition } from "@/lib/whole-energy/load";
import { buildWholeEnergyPage, type DisplayedBalanceRow } from "@/lib/whole-energy/model";
import { parseBalanceSheet } from "@/lib/whole-energy/parse";
import { BALANCE_COLUMNS, COLUMN_LABEL, ROW_SPEC } from "@/lib/whole-energy/spec";
import { WholeEnergyBoard } from "@/components/whole-energy/whole-energy-board";

const BANNED = /\b(live|real-time|right now)\b/i;

function quanta(value: number): number {
  return Math.round(value / DISPLAY_QUANTUM_TWH);
}

function cell(row: DisplayedBalanceRow, column: string): number {
  const found = row.cells.find((item) => item.column === column);
  if (!found) {
    throw new Error(`missing ${row.id} ${column}`);
  }
  return found.value;
}

function sheet(year: number, unit: string, rows: readonly (readonly unknown[])[]): unknown[][] {
  return [
    [`Aggregate energy balance ${year} (${unit})`],
    ["", ...BALANCE_COLUMNS.map((column) => COLUMN_LABEL[column])],
    ...rows.map((row) => [...row]),
  ];
}

function zeroRow(label: string, total = 0): unknown[] {
  return [label, ...BALANCE_COLUMNS.map((column) => (column === "total" ? total : 0))];
}

describe("whole energy balance", () => {
  it("converts the checked-in ktoe edition and keeps each share on one base", () => {
    const edition = loadWholeEnergyEdition();
    expect(edition.year).toBe(WHOLE_ENERGY_EDITION_YEAR);
    expect(edition.geography).toBe("UK");
    expect(edition.conversion.statement).toBe("1 toe = 11,630 kWh, so 1 ktoe = 0.01163 TWh.");
    const model = buildWholeEnergyPage(edition);
    const [gas, power, electricity] = model.path;
    const supply = model.rows.find((row) => row.id === "primary_supply");
    const generation = model.rows.find((row) => row.id === "electricity_generation");
    const finalRow = model.rows.find((row) => row.id === "final_consumption");
    const difference = model.rows.find((row) => row.id === "statistical_difference");
    const demand = model.rows.find((row) => row.id === "primary_demand");
    if (!supply || !generation || !finalRow || !difference || !demand) {
      throw new Error("balance rows missing");
    }

    expect(ktoeTextToTwh(edition.rows.find((row) => row.id === "primary_supply")?.ktoe.natural_gas ?? "")).toBeCloseTo(
      671.3835017,
      6,
    );
    expect(gas.text).toBe("671.4");
    expect(gas.shareText).toBe("35% of primary energy supply");
    expect(gas.shareBase).toBe(PRIMARY_SUPPLY_BASE);
    expect(Math.abs(gas.value - gas.exact)).toBeLessThanOrEqual(DISPLAY_QUANTUM_TWH);
    expect(gas.value).toBe(cell(supply, "natural_gas"));

    expect(power.text).toBe("192.3");
    expect(power.shareText).toBe("10% of primary energy supply");
    expect(power.shareBase).toBe(PRIMARY_SUPPLY_BASE);
    expect(Math.abs(power.value - power.exact)).toBeLessThanOrEqual(DISPLAY_QUANTUM_TWH);
    expect(cell(generation, "natural_gas")).toBeLessThan(0);
    expect(power.value).toBe(Math.abs(cell(generation, "natural_gas")));
    expect(generation.role).toBe("transformation_part");
    expect(model.rows.filter((row) => row.role === "supply_component").map((row) => row.id)).not.toContain(
      "electricity_generation",
    );

    expect(electricity.text).toBe("275.5");
    expect(electricity.shareText).toBe("18% of final consumption");
    expect(electricity.shareBase).toBe(FINAL_CONSUMPTION_BASE);
    expect(Math.abs(electricity.value - electricity.exact)).toBeLessThanOrEqual(DISPLAY_QUANTUM_TWH);

    const homes = model.sectors.find((sector) => sector.id === "homes");
    const transport = model.sectors.find((sector) => sector.id === "transport");
    const industry = model.sectors.find((sector) => sector.id === "industry");
    expect(homes?.totalText).toBe("395.5");
    expect(homes?.shareText).toBe("26% of final consumption");
    expect(transport?.totalText).toBe("639.7");
    expect(transport?.shareText).toBe("42% of final consumption");
    expect(industry?.totalText).toBe("201.5");
    expect(industry?.shareText).toBe("13% of final consumption");

    for (const share of [...model.path.map((node) => node.shareText), ...model.sectors.map((sector) => sector.shareText)]) {
      expect(share).toMatch(/% of (primary energy supply|final consumption)$/);
      expect(share.includes(PRIMARY_SUPPLY_BASE) && share.includes(FINAL_CONSUMPTION_BASE)).toBe(false);
    }

    const supplyParts = model.rows.filter((row) => row.role === "supply_component");
    expect(supplyParts.reduce((sum, row) => sum + quanta(cell(row, "total")), 0)).toBe(quanta(cell(supply, "total")));
    const transformParts = model.rows.filter((row) => row.role === "transformation_part");
    const transformation = model.rows.find((row) => row.id === "transformation");
    if (!transformation) {
      throw new Error("transformation missing");
    }
    expect(transformParts.reduce((sum, row) => sum + quanta(cell(row, "total")), 0)).toBe(
      quanta(cell(transformation, "total")),
    );
    const finalParts = model.rows.filter((row) => row.role === "final_part");
    expect(finalParts.map((row) => row.id)).toEqual(["industry", "transport", "other_final", "non_energy_use"]);
    expect(finalParts.reduce((sum, row) => sum + quanta(cell(row, "total")), 0)).toBe(quanta(cell(finalRow, "total")));
    expect(model.rows.find((row) => row.id === "domestic")?.role).toBe("final_subset");
    expect(difference.emphasis).toBe(true);
    expect(cell(difference, "total")).not.toBe(0);
    expect(quanta(cell(supply, "total")) - quanta(cell(difference, "total"))).toBe(quanta(cell(demand, "total")));
    for (const row of model.rows) {
      const fuels = row.cells.filter((item) => item.column !== "total");
      expect(fuels.reduce((sum, item) => sum + quanta(item.value), 0)).toBe(quanta(cell(row, "total")));
    }
  });

  it("refuses a sheet that is not ktoe and walks the published row order", () => {
    const rows = ROW_SPEC.map((spec, index) => zeroRow(spec.match, index === 0 ? 10 : 0));
    const parsed = parseBalanceSheet(sheet(2025, "ktoe", rows), 2025);
    expect(parsed.rows[0]?.ktoe.total).toBe("10.00");
    expect(parsed.rows).toHaveLength(ROW_SPEC.length);
    expect(() => parseBalanceSheet(sheet(2025, "TWh", rows), 2025)).toThrow(/ktoe/);
    expect(() => parseBalanceSheet(sheet(2024, "ktoe", rows), 2025)).toThrow(/2025/);
    expect(() => parseBalanceSheet(sheet(2025, "ktoe", rows.slice(0, -1)), 2025)).toThrow(/balance rows/);
  });

  it("matches the committed release and leaves the word live out", () => {
    const edition = JSON.parse(readFileSync(resolve(process.cwd(), "data/catalogue/whole-energy.json"), "utf8")) as unknown;
    const releases = readFileSync(resolve(process.cwd(), "data/catalogue/source_releases.ndjson"), "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { dataset_id: string; content_hash: string; content: unknown; source_release_id: string });
    const release = releases.filter((line) => line.dataset_id === "desnz-dukes:dukes-1.1");
    expect(release).toHaveLength(1);
    const line = release[0];
    if (!line) {
      throw new Error("missing DUKES 1.1 release");
    }
    expect(line.source_release_id).toBe("desnz-dukes:dukes-1.1:2026-07-30T00:00:00.000Z");
    expect(sha256Prefixed(line.content)).toBe(line.content_hash);
    expect(sha256Prefixed(edition)).toBe(line.content_hash);
    const runs = readFileSync(resolve(process.cwd(), "data/catalogue/ingestion_runs.ndjson"), "utf8");
    expect(runs).toContain(line.source_release_id);

    const page = readFileSync(resolve(process.cwd(), "src/app/system/whole-energy/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 86400");
    expect(page).not.toContain("queryPipe");
    expect(WHOLE_ENERGY_TITLE).toBe("UK energy balance 2025: gas, power, oil and heat | Grid");
    expect(WHOLE_ENERGY_H1).toBe("How do electricity, gas, oil, heat and transport fit together?");
    expect(wholeEnergyStandfirst(2025)).toBe(
      "Annual figures for 2025 from the official energy balance. These are not today's figures.",
    );
    expect(WHOLE_ENERGY_FLOW_LABEL).toBe("Whole energy flows");
    expect(wholeEnergyUnitLabel(2025)).toBe("TWh, year 2025.");
    expect(WHOLE_ENERGY_ATTRIBUTION).toBe(OGL_V3_ATTRIBUTION);

    const html = renderToStaticMarkup(<WholeEnergyBoard model={buildWholeEnergyPage(loadWholeEnergyEdition())} />);
    expect(html).toContain("Whole energy flows");
    expect(html).toContain("TWh, year 2025.");
    expect(html).toContain("UK, including Northern Ireland. Annual, 2025.");
    expect(html).toContain(OGL_V3_ATTRIBUTION);
    expect(html).toContain("Statistical difference is primary supply minus primary demand.");
    expect(html).toContain("It is already inside primary supply and is not added again.");
    expect(html).toContain('data-sector="homes"');
    expect(html).toContain('data-sector="transport"');
    expect(html).toContain('data-sector="industry"');
    expect(html).toContain('data-geography="UK"');
    expect(html).not.toMatch(BANNED);
    expect(html).not.toMatch(/\bGB\b/);

    const card = buildOgCard(
      { kind: "page", page: "whole-energy" },
      { facts: null, records: null, prices: null },
    );
    expect(card.kicker).toBe(wholeEnergyStandfirst(WHOLE_ENERGY_EDITION_YEAR));
    expect(card.source).toBe(OGL_V3_ATTRIBUTION);
    expect(ogCacheControl({ kind: "page", page: "whole-energy" })).toBe(OG_CACHE_CONTROL);
    expect(ogCacheControl({ kind: "page", page: "whole-energy" })).not.toBe(OG_HOURLY_CACHE_CONTROL);
    expect(Object.keys(METRICS).some((id) => id.startsWith("energy.uk."))).toBe(false);
    expect(Object.keys(WHOLE_ENERGY_METRICS)).toHaveLength(10);
    expect(Object.values(WHOLE_ENERGY_METRICS).every((metric) => metric.geography_id === "UK")).toBe(true);
    expect(Object.values(WHOLE_ENERGY_METRICS).every((metric) => metric.expected_cadence === "P1Y")).toBe(true);
    expect(WHOLE_ENERGY_METRICS["energy.uk.transformation.natural_gas"].sign_convention).toBe(
      "negative_transformation_input",
    );
  });
});
