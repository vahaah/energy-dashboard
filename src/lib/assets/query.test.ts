import { describe, expect, it } from "vitest";
import { comboboxKeyMotion, queryAssets, searchAssets } from "@/lib/assets/query";
import type { AssetIndexRow } from "@/lib/assets/types";

function row(patch: Partial<AssetIndexRow> & Pick<AssetIndexRow, "id" | "name">): AssetIndexRow {
  return {
    operator: "",
    technology: "solar_pv",
    status: "operational",
    mw: 1,
    region: "London",
    location: "London, England",
    country: "England",
    source: "REPD",
    sources: ["REPD"],
    latitude: 51.5,
    longitude: -0.1,
    aka: "",
    ...patch,
  };
}

const rows = [
  row({ id: "ast_0000000000000001", name: "Sizewell B", technology: "nuclear", mw: 1200, source: "DUKES", sources: ["DUKES"], operator: "EDF", region: "East England", location: "East England, Suffolk" }),
  row({ id: "ast_0000000000000002", name: "Cuckoo Grove Farm", technology: "solar_pv", mw: 5, operator: "Lightsource BP", aka: "Cuckoo Grove" }),
  row({ id: "ast_0000000000000003", name: "LondonEnergy Site", operator: "LondonEnergy", region: "London" }),
];

describe("asset search", () => {
  it("ranks a name prefix ahead of a location hit and matches operators", () => {
    expect(searchAssets(rows, "size", 8).map((item) => item.name)).toEqual(["Sizewell B"]);
    expect(searchAssets(rows, "EDF", 8).map((item) => item.id)).toEqual(["ast_0000000000000001"]);
    expect(searchAssets(rows, "nuclear", 8).map((item) => item.name)).toEqual(["Sizewell B"]);
    expect(searchAssets(rows, "london energy", 8).map((item) => item.name)).toEqual(["LondonEnergy Site"]);
    expect(searchAssets(rows, "cuckoo grove", 8).map((item) => item.name)).toEqual(["Cuckoo Grove Farm"]);
    expect(searchAssets(rows, "", 8)).toEqual([]);
  });

  it("filters, sorts null capacity last, and paginates", () => {
    const filtered = queryAssets(rows, {
      q: "",
      technology: "solar_pv",
      status: null,
      source: "REPD",
      region: "",
      sort: "mw",
      dir: "desc",
      page: 1,
      pageSize: 1,
    });
    expect(filtered.total).toBe(2);
    expect(filtered.pages).toBe(2);
    expect(filtered.rows[0]?.name).toBe("Cuckoo Grove Farm");
    const paged = queryAssets(
      [row({ id: "ast_0000000000000004", name: "A", mw: null }), row({ id: "ast_0000000000000005", name: "B", mw: 2 })],
      { q: "", technology: null, status: null, source: null, region: "", sort: "mw", dir: "asc", page: 9, pageSize: 25 },
    );
    expect(paged.page).toBe(1);
    expect(paged.rows.map((item) => item.name)).toEqual(["B", "A"]);
  });

  it("moves a combobox from the keyboard", () => {
    expect(comboboxKeyMotion({ key: "ArrowDown", open: false, index: 0, length: 3 })).toEqual({ type: "open", index: 0 });
    expect(comboboxKeyMotion({ key: "ArrowUp", open: true, index: 0, length: 3 })).toEqual({ type: "move", index: 2 });
    expect(comboboxKeyMotion({ key: "Enter", open: true, index: 1, length: 3 })).toEqual({ type: "select", index: 1 });
    expect(comboboxKeyMotion({ key: "Escape", open: true, index: 1, length: 3 })).toEqual({ type: "close" });
    expect(comboboxKeyMotion({ key: "Home", open: true, index: 2, length: 3 })).toEqual({ type: "move", index: 0 });
    expect(comboboxKeyMotion({ key: "a", open: true, index: 0, length: 0 })).toEqual({ type: "none" });
  });
});
