import { describe, expect, it } from "vitest";
import { buildAssetDirectory } from "@/lib/assets/build";
import { containsLiveWord, formatMw, MAP_COVERAGE_COPY, precisionLabel } from "@/lib/assets/labels";
import { decodeAssetIndex, encodeAssetIndex } from "@/lib/assets/index-file";
import { partiesFromDukesRows, partiesFromRepdCsv } from "@/lib/catalogue/assets/parties";
import type { AssetRecord, CapacityRecord, MatchRecord, ProjectRecord } from "@/lib/catalogue/assets/types";
import type { SourceRelease } from "@/lib/catalogue/schema";
import type { GeoJsonFeature } from "@/lib/map/geojson";

const square: GeoJsonFeature = {
  type: "Feature",
  properties: { Area: "London" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-0.2, 51.4],
        [-0.05, 51.4],
        [-0.05, 51.6],
        [-0.2, 51.6],
        [-0.2, 51.4],
      ],
    ],
  },
};

function asset(patch: Partial<AssetRecord> & Pick<AssetRecord, "asset_id" | "name" | "technology">): AssetRecord {
  return {
    status: "operational",
    country: "England",
    latitude: 51.5,
    longitude: -0.12,
    ...patch,
  };
}

describe("asset directory build", () => {
  it("counts one side of a match, keeps the operator, and places the point in the DNO area", () => {
    const assets = [
      asset({ asset_id: "ast_aaaaaaaaaaaaaaaa", name: "London Plant", technology: "ccgt" }),
      asset({
        asset_id: "ast_bbbbbbbbbbbbbbbb",
        name: "No Grid Ref",
        technology: "solar_pv",
        country: null,
        latitude: null,
        longitude: null,
      }),
    ];
    const projects: ProjectRecord[] = [
      { project_id: "prj_aaaaaaaaaaaaaaaa", asset_id: "ast_aaaaaaaaaaaaaaaa", name: "London Plant", source_id: "desnz-dukes", external_ref: "CCGT-1" },
      { project_id: "prj_aaaaaaaaaaaaaaab", asset_id: "ast_aaaaaaaaaaaaaaaa", name: "London Plant REPD", source_id: "desnz-repd", external_ref: "99" },
      { project_id: "prj_bbbbbbbbbbbbbbbb", asset_id: "ast_bbbbbbbbbbbbbbbb", name: "No Grid Ref", source_id: "desnz-repd", external_ref: "100" },
    ];
    const capacity: CapacityRecord[] = [
      { capacity_record_id: "cap_aaaaaaaaaaaaaaaa", asset_id: "ast_aaaaaaaaaaaaaaaa", project_id: "prj_aaaaaaaaaaaaaaaa", source_id: "desnz-dukes", source_release_id: "desnz-dukes:dukes-5.11:2026-07-30T00:00:00.000Z", mw: 500, counts: true },
      { capacity_record_id: "cap_aaaaaaaaaaaaaaab", asset_id: "ast_aaaaaaaaaaaaaaaa", project_id: "prj_aaaaaaaaaaaaaaab", source_id: "desnz-repd", source_release_id: "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z", mw: 480, counts: false },
    ];
    const matches: MatchRecord[] = [
      {
        match_id: "mat_aaaaaaaaaaaaaaaa",
        confidence: "high",
        rule: "coordinates",
        dukes_site_codes: ["CCGT-1"],
        dukes_names: ["London Plant"],
        repd_refs: ["99"],
        distance_m: 12,
        repd_mw: 480,
        dukes_mw: 500,
        counts_source: "desnz-dukes",
      },
    ];
    const releases = [
      {
        catalogue_schema_version: 1,
        source_release_id: "desnz-dukes:dukes-5.11:2026-07-30T00:00:00.000Z",
        dataset_id: "desnz-dukes:dukes-5.11",
        published_at: "2026-07-30T00:00:00.000Z",
        content_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        content: { edition: "May 2026", published_at: "2026-07-30T00:00:00.000Z", download_url: "https://example.com/dukes.xlsx" },
      },
    ] as SourceRelease[];
    const built = buildAssetDirectory({
      assets,
      projects,
      capacity,
      matches,
      parties: [
        { source_id: "desnz-dukes", external_ref: "CCGT-1", operator: "RWE", region: "London", county: null },
        { source_id: "desnz-repd", external_ref: "99", operator: "RWE", region: "London", county: "Greater London" },
      ],
      releases,
      dnoFeatures: [square],
    });
    const london = built.details.get("ast_aaaaaaaaaaaaaaaa");
    expect(london?.row.region).toBe("London");
    expect(london?.row.operator).toBe("RWE");
    expect(london?.row.mw).toBe(500);
    expect(london?.row.source).toBe("DUKES");
    expect(london?.row.sources).toEqual(["DUKES", "REPD"]);
    expect(london?.row.aka).toContain("London Plant REPD");
    expect(london?.capacity.find((record) => record.source === "DUKES")?.edition).toBe("May 2026");
    expect(london?.matches).toHaveLength(1);
    expect(built.details.get("ast_bbbbbbbbbbbbbbbb")?.row.region).toBe("Not located");
    const decoded = decodeAssetIndex(JSON.parse(encodeAssetIndex(built.rows)));
    expect(decoded).toEqual(built.rows);
  });

  it("counts only the latest capacity release for a project and keeps older rows in the history", () => {
    const olderRelease = "desnz-dukes:dukes-5.11:2026-04-01T00:00:00.000Z";
    const newerRelease = "desnz-dukes:dukes-5.11:2026-07-30T00:00:00.000Z";
    const built = buildAssetDirectory({
      assets: [asset({ asset_id: "ast_aaaaaaaaaaaaaaaa", name: "London Plant", technology: "ccgt" })],
      projects: [
        {
          project_id: "prj_aaaaaaaaaaaaaaaa",
          asset_id: "ast_aaaaaaaaaaaaaaaa",
          name: "London Plant",
          source_id: "desnz-dukes",
          external_ref: "CCGT-1",
        },
      ],
      capacity: [
        {
          capacity_record_id: "cap_aaaaaaaaaaaaaaaa",
          asset_id: "ast_aaaaaaaaaaaaaaaa",
          project_id: "prj_aaaaaaaaaaaaaaaa",
          source_id: "desnz-dukes",
          source_release_id: olderRelease,
          mw: 200,
          counts: true,
        },
        {
          capacity_record_id: "cap_aaaaaaaaaaaaaaab",
          asset_id: "ast_aaaaaaaaaaaaaaaa",
          project_id: "prj_aaaaaaaaaaaaaaaa",
          source_id: "desnz-dukes",
          source_release_id: newerRelease,
          mw: 110,
          counts: true,
        },
      ],
      matches: [],
      parties: [{ source_id: "desnz-dukes", external_ref: "CCGT-1", operator: "RWE", region: "London", county: null }],
      releases: [
        {
          catalogue_schema_version: 1,
          source_release_id: olderRelease,
          dataset_id: "desnz-dukes:dukes-5.11",
          published_at: "2026-04-01T00:00:00.000Z",
          content_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          content: { edition: "April 2026" },
        },
        {
          catalogue_schema_version: 1,
          source_release_id: newerRelease,
          dataset_id: "desnz-dukes:dukes-5.11",
          published_at: "2026-07-30T00:00:00.000Z",
          content_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          content: { edition: "May 2026" },
        },
      ] as SourceRelease[],
      dnoFeatures: [],
    });
    const london = built.details.get("ast_aaaaaaaaaaaaaaaa");
    expect(london?.row.mw).toBe(110);
    expect(london?.capacity.map((record) => record.mw)).toEqual([200, 110]);
  });
});

describe("party extracts", () => {
  it("reads REPD operators and DUKES companies", () => {
    const csv = [
      "Ref ID,Operator (or Applicant),Site Name,Region,County",
      "42,Octopus Energy,Farm,Wales,Pembrokeshire",
      ",Missing,Skip,Wales,Pembrokeshire",
    ].join("\n");
    expect(partiesFromRepdCsv(csv)).toEqual([
      { sourceId: "desnz-repd", externalRef: "42", operator: "Octopus Energy", region: "Wales", county: "Pembrokeshire" },
    ]);
    expect(
      partiesFromDukesRows([
        ["notes"],
        ["Company Name", "Site Name", "Region", "DESNZ site code"],
        ["EDF Energy", "Sizewell B", "East of England", "NUC-1"],
      ]),
    ).toEqual([
      { sourceId: "desnz-dukes", externalRef: "NUC-1", operator: "EDF Energy", region: "East of England", county: null },
    ]);
  });
});

describe("map copy", () => {
  it("uses the coverage sentence and precision tags without the word live", () => {
    expect(MAP_COVERAGE_COPY).toBe("The map shows Great Britain. Each layer lists its own coverage.");
    expect(containsLiveWord(MAP_COVERAGE_COPY)).toBe(false);
    expect(precisionLabel("published_approximate")).toBe("Published, approximate");
    expect(precisionLabel("surveyed")).toBe("Surveyed");
    expect(precisionLabel("geocoded_approximate")).toBe("Geocoded, approximate");
    expect(precisionLabel("schematic")).toBe("Schematic");
    expect(formatMw(12.5)).toBe("12.5 MW");
    expect(formatMw(null)).toBe("—");
  });
});
