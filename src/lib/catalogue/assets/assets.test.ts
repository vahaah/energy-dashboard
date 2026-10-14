import { describe, expect, it } from "vitest";
import { buildAssetRegister, countedMegawatts } from "@/lib/catalogue/assets/build";
import { assetRegisterErrors } from "@/lib/catalogue/assets/check";
import { distanceMetres, osgbToWgs84 } from "@/lib/catalogue/assets/osgb";
import { parseRepdCsv } from "@/lib/catalogue/assets/repd";
import { DUKES_SOURCE_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";
import { EMPTY_OVERRIDES, type CatalogueStation, type MatchOverrides } from "@/lib/catalogue/assets/types";

const RELEASES = {
  repd: "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z",
  dukes: "desnz-dukes:dukes-5.11:2026-07-30T00:00:00.000Z",
};

const RELEASE_REFS = [
  { source_release_id: RELEASES.repd, dataset_id: "desnz-repd:repd-quarterly", content: {} },
  { source_release_id: RELEASES.dukes, dataset_id: "desnz-dukes:dukes-5.11", content: {} },
];

/** Drax biomass units, British National Grid. Wikipedia places the station 350 m west of the Helmert point. */
const DRAX_EASTING = 466_650;
const DRAX_NORTHING = 427_050;
const DRAX_LATITUDE = 53.7352778;
const DRAX_LONGITUDE = -0.9963889;

function station(overrides: Partial<CatalogueStation> & Pick<CatalogueStation, "sourceId" | "externalRef" | "name">): CatalogueStation {
  return {
    technology: "solar_pv",
    country: "England",
    easting: 400_000,
    northing: 300_000,
    mw: 100,
    ...overrides,
  };
}

const HEADER =
  "Ref ID,Site Name,Technology Type,Installed Capacity (MWelec),Development Status,Country,X-coordinate,Y-coordinate";

describe("OSGB36 to WGS84", () => {
  it("puts Drax on the station, not at the origin", () => {
    const point = osgbToWgs84(DRAX_EASTING, DRAX_NORTHING);
    expect(point).toEqual({ latitude: 53.73559, longitude: -0.9911 });
    expect(point).not.toBeNull();
    if (!point) {
      return;
    }
    expect(distanceMetres(point.latitude, point.longitude, DRAX_LATITUDE, DRAX_LONGITUDE)).toBeLessThan(500);
    expect(osgbToWgs84(0, 0)).toBeNull();
  });
});

describe("REPD rows", () => {
  it("keeps a station with no coordinates and never emits (0, 0)", () => {
    const parsed = parseRepdCsv(
      [
        HEADER,
        '1,"No, coords",Solar Photovoltaics,1.5,Operational,England,,',
        "2,Origin,Solar Photovoltaics,2,Operational,England,0,0",
        "3,Battery,Battery,10,Operational,England,400000,300000",
        "4,Planned,Solar Photovoltaics,9,Application Submitted,England,400000,300000",
        "5,Drax,Biomass (dedicated),645,Operational ,England,466650,427050",
      ].join("\n"),
    );
    expect(parsed.stats).toMatchObject({ imported: 3, skippedStorage: 1, missingCoordinates: 2 });
    expect(parsed.stations.map((row) => row.externalRef)).toEqual(["1", "2", "5"]);
    const register = buildAssetRegister(parsed.stations, [], EMPTY_OVERRIDES, RELEASES);
    const listOnly = register.assets.filter((asset) => asset.name !== "Drax");
    expect(listOnly).toHaveLength(2);
    for (const asset of listOnly) {
      expect(asset.latitude).toBeNull();
      expect(asset.longitude).toBeNull();
    }
    const drax = register.assets.find((asset) => asset.name === "Drax");
    expect(drax?.latitude).toBe(53.73559);
    expect(drax?.longitude).toBe(-0.9911);
    const encoded = JSON.stringify(register);
    expect(encoded).not.toContain('"latitude":0');
    expect(encoded).not.toContain('"longitude":0');
  });

  it("rejects an unmapped operational technology", () => {
    expect(() =>
      parseRepdCsv(
        [HEADER, "9,Weird,Unobtainium,1,Operational,England,400000,300000"].join("\n"),
      ),
    ).toThrow(/not mapped: Unobtainium/);
  });
});

describe("REPD / DUKES dedupe", () => {
  it("matches a renamed capacity at the same grid point and ignores a shared generic word", () => {
    const repd = [
      station({
        sourceId: REPD_SOURCE_ID,
        externalRef: "4028",
        name: "Griffin Wind farm",
        technology: "onshore_wind",
        easting: 293_600,
        northing: 744_600,
        mw: 156,
      }),
      station({
        sourceId: REPD_SOURCE_ID,
        externalRef: "494",
        name: "Langwell Estate hydro scheme",
        technology: "hydro",
        easting: 218_915,
        northing: 901_914,
        mw: 1.2,
      }),
    ];
    const dukes = [
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "WON-000420",
        name: "Griffin Wind Farm",
        technology: "onshore_wind",
        easting: 293_600,
        northing: 744_600,
        mw: 188.6,
      }),
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "HNF-000084",
        name: "Rheidol Hydro Scheme Gen 4",
        technology: "hydro",
        easting: 270_704,
        northing: 279_283,
        mw: 1.25,
      }),
    ];
    const register = buildAssetRegister(repd, dukes, EMPTY_OVERRIDES, RELEASES);
    expect(register.matches.map((match) => match.dukes_site_codes[0])).toEqual(["WON-000420"]);
    expect(countedMegawatts(register.capacity)).toBe(156 + 1.2 + 1.25);
  });

  it("counts a coordinate match once", () => {
    const repd = [
      station({ sourceId: REPD_SOURCE_ID, externalRef: "10", name: "Same Farm", easting: 450_000, northing: 400_000, mw: 100 }),
    ];
    const dukes = [
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "SOL-1",
        name: "Same Farm Solar",
        easting: 450_100,
        northing: 400_100,
        mw: 100,
      }),
    ];
    const register = buildAssetRegister(repd, dukes, EMPTY_OVERRIDES, RELEASES);
    expect(register.matches).toHaveLength(1);
    expect(register.matches[0]?.counts_source).toBe(REPD_SOURCE_ID);
    expect(countedMegawatts(register.capacity)).toBe(100);
    expect(register.assets).toHaveLength(1);
    expect(assetRegisterErrors(register, RELEASE_REFS)).toEqual([]);
  });

  it("counts Drax biomass units from REPD and drops the DUKES double", () => {
    const repd = ["174", "175", "192", "6659"].map((ref) =>
      station({
        sourceId: REPD_SOURCE_ID,
        externalRef: ref,
        name: `Drax Unit ${ref}`,
        technology: "biomass",
        easting: DRAX_EASTING,
        northing: DRAX_NORTHING,
        mw: 645,
      }),
    );
    const dukes = [
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "BIO-000501",
        name: "Drax Power Station Biomass Units",
        technology: "biomass",
        easting: DRAX_EASTING,
        northing: DRAX_NORTHING,
        mw: 2580,
      }),
    ];
    const register = buildAssetRegister(repd, dukes, EMPTY_OVERRIDES, RELEASES);
    expect(register.matches[0]?.rule).toBe("coordinate_group");
    expect(countedMegawatts(register.capacity)).toBe(2580);
    expect(register.assets).toHaveLength(4);
    const point = register.assets[0];
    expect(point?.latitude).toBe(53.73559);
    expect(point?.longitude).toBe(-0.9911);
    expect(assetRegisterErrors(register, RELEASE_REFS)).toEqual([]);
  });

  it("applies a manual link and an unlink", () => {
    const repd = [
      station({ sourceId: REPD_SOURCE_ID, externalRef: "20", name: "Griffin", easting: 300_000, northing: 700_000, mw: 156 }),
      station({ sourceId: REPD_SOURCE_ID, externalRef: "21", name: "Twin", easting: 500_000, northing: 200_000, mw: 40 }),
    ];
    const dukes = [
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "WIN-1",
        name: "Griffin Wind Farm",
        technology: "onshore_wind",
        easting: 300_200,
        northing: 700_200,
        mw: 188.6,
      }),
      station({
        sourceId: DUKES_SOURCE_ID,
        externalRef: "SOL-2",
        name: "Twin Solar",
        easting: 500_050,
        northing: 200_050,
        mw: 40,
      }),
    ];
    repd[0] = { ...repd[0], technology: "onshore_wind" } as CatalogueStation;
    const linked: MatchOverrides = {
      catalogue_schema_version: 1,
      links: [{ dukes_site_codes: ["WIN-1"], repd_refs: ["20"], note: "Griffin capacity gap" }],
      unlinks: [],
    };
    const linkedRegister = buildAssetRegister(repd, dukes, linked, RELEASES);
    expect(linkedRegister.matches.find((match) => match.dukes_site_codes[0] === "WIN-1")?.confidence).toBe("manual");
    expect(countedMegawatts(linkedRegister.capacity)).toBe(196);
    const unlinked: MatchOverrides = {
      catalogue_schema_version: 1,
      links: [],
      unlinks: [{ dukes_site_codes: ["SOL-2"], repd_refs: ["21"], note: "different Twin sites" }],
    };
    const unlinkedRegister = buildAssetRegister(repd, dukes, unlinked, RELEASES);
    expect(unlinkedRegister.matches.some((match) => match.repd_refs.includes("21"))).toBe(false);
    expect(unlinkedRegister.matches.some((match) => match.repd_refs.includes("20"))).toBe(true);
    expect(countedMegawatts(unlinkedRegister.capacity)).toBe(156 + 40 + 40);
  });
});

describe("asset register checks", () => {
  it("rejects a stored origin", () => {
    const register = buildAssetRegister(
      [station({ sourceId: REPD_SOURCE_ID, externalRef: "30", name: "Origin" })],
      [],
      EMPTY_OVERRIDES,
      RELEASES,
    );
    const asset = register.assets[0];
    expect(asset).toBeDefined();
    if (!asset) {
      return;
    }
    const broken = {
      ...register,
      assets: [{ ...asset, latitude: 0, longitude: 0 }],
    };
    expect(assetRegisterErrors(broken, RELEASE_REFS).join("\n")).toMatch(/\(0, 0\)/);
  });
});
