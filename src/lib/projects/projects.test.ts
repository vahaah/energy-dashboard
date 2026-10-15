import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET as cronTec } from "@/app/api/cron-tec/route";
import { GET as projectsApi, PROJECTS_PAGE_DEFAULT, PROJECTS_PAGE_MAX } from "@/app/api/v1/projects/route";
import { checkProjectFiles } from "@/lib/projects/check";
import {
  CONNECTION_CAPACITY,
  CONNECTION_DUPLICATE_WARNING,
  PROJECT_EXPECTATION_CHANGE,
  PROJECT_PROFILE_STANDFIRST,
  PROJECTS_H1,
  PROJECTS_STANDFIRST,
  PROJECTS_TITLE,
  RATED_POWER,
  STORAGE_ENERGY,
  projectProfileH1,
  projectProfileTitle,
} from "@/lib/projects/copy";
import { diffAgainstPrevious, diffProjectSnapshots, serialiseChangeEvents, type ProjectSnapshotRow } from "@/lib/projects/diff";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { applyProjectMerges, emptyMerges } from "@/lib/projects/merge";
import { resolveProjectRoute } from "@/lib/projects/route";
import type { EnergyProject, MergeDecision, ProjectMerges } from "@/lib/projects/schema";
import type { SourceProject } from "@/lib/projects/source";
import { deriveDisplayStage } from "@/lib/projects/status";
import { parseTecProjects } from "@/lib/projects/tec";
import { parseRepdProjects } from "@/lib/projects/repd";
import {
  connectionCapacity,
  operatingRatedPower,
  operatingTechnologyShares,
  proposedRatedPower,
  storageEnergy,
} from "@/lib/projects/totals";
import { TEC_NESO_REQUESTS_PER_RUN, TEC_RUNS_PER_WEEK, TEC_TINYBIRD_OPS } from "@/lib/projects/budget";

const OBSERVED = "2026-10-15T12:00:00.000Z";

function source(patch: Partial<SourceProject> & Pick<SourceProject, "source_id" | "external_ref" | "name">): SourceProject {
  return {
    technology: "onshore_wind",
    country: "Scotland",
    planning_status: "granted",
    planning_decision_date: "2024-01-02",
    planning_source_id: patch.source_id,
    planning_release_id: "release-a",
    construction_status: "not_started",
    construction_evidence_date: null,
    construction_source_id: patch.source_id,
    construction_release_id: "release-a",
    connection_stage: "unknown",
    connection_gate: "unknown",
    agreement_status: "unknown",
    expected_energisation: null,
    connection_source_id: null,
    connection_release_id: null,
    operational_status: "proposed",
    commissioning_date: null,
    closure_date: null,
    operational_source_id: patch.source_id,
    operational_release_id: "release-a",
    power_mw: 10,
    connection_capacity_mw: null,
    storage_energy_mwh: null,
    ...patch,
  };
}

function snapshot(patch: Partial<ProjectSnapshotRow> & Pick<ProjectSnapshotRow, "entity" | "release_id">): ProjectSnapshotRow {
  return {
    planning_status: "granted",
    planning_decision_date: "2024-01-02",
    construction_status: "not_started",
    construction_evidence_date: null,
    connection_stage: "4",
    connection_gate: "gate_2",
    agreement_status: "held",
    expected_energisation: "2027-01-01",
    operational_status: "proposed",
    commissioning_date: null,
    closure_date: null,
    power_mw: 10,
    connection_capacity_mw: 12,
    storage_energy_mwh: null,
    ...patch,
  };
}

function merges(unlinks: MergeDecision[]): ProjectMerges {
  return { catalogue_schema_version: 1, links: [], unlinks };
}

describe("project status", () => {
  it("keeps unknown planning distinct from refused", () => {
    expect(
      deriveDisplayStage({
        planning_status: "unknown",
        construction_status: "unknown",
        operational_status: "unknown",
      }),
    ).toBe("unknown");
    expect(
      deriveDisplayStage({
        planning_status: "unknown",
        construction_status: "built",
        operational_status: "operational",
      }),
    ).toBe("operational");
    expect(
      deriveDisplayStage({
        planning_status: "refused",
        construction_status: "unknown",
        operational_status: "unknown",
      }),
    ).toBe("planning_refused");
    expect(
      deriveDisplayStage({
        planning_status: "unknown",
        construction_status: "under_construction",
        operational_status: "proposed",
      }),
    ).toBe("under_construction");
  });
});

