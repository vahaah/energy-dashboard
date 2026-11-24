import { describe, expect, it } from "vitest";
import { projectUrlQuery, typedQueryForUrl } from "@/lib/projects/url-query";

describe("project URL query", () => {
  it("keeps a typed filter until the URL query changes", () => {
    expect(typedQueryForUrl("solar", "", "")).toBe("solar");
    expect(typedQueryForUrl("solar", "", "eurocell nickel")).toBeNull();
    expect(typedQueryForUrl("solar", "eurocell nickel", "eurocell nickel")).toBe("solar");
  });

  it("caps the URL query at the rows API limit", () => {
    expect(projectUrlQuery(null)).toBe("");
    expect(projectUrlQuery("  eurocell nickel  ")).toBe("eurocell nickel");
    expect(projectUrlQuery("a".repeat(90))).toHaveLength(80);
  });
});
