import { describe, expect, it } from "vitest";
import { partyReferenceErrors } from "@/lib/catalogue/assets/check";
import type { PartyRecord } from "@/lib/catalogue/assets/parties";
import type { ProjectRecord } from "@/lib/catalogue/assets/types";

function project(patch: Partial<ProjectRecord> & Pick<ProjectRecord, "project_id" | "external_ref">): ProjectRecord {
  return {
    asset_id: "ast_aaaaaaaaaaaaaaaa",
    name: "Plant",
    source_id: "desnz-repd",
    ...patch,
  };
}

function party(patch: Partial<PartyRecord> & Pick<PartyRecord, "external_ref">): PartyRecord {
  return {
    source_id: "desnz-repd",
    operator: "Operator",
    region: "London",
    county: null,
    ...patch,
  };
}

describe("asset party register", () => {
  it("requires a unique party row for each current project", () => {
    const projects = [project({ project_id: "prj_aaaaaaaaaaaaaaaa", external_ref: "42" })];
    const matching = party({ external_ref: "42" });
    expect(partyReferenceErrors(projects, [matching])).toEqual([]);
    expect(partyReferenceErrors(projects, [matching, matching])).toEqual(["duplicate party desnz-repd 42"]);
    expect(partyReferenceErrors(projects, [])).toEqual(["project prj_aaaaaaaaaaaaaaaa has no party"]);
    expect(partyReferenceErrors([], [party({ source_id: "desnz-dukes", external_ref: "NUC-9" })])).toEqual([
      "dangling party desnz-dukes NUC-9",
    ]);
  });
});