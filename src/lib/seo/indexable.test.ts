import { describe, expect, it } from "vitest";
import { assetDetailIndexable, projectDetailIndexable } from "@/lib/seo/indexable";

describe("detail page indexing", () => {
  it("indexes an asset only with capacity, a coordinate and a status", () => {
    const located = { mw: 6.1, latitude: 51.5, longitude: -3.2, status: "operational" as const };
    expect(assetDetailIndexable(located)).toBe(true);
    expect(assetDetailIndexable({ ...located, mw: null })).toBe(false);
    expect(assetDetailIndexable({ ...located, latitude: null })).toBe(false);
    expect(assetDetailIndexable({ ...located, longitude: null })).toBe(false);
    expect(assetDetailIndexable({ ...located, latitude: 0, longitude: 0 })).toBe(false);
  });

  it("indexes a project only with capacity, a place and a status", () => {
    const located = { power_mw: 50, country: "Wales" as const, region: "South Wales", display_stage: "consented" as const };
    expect(projectDetailIndexable(located)).toBe(true);
    expect(projectDetailIndexable({ ...located, power_mw: null })).toBe(false);
    expect(projectDetailIndexable({ ...located, country: null, region: null })).toBe(false);
    expect(projectDetailIndexable({ ...located, country: null, region: "South Wales" })).toBe(true);
    expect(projectDetailIndexable({ ...located, display_stage: "unknown" })).toBe(false);
  });
});