describe("project totals", () => {
  const rows = [
    { operational_status: "operational" as const, power_mw: 10.04, technology: "solar_pv" as const, display_stage: "operational" as const, connection_capacity_mw: 8, storage_energy_mwh: null },
    { operational_status: "operational" as const, power_mw: 0.06, technology: "solar_pv" as const, display_stage: "operational" as const, connection_capacity_mw: null, storage_energy_mwh: null },
    { operational_status: "operational" as const, power_mw: null, technology: "onshore_wind" as const, display_stage: "operational" as const, connection_capacity_mw: 3, storage_energy_mwh: null },
    { operational_status: "proposed" as const, power_mw: 500, technology: "offshore_wind" as const, display_stage: "proposed" as const, connection_capacity_mw: 400, storage_energy_mwh: 20 },
    { operational_status: "commissioning" as const, power_mw: 40, technology: "battery" as const, display_stage: "under_construction" as const, connection_capacity_mw: 40, storage_energy_mwh: null },
    { operational_status: "closed" as const, power_mw: 7, technology: "hydro" as const, display_stage: "closed" as const, connection_capacity_mw: null, storage_energy_mwh: null },
  ];

  it("leaves proposed projects out of the operating total and keeps the three measures apart", () => {
    const operating = operatingRatedPower(rows);
    const proposed = proposedRatedPower(rows);
    expect(operating.total).toBeCloseTo(10.1, 5);
    expect(operating.omitted).toBe(1);
    expect(proposed.total).toBe(500);
    expect(operating.total).toBeLessThan(proposed.total);
    expect(connectionCapacity(rows).total).toBe(451);
    expect(storageEnergy(rows)?.total).toBe(20);
    const shares = operatingTechnologyShares(rows);
    const shown = shares.reduce((sum, share) => sum + share.mw, 0);
    expect(shown).toBeCloseTo(Number(operating.totalLabel), 5);
    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
  });
});

describe("project merges", () => {
  const repd = source({
    source_id: "desnz-repd",
    external_ref: "100",
    name: "Hadyard Hill Wind Farm",
    power_mw: 120,
    connection_capacity_mw: null,
    storage_energy_mwh: null,
  });
  const tec = source({
    source_id: "neso-open-data",
    external_ref: "TEC-1",
    name: "Hadyard Hill Wind Farm",
    country: null,
    power_mw: null,
    connection_capacity_mw: 99.9,
    connection_stage: "4",
    connection_gate: "gate_2",
    agreement_status: "connected",
    expected_energisation: "2028-03-01",
    connection_source_id: "neso-open-data",
    connection_release_id: "tec-release",
    planning_status: "application_submitted",
    planning_decision_date: null,
    planning_release_id: "tec-release",
    construction_status: "built",
    construction_evidence_date: "2025-01-01",
    construction_release_id: "tec-release",
    operational_status: "operational",
    commissioning_date: "2019-06-01",
    operational_source_id: "neso-open-data",
    operational_release_id: "tec-release",
  });

  it("merges on a unique name and unmerge puts the two registers back", () => {
    const linked = applyProjectMerges([repd], [tec], emptyMerges());
    expect(linked).toHaveLength(1);
    const project = linked[0];
    expect(project?.members).toEqual([
      { source_id: "desnz-repd", external_ref: "100" },
      { source_id: "neso-open-data", external_ref: "TEC-1" },
    ]);
    expect(project?.power_mw).toBe(120);
    expect(project?.connection_capacity_mw).toBe(99.9);
    expect(project?.storage_energy_mwh).toBeNull();
    expect(project?.planning_status).toBe("granted");
    expect(project?.planning_source_id).toBe("desnz-repd");
    expect(project?.construction_status).toBe("built");
    expect(project?.construction_source_id).toBe("neso-open-data");
    expect(project?.construction_evidence_date).toBe("2025-01-01");
    expect(project?.operational_status).toBe("operational");
    expect(project?.operational_source_id).toBe("neso-open-data");
    expect(project?.operational_release_id).toBe("tec-release");
    expect(project?.commissioning_date).toBe("2019-06-01");
    expect(project?.display_stage).toBe("operational");

    const unlink: MergeDecision = {
      repd_ref: "100",
      tec_project_id: "TEC-1",
      method: "unique_name",
      note: "Separated after review.",
    };
    const split = applyProjectMerges([repd], [tec], merges([unlink]));
    expect(split).toHaveLength(2);
    expect(split.every((row) => row.members.length === 1)).toBe(true);
    expect(split.map((row) => row.members[0]?.external_ref).sort()).toEqual(["100", "TEC-1"]);
    expect(split.every((row) => row.project_id !== project?.project_id)).toBe(true);
    const again = applyProjectMerges([repd], [tec], merges([unlink]));
    expect(again.map((row) => row.project_id)).toEqual(split.map((row) => row.project_id));
  });
});

