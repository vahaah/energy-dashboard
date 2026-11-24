import { describe, expect, it } from "vitest";
import { NOT_AN_MPAN_LOOKUP } from "@/lib/directory/copy";
import { directoryCodePreview, directoryOrganisationPreview, DIRECTORY_PREVIEW_ROWS } from "@/lib/directory/preview";
import { fixtureDirectorySnapshot } from "@/lib/directory/reader";

describe("directory preview", () => {
  it("server-renders a first page of organisations and codes", () => {
    const snapshot = fixtureDirectorySnapshot();
    const organisations = directoryOrganisationPreview(snapshot);
    const codes = directoryCodePreview(snapshot);
    expect(organisations.length).toBeGreaterThan(0);
    expect(organisations.length).toBeLessThanOrEqual(DIRECTORY_PREVIEW_ROWS);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.length).toBeLessThanOrEqual(DIRECTORY_PREVIEW_ROWS);
    expect(organisations.some((row) => row.name === "North Power Limited")).toBe(true);
    expect(organisations.some((row) => row.code === "NPOW")).toBe(true);
    expect(codes.some((row) => row.scheme === "BM Unit ID" && row.code === "T_ABCD-1")).toBe(true);
    expect(JSON.stringify(organisations)).not.toContain("11111111");
    expect(NOT_AN_MPAN_LOOKUP).toBe("This is not an MPAN or electricity meter serial lookup.");
  });
});
