import { describe, expect, it } from "vitest";
import { DURATION_TOOLTIP } from "@/lib/assets/labels";
import { formatDisplay } from "@/lib/display-rounding";
import { buildStorageInventory, durationHours, type StorageInput } from "@/lib/storage/inventory";
import { loadStorageInventory } from "@/lib/storage/load";
import {
  ENERGY_POWER_ONLY,
  STORAGE_BATTERIES_UNREPORTED,
  STORAGE_COVERAGE_FOOTNOTE,
  STORAGE_FLEET_COVERED,
  STORAGE_NATIONAL_ONLY,
} from "@/lib/storage/copy";
import { buildStorageDocument } from "@/lib/storage/page-model";

function row(overrides: Partial<StorageInput> & Pick<StorageInput, "id" | "externalRef" | "name">): StorageInput {
  return {
    technology: "battery",
    status: "operational",
    country: "England",
    ratedMw: 10,
    energyMwh: null,
    colocatedRef: null,
    assetId: null,
    counts: true,
    ...overrides,
  };
}

describe("storage inventory", () => {
  it("counts a co-located REPD and DUKES pair once, on the counted megawatts", () => {
    const inventory = buildStorageInventory([
      row({
        id: "cap_repd",
        name: "Dinorwig",
        technology: "pumped_storage",
        country: "Wales",
        ratedMw: 1728,
        externalRef: "6839",
        assetId: "ast_dinorwig",
        counts: false,
      }),
      row({
        id: "cap_dukes",
        name: "Dinorwig",
        technology: "pumped_storage",
        country: "Wales",
        ratedMw: 1800,
        externalRef: "T_DIN",
        assetId: "ast_dinorwig",
        counts: true,
      }),
    ]);
    expect(inventory.assets).toHaveLength(1);
    expect(inventory.operating).toHaveLength(1);
    expect(inventory.operating[0]).toMatchObject({ ratedMw: 1800, energyMwh: null, durationHours: null });
  });

  it("counts a co-located battery pair once and leaves it out of the operating total", () => {
    const inventory = buildStorageInventory([
      row({
        id: "sto_a",
        name: "Denfield",
        externalRef: "17329",
        colocatedRef: "15198",
        ratedMw: 7,
        energyMwh: 14,
        status: "not_operating",
      }),
      row({
        id: "sto_b",
        name: "Denfield",
        externalRef: "15198",
        colocatedRef: "17329",
        ratedMw: 7,
        energyMwh: 14,
        status: "not_operating",
      }),
      row({ id: "sto_op", name: "Operating battery", externalRef: "1", ratedMw: 10, energyMwh: 25 }),
    ]);
    expect(inventory.assets.filter((asset) => asset.name === "Denfield")).toHaveLength(1);
    expect(inventory.assets.find((asset) => asset.name === "Denfield")).toMatchObject({
      ratedMw: 7,
      energyMwh: 14,
      durationHours: 2,
      status: "not_operating",
    });
    expect(inventory.operating.map((asset) => asset.ratedMw)).toEqual([10]);
    expect(durationHours(10, 25)).toBe(2.5);
  });

  it("keeps rated megawatts and energy megawatt-hours apart", () => {
    const inventory = buildStorageInventory([
      row({ id: "sto_op", name: "Fleet", externalRef: "9", ratedMw: 10, energyMwh: 25 }),
      row({ id: "sto_plan", name: "Proposed", externalRef: "8", ratedMw: 100, energyMwh: 100, status: "not_operating" }),
    ]);
    const document = buildStorageDocument(inventory, { available: false }, 2026);
    expect(document.rated?.totalLabel).toBe("10.0");
    expect(document.energy?.totalLabel).toBe("25.0");
    expect(document.rows[0]?.ratedLabel).toBe("10.0");
    expect(document.rows[0]?.energyLabel).toBe("25.0");
    expect(document.rows[0]?.durationLabel).toBe("2.5 h");
    expect(document.showEnergy).toBe(true);
    expect(document.showDuration).toBe(true);
    expect(document.energyNote).toBeNull();
    expect(document.coverage.nationalOnly).toBe(STORAGE_NATIONAL_ONLY);
    expect(document.coverage.lines).toEqual([
      { kind: "unreported", id: "battery", text: STORAGE_BATTERIES_UNREPORTED },
    ]);
    expect(document.notOperatingCount).toBe(1);
    expect(document.rows.some((item) => item.name === "Proposed")).toBe(false);
    const rated = Number(document.rated?.totalLabel);
    const energy = Number(document.energy?.totalLabel);
    expect(rated + energy).toBe(35);
    expect(rated).not.toBe(energy);
  });

  it("covers transmission-connected pumped storage by megawatts and leaves batteries unreported", () => {
    const inventory = buildStorageInventory([
      row({
        id: "pump",
        name: "Pump",
        technology: "pumped_storage",
        externalRef: "p",
        ratedMw: 1800,
        assetId: "ast_pump",
      }),
      row({
        id: "small",
        name: "Small scheme",
        technology: "pumped_storage",
        externalRef: "s",
        ratedMw: 20,
      }),
      row({ id: "bat", name: "Bat", externalRef: "b", ratedMw: 10.04, energyMwh: null }),
      row({ id: "gap", name: "Gap", externalRef: "g", ratedMw: null }),
    ]);
    const document = buildStorageDocument(inventory, { available: false }, 2026);
    expect(document.coverage.label).toBe(STORAGE_FLEET_COVERED);
    expect(document.coverage.nationalOnly).toBeNull();
    expect(document.coverage.footnote).toBe(STORAGE_COVERAGE_FOOTNOTE);
    expect(document.coverage.lines).toEqual([
      {
        kind: "mw",
        id: "pumped_storage",
        label: "Pumped storage",
        coveredLabel: "1,800.0",
        totalLabel: "1,800.0",
      },
      { kind: "unreported", id: "battery", text: STORAGE_BATTERIES_UNREPORTED },
    ]);
    expect(document.rated?.shares.find((share) => share.technology === "pumped_storage")?.mwLabel).toBe("1,820.0");
    expect(document.rated?.omitted).toBe(1);
    const shown = document.rows.map((item) => (item.ratedLabel === "Not available" ? 0 : Number(item.ratedLabel.replaceAll(",", ""))));
    const known = shown.filter((_, index) => document.rows[index]?.ratedLabel !== "Not available");
    expect(Number(formatDisplay(known.reduce((sum, value) => sum + value, 0), 0.1).replaceAll(",", ""))).toBe(
      Number(document.rated?.totalLabel?.replaceAll(",", "")),
    );
    expect(document.rated?.shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
    expect(document.showEnergy).toBe(false);
    expect(document.showDuration).toBe(false);
    expect(document.energyNote).toBe(ENERGY_POWER_ONLY);
    expect(document.rows.every((item) => item.energyLabel === null && item.durationLabel === null)).toBe(true);
    expect(DURATION_TOOLTIP).toBe("A ratio of the two capacities, not a guaranteed running time.");
  });
});

describe("checked-in storage inventory", () => {
  it("counts Dinorwig once, drops proposals from the operating total, and keeps batteries", () => {
    const inventory = loadStorageInventory();
    const dinorwig = inventory.assets.filter((asset) => asset.name === "Dinorwig");
    expect(dinorwig).toHaveLength(1);
    expect(dinorwig[0]).toMatchObject({
      ratedMw: 1800,
      energyMwh: null,
      durationHours: null,
      status: "operational",
      href: "/assets/ast_62f4f4460895576b/dinorwig",
    });
    expect(inventory.operating.find((asset) => asset.name === "Ffestiniog")?.ratedMw).toBe(360);
    expect(inventory.operating.find((asset) => asset.name === "Cruachan")?.ratedMw).toBe(440);
    expect(inventory.operating.find((asset) => asset.name === "Foyers")?.ratedMw).toBe(300);
    const denfield = inventory.assets.filter((asset) => asset.name === "Denfield - Battery Storage Facility");
    expect(denfield).toHaveLength(1);
    expect(denfield[0]).toMatchObject({ ratedMw: 7, status: "not_operating" });
    expect(inventory.assets.some((asset) => asset.name.includes("Kilroot"))).toBe(false);
    expect(inventory.operating.some((asset) => asset.name.includes("Coire Glas"))).toBe(false);
    expect(inventory.assets.some((asset) => asset.name.includes("Coire Glas"))).toBe(true);
    const operatingMw = inventory.operating.reduce((sum, asset) => sum + (asset.ratedMw ?? 0), 0);
    const pumped = inventory.operating
      .filter((asset) => asset.technology === "pumped_storage")
      .reduce((sum, asset) => sum + (asset.ratedMw ?? 0), 0);
    expect(pumped).toBe(2900);
    expect(operatingMw).toBeGreaterThan(pumped);
    expect(inventory.operating.every((asset) => asset.energyMwh === null)).toBe(true);
    expect(inventory.operating.some((asset) => asset.technology === "battery")).toBe(true);
    const document = buildStorageDocument(inventory, { available: false }, 2026);
    expect(document.coverage.nationalOnly).toBeNull();
    expect(document.coverage.lines[0]).toEqual({
      kind: "mw",
      id: "pumped_storage",
      label: "Pumped storage",
      coveredLabel: "2,900.0",
      totalLabel: "2,900.0",
    });
    expect(document.coverage.lines.find((line) => line.kind === "unreported")?.text).toBe(STORAGE_BATTERIES_UNREPORTED);
    expect(document.energyNote).toBe(ENERGY_POWER_ONLY);
    expect(document.showDuration).toBe(false);
    expect(document.rated?.shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
    const rowMw = document.rows.reduce(
      (sum, row) => sum + (row.ratedLabel === "Not available" ? 0 : Number(row.ratedLabel.replaceAll(",", ""))),
      0,
    );
    const shareMw = document.rated?.shares.reduce((sum, share) => sum + Number(share.mwLabel.replaceAll(",", "")), 0) ?? 0;
    const totalMw = Number(document.rated?.totalLabel?.replaceAll(",", ""));
    expect(Number(rowMw.toFixed(1))).toBe(totalMw);
    expect(Number(shareMw.toFixed(1))).toBe(totalMw);
    expect(document.notOperatingCount).toBeGreaterThan(0);
    const rendered = JSON.stringify(document);
    expect(rendered).not.toMatch(/state of charge|zero-carbon|new generation|real-time|\bright now\b/i);
  });
});