describe("project diffs", () => {
  const older = [
    snapshot({ entity: "epj_b", release_id: "rel-old" }),
    snapshot({ entity: "epj_a", release_id: "rel-old" }),
  ];
  const newer = [
    snapshot({
      entity: "epj_a",
      release_id: "rel-new",
      expected_energisation: "2028-06-01",
      power_mw: 11,
    }),
    snapshot({ entity: "epj_c", release_id: "rel-new", operational_status: "operational" }),
  ];

  it("is deterministic and records a disappearance as not_in_release", () => {
    const first = diffProjectSnapshots(older, newer, OBSERVED);
    const second = diffProjectSnapshots([...older].reverse(), [...newer].reverse(), OBSERVED);
    expect(serialiseChangeEvents(first, OBSERVED)).toBe(serialiseChangeEvents(second, OBSERVED));
    expect(JSON.stringify(first)).not.toContain("cancelled");
    const removed = diffAgainstPrevious(
      [{ project_id: "epj_b" } as EnergyProject],
      [],
      "rel-new",
      OBSERVED,
    );
    expect(removed[0]?.comparison).toBe("not_in_release");
    expect(diffAgainstPrevious(null, [], "rel-new", OBSERVED)).toEqual([]);
    expect(first.map((event) => [event.entity, event.field, event.comparison, event.effective_at])).toEqual([
      ["epj_a", "expected_energisation", "field", "2028-06-01"],
      ["epj_a", "power_mw", "field", null],
      ["epj_b", "entity", "not_in_release", null],
      ["epj_c", "entity", "field", null],
    ]);
    const gone = first.find((event) => event.entity === "epj_b");
    expect(gone?.old).toBe("proposed");
    expect(gone?.new).toBeNull();
    expect(gone?.old_release_id).toBe("rel-old");
    expect(gone?.new_release_id).toBe("rel-old");
  });
});

describe("project parsers", () => {
  it("drops Northern Ireland and keeps a GB planning status", () => {
    const header = [
      "Ref ID",
      "Site Name",
      "Technology Type",
      "Installed Capacity (MWelec)",
      "Development Status (short)",
      "Country",
      "Planning Application Submitted",
      "Planning Application Withdrawn",
      "Planning Permission Refused",
      "Appeal Lodged",
      "Appeal Withdrawn",
      "Appeal Refused",
      "Appeal Granted",
      "Planning Permission  Granted",
      "Secretary of State - Refusal",
      "Secretary of State - Granted",
      "Planning Permission Expired",
      "Under Construction",
      "Operational",
    ];
    const row = (cells: string[]) => cells.join(",");
    const csv = [
      header.join(","),
      row(["1", "English Farm", "Solar Photovoltaics", "5", "Operational", "England", "", "", "", "", "", "", "", "01/02/2020", "", "", "", "", "03/04/2021"]),
      row(["2", "Ulster Farm", "Solar Photovoltaics", "5", "Operational", "Northern Ireland", "", "", "", "", "", "", "", "01/02/2020", "", "", "", "", "03/04/2021"]),
    ].join("\n");
    const parsed = parseRepdProjects(csv);
    expect(parsed.map((item) => item.external_ref)).toEqual(["1"]);
    expect(parsed[0]?.planning_status).toBe("granted");
    expect(parsed[0]?.operational_status).toBe("operational");
    expect(parsed[0]?.commissioning_date).toBe("2021-04-03");
    expect(parsed[0]?.country).toBe("England");
  });

  it("collapses TEC stages and quarantines an unknown status", () => {
    const header =
      "Project Name,Customer Name,Connection Site,Stage,MW Connected,MW Increase / Decrease,Cumulative Total Capacity (MW),MW Effective From,Project Status,Agreement Type,HOST TO,Plant Type,Project ID,Project Number,Gate";
    const csv = [
      header,
      "Alpha Wind,Owner,Site,1,0,10,10,2027-01-01,Scoping,Embedded,NGET,Wind Onshore,P1,PRO-1,1",
      "Alpha Wind,Owner,Site,4,10,20,30,2028-06-01,Built,Direct Connection,NGET,Wind Onshore,P1,PRO-1,2",
    ].join("\n");
    const parsed = parseTecProjects(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.connection_stage).toBe("4");
    expect(parsed.rows[0]?.connection_gate).toBe("gate_2");
    expect(parsed.rows[0]?.connection_capacity_mw).toBe(30);
    expect(parsed.rows[0]?.operational_status).toBe("operational");
    expect(parsed.rows[0]?.power_mw).toBeNull();
    expect(parsed.rows[0]?.expected_energisation).toBe("2027-01-01");
    const bad = parseTecProjects(`${header}\nAlpha,Owner,Site,1,0,10,10,2027-01-01,Mystery,Embedded,NGET,Wind Onshore,P1,PRO-1,1\n`);
    expect(bad.ok).toBe(false);
    const blank = parseTecProjects(`${header}\nAlpha,Owner,Site,1,0,10,10,,Built,Direct Connection,NGET,Wind Onshore,P1,PRO-1,1\n`);
    expect(blank.ok).toBe(true);
    const malformed = parseTecProjects(`${header}\nAlpha,Owner,Site,1,0,10,10,13/10/2026,Built,Direct Connection,NGET,Wind Onshore,P1,PRO-1,1\n`);
    expect(malformed.ok).toBe(false);
    const impossible = parseTecProjects(`${header}\nAlpha,Owner,Site,1,0,10,10,2026-02-31,Built,Direct Connection,NGET,Wind Onshore,P1,PRO-1,1\n`);
    expect(impossible.ok).toBe(false);
    const later = parseTecProjects(csv, {
      publishedAt: "2028-07-01T00:00:00.000Z",
      releaseId: "neso-open-data:tec-register:2028-07-01T00:00:00.000Z",
    });
    expect(later.ok).toBe(true);
    if (later.ok) {
      expect(later.rows[0]?.connection_release_id).toBe("neso-open-data:tec-register:2028-07-01T00:00:00.000Z");
      expect(later.rows[0]?.operational_release_id).toBe("neso-open-data:tec-register:2028-07-01T00:00:00.000Z");
      expect(later.rows[0]?.expected_energisation).toBe("2028-06-01");
    }
  });
});

