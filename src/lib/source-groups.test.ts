import { describe, expect, it } from "vitest";
import { buildGroupedSourceTable } from "@/lib/source-groups";
import type { Generation5min } from "@/lib/types";

function generation(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source };
}

const rows: Generation5min[] = [
  generation("2026-09-28 07:00:00", "ccgt", 7563),
  generation("2026-09-28 07:00:00", "wind", 3746),
  generation("2026-09-28 07:00:00", "nuclear", 4015),
  generation("2026-09-28 07:00:00", "biomass", 2948),
  generation("2026-09-28 07:00:00", "npshyd", 571),
  generation("2026-09-28 07:00:00", "ps", 231),
  generation("2026-09-28 07:00:00", "other", 224),
  generation("2026-09-28 07:00:00", "intfr", 396),
  generation("2026-09-28 07:00:00", "intned", -200),
  generation("2026-09-28 07:00:00", "embedded_wind", 917, "neso"),
  generation("2026-09-28 07:00:00", "embedded_solar", 800, "pvlive"),
  generation("2026-09-28 06:30:00", "ccgt", 7000),
  generation("2026-09-28 06:30:00", "wind", 3500),
];

describe("grouped source table", () => {
  it("groups fossil, renewables, other, interconnectors and storage", () => {
    const table = buildGroupedSourceTable(rows, 25717);

    expect(table.groups.map((group) => group.id)).toEqual([
      "fossil",
      "renewables",
      "other",
      "interconnectors",
      "storage",
    ]);

    const hydro = table.groups[1]?.rows.find((row) => row.id === "hydro");
    const pumped = table.groups[4]?.rows.find((row) => row.id === "pumped_storage");
    const battery = table.groups[4]?.rows.find((row) => row.id === "battery");
    const wind = table.groups[1]?.rows.find((row) => row.id === "wind");
    const france = table.groups[3]?.rows.find((row) => row.label === "France");

    expect(hydro?.mw).toBe(571);
    expect(pumped?.mw).toBe(231);
    expect(battery?.gwLabel).toBe("—");
    expect(battery?.missingNote).toBe("not published");
    expect(wind?.mw).toBe(4663);
    expect(france?.mw).toBe(396);
    expect(table.mix.some((segment) => segment.hatched && segment.label === "France")).toBe(true);
  });

  it("reports share of the one demand figure", () => {
    const table = buildGroupedSourceTable(rows, 25000);
    const gas = table.groups[0]?.rows.find((row) => row.id === "gas");
    expect(gas?.shareLabel).toBe("30.3%");
    expect(gas?.sparkline.length).toBeGreaterThan(1);
  });

  it("keeps an absent PV Live reading as missing, not zero", () => {
    const withoutSolar = rows.filter(
      (row) => row.fuel_type !== "embedded_solar" && row.fuel_type !== "solar"
    );
    const table = buildGroupedSourceTable(withoutSolar, 25000);
    const solar = table.groups[1]?.rows.find((row) => row.id === "solar");

    expect(solar?.mw).toBeNull();
    expect(solar?.gwLabel).toBe("—");
    expect(solar?.missingNote).toBe("no data");
    expect(table.mix.some((segment) => segment.label === "Solar")).toBe(false);
  });

  it("keeps a group total unavailable when every child reading is missing", () => {
    const table = buildGroupedSourceTable(
      [
        generation("2026-09-28 07:00:00", "ccgt", 7563),
        generation("2026-09-28 07:00:00", "nuclear", 4015),
      ],
      12000
    );
    const renewables = table.groups.find((group) => group.id === "renewables");

    expect(renewables?.mw).toBeNull();
    expect(renewables?.gwLabel).toBe("—");
    expect(renewables?.shareLabel).toBe("—");
    expect(renewables?.rows.every((row) => row.mw == null)).toBe(true);
  });

  it("omits the mix bar when demand is unavailable", () => {
    const table = buildGroupedSourceTable(rows, null);
    expect(table.mix).toEqual([]);
    expect(table.groups[0]?.shareLabel).toBe("—");
  });

  it("averages repeated 5-minute readings inside a sparkline bucket", () => {
    const table = buildGroupedSourceTable(
      [
        generation("2026-09-28 07:00:00", "ccgt", 6000),
        generation("2026-09-28 07:05:00", "ccgt", 8000),
        generation("2026-09-28 07:10:00", "ccgt", 7000),
        generation("2026-09-28 07:00:00", "wind", 4000),
      ],
      20_000
    );
    const gas = table.groups[0]?.rows.find((row) => row.id === "gas");

    expect(gas?.sparkline).toEqual([7000]);
  });

  it("keeps mix-bar percentages as share of demand when Britain is exporting", () => {
    const table = buildGroupedSourceTable(rows, 12_000);
    const gas = table.mix.find((segment) => segment.label === "Gas");
    const mixShare = table.mix.reduce((sum, segment) => sum + segment.pct, 0);

    expect(gas?.pct).toBeCloseTo((7563 / 12_000) * 100, 5);
    expect(mixShare).toBeGreaterThan(100);
  });
});