describe("checked-in project register", () => {
  const catalogue = loadProjectCatalogue();

  it("passes publish-check rules and excludes proposed power from the operating total", () => {
    expect(checkProjectFiles(join(process.cwd(), "data/catalogue"), { required: true })).toEqual([]);
    const operating = operatingRatedPower(catalogue.projects);
    const proposed = proposedRatedPower(catalogue.projects);
    expect(proposed.total).toBeGreaterThan(0);
    const operatingOnly = catalogue.projects
      .filter((project) => project.operational_status === "operational" && project.power_mw !== null)
      .reduce((sum, project) => sum + (project.power_mw ?? 0), 0);
    expect(operating.total).toBeCloseTo(operatingOnly, 5);
    expect(operating.total).toBeLessThan(operating.total + proposed.total);
    const shares = operatingTechnologyShares(catalogue.projects);
    expect(shares.reduce((sum, share) => sum + share.mw, 0)).toBeCloseTo(Number(operating.totalLabel), 5);
    expect(storageEnergy(catalogue.projects)).toBeNull();
    const hadyard = catalogue.projects.find((project) => project.project_id === "epj_00d87244c2fdb198");
    expect(hadyard?.power_mw).toBe(120);
    expect(hadyard?.connection_capacity_mw).toBe(99.9);
    expect(hadyard?.members).toHaveLength(2);
    expect(JSON.stringify(catalogue.changes)).not.toContain("cancelled");
  });

  it("uses the quoted page copy", () => {
    expect(PROJECTS_TITLE).toBe("Energy projects in Britain | Grid");
    expect(PROJECTS_H1).toBe("What is being built, and how far has it got?");
    expect(PROJECTS_STANDFIRST).toBe(
      "Projects from public registers, with planning, construction and connection status shown separately.",
    );
    expect(projectProfileTitle("Hadyard Hill")).toBe("Hadyard Hill | Grid");
    expect(projectProfileH1("Hadyard Hill")).toBe("Where is Hadyard Hill up to?");
    expect(PROJECT_PROFILE_STANDFIRST).toBe("Each status below comes from a named source and date.");
    expect(PROJECT_EXPECTATION_CHANGE).toBe(
      "This is a change in the published expectation, not a confirmed commissioning date.",
    );
    expect(RATED_POWER).toBe("Rated power");
    expect(CONNECTION_CAPACITY).toBe("Connection capacity");
    expect(STORAGE_ENERGY).toBe("Storage energy");
    expect(CONNECTION_DUPLICATE_WARNING).toContain("duplicate entries");
  });

  it("resolves the canonical slug and rejects an unknown id", () => {
    const identity = { project_id: "epj_00d87244c2fdb198", name: "Hadyard Hill" };
    expect(resolveProjectRoute(identity.project_id, undefined, [identity])).toEqual({
      status: 308,
      location: "/projects/epj_00d87244c2fdb198/hadyard-hill",
    });
    expect(resolveProjectRoute(identity.project_id, "wrong", [identity])).toEqual({
      status: 308,
      location: "/projects/epj_00d87244c2fdb198/hadyard-hill",
    });
    expect(resolveProjectRoute(identity.project_id, "hadyard-hill", [identity])).toEqual({
      status: 200,
      location: "/projects/epj_00d87244c2fdb198/hadyard-hill",
    });
    expect(resolveProjectRoute("epj_missing", "hadyard-hill", [identity])).toEqual({ status: 404 });
  });
});

describe("projects API and TEC cron", () => {
  it("rejects an unknown filter and returns one display stage", async () => {
    const bad = await projectsApi(new Request("http://localhost/api/v1/projects?display_stage=cancelled"));
    expect(bad.status).toBe(400);
    const extra = await projectsApi(new Request("http://localhost/api/v1/projects?fuel=wind"));
    expect(extra.status).toBe(400);
    const response = await projectsApi(new Request("http://localhost/api/v1/projects?display_stage=operational"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      total: number;
      limit: number;
      offset: number;
      projects: Array<EnergyProject & { display_stage: string }>;
    };
    expect(body.limit).toBe(PROJECTS_PAGE_DEFAULT);
    expect(body.offset).toBe(0);
    expect(body.projects.length).toBeGreaterThan(0);
    expect(body.projects.length).toBeLessThanOrEqual(PROJECTS_PAGE_DEFAULT);
    expect(body.total).toBeGreaterThanOrEqual(body.projects.length);
    expect(body.projects.every((project) => project.display_stage === "operational")).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(4_500_000);
    const page = await projectsApi(new Request("http://localhost/api/v1/projects?limit=1&offset=1"));
    const paged = (await page.json()) as { total: number; limit: number; offset: number; projects: unknown[] };
    expect(page.status).toBe(200);
    expect(paged.limit).toBe(1);
    expect(paged.offset).toBe(1);
    expect(paged.projects).toHaveLength(1);
    expect(paged.total).toBeGreaterThan(1);
    const tooWide = await projectsApi(new Request(`http://localhost/api/v1/projects?limit=${PROJECTS_PAGE_MAX + 1}`));
    expect(tooWide.status).toBe(400);
    const badOffset = await projectsApi(new Request("http://localhost/api/v1/projects?offset=-1"));
    expect(badOffset.status).toBe(400);
    expect(JSON.stringify(body)).not.toContain("cancelled");
  });

  it("adds no Tinybird ops and the route does not fetch NESO", () => {
    expect(TEC_TINYBIRD_OPS).toBe(0);
    expect(TEC_RUNS_PER_WEEK).toBe(2);
    expect(TEC_NESO_REQUESTS_PER_RUN).toBe(2);
    const publish = readFileSync(join(process.cwd(), "src/lib/projects/publish.ts"), "utf8");
    expect(publish).toContain("publishedAt: meta.issued_at");
    const route = readFileSync(join(process.cwd(), "src/app/api/cron-tec/route.ts"), "utf8");
    expect(route).not.toContain("api.neso.energy");
    expect(route).not.toContain("queryPipe");
    expect(route).toContain("start(tecRegister");
    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons.find((job) => job.path === "/api/cron-tec")?.schedule).toBe("15 6 * * 1,4");
    const docs = readFileSync(join(process.cwd(), "src/app/api/page.tsx"), "utf8");
    expect(docs).toContain("/api/v1/projects?limit=100&offset=0");
    expect(docs).toContain("cannot exceed 500");
    const page = readFileSync(join(process.cwd(), "src/app/projects/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).not.toContain("queryPipe");
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain("export const revalidate = 300");
  });

  it("fails closed without the cron secret", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-test-secret";
    const denied = await cronTec(new Request("http://localhost/api/cron-tec"));
    expect(denied.status).toBe(401);
    if (previous === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previous;
    }
  });
});
