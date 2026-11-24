import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { projectPlace } from "@/lib/projects/page-model";
import { projectSlug } from "@/lib/projects/href";
import { displayStageLabel } from "@/lib/projects/status";
import { technologyLabel } from "@/lib/projects/technology";
import { containsLiveWord } from "@/lib/assets/labels";
import { SHIPPED_PAGE_ROUTES } from "@/lib/site-nav";
import {
  decodeProjectIndex,
  encodeProjectIndex,
  loadProjectSearchIndex,
  projectSearchHref,
  resetProjectSearchIndexCache,
  searchProjects,
  type ProjectSearchRow,
} from "@/lib/search/project-index";
import { projectSlug as searchSlug } from "@/lib/search/project-href";
import { SEARCH_TASKS, searchTasks } from "@/lib/search/tasks";

const eurocell: ProjectSearchRow = {
  id: "epj_3415e2e58a0ec470",
  name: "Eurocell Nickel, High View Road - Solar Pv System",
  technology: "Solar PV",
  stage: "In planning",
  place: "England, East Midlands",
  mw: 0.6,
};

describe("header search", () => {
  it("finds a planning project by name and keeps the slug in one place", () => {
    expect(searchSlug("Eurocell & Nickel")).toBe(projectSlug("Eurocell & Nickel"));
    const hits = searchProjects([eurocell], "eurocell nickel", 5);
    expect(hits.map((row) => row.id)).toEqual([eurocell.id]);
    expect(projectSearchHref(eurocell)).toBe(
      "/projects/epj_3415e2e58a0ec470/eurocell-nickel-high-view-road-solar-pv-system",
    );
    expect(searchProjects([eurocell], "price cap", 5)).toEqual([]);
  });

  it("offers the key pages, including an empty query", () => {
    expect(searchTasks("").map((task) => task.id)).toEqual(SEARCH_TASKS.map((task) => task.id));
    expect(searchTasks("price cap").map((task) => task.href)).toEqual(["/explained/price-cap"]);
    expect(searchTasks("wholesale price").map((task) => task.href)).toContain("/today");
    expect(searchTasks("balancing").map((task) => task.href)).toEqual(["/system/balancing"]);
    expect(searchTasks("ena").map((task) => task.href)).toEqual(["/tools"]);
    expect(searchTasks("pipeline").map((task) => task.href)).toEqual(["/pipeline"]);
    expect(searchTasks("directory").map((task) => task.href)).toContain("/directory");
    expect(searchTasks("data sources").map((task) => task.href)).toEqual(["/data-sources"]);
    expect(searchTasks("records").map((task) => task.href)).toEqual(["/records"]);
    expect(searchTasks("api").map((task) => task.href)).toEqual(["/api"]);
    for (const task of SEARCH_TASKS) {
      expect(SHIPPED_PAGE_ROUTES).toContain(task.href);
    }
  });

  it("round-trips a compact row and retries a failed fetch", async () => {
    const encoded = encodeProjectIndex([eurocell]);
    expect(decodeProjectIndex(JSON.parse(encoded))).toEqual([eurocell]);
    resetProjectSearchIndexCache();
    let calls = 0;
    const fetchIndex = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("no", { status: 500 });
      }
      return new Response(encoded, { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    await expect(loadProjectSearchIndex(fetchIndex)).resolves.toEqual([eurocell]);
    await expect(loadProjectSearchIndex(fetchIndex)).resolves.toEqual([eurocell]);
    expect(calls).toBe(2);
  });

  it("matches the checked-in project index and stays off the first paint", () => {
    const catalogue = loadProjectCatalogue().projects.map(
      (project): ProjectSearchRow => ({
        id: project.project_id,
        name: project.name,
        technology: technologyLabel(project.technology),
        stage: displayStageLabel(project.display_stage),
        place: project.country || project.region ? projectPlace(project.country, project.region) : "",
        mw: project.power_mw,
      }),
    );
    const file = readFileSync(resolve(process.cwd(), "public/search/projects.json"), "utf8");
    expect(file).toBe(encodeProjectIndex(catalogue));
    const decoded = decodeProjectIndex(JSON.parse(file));
    expect(searchProjects(decoded, "eurocell nickel", 1)[0]?.name).toContain("Eurocell Nickel");
    const button = readFileSync(resolve(process.cwd(), "src/components/asset-search.tsx"), "utf8");
    const dialog = readFileSync(resolve(process.cwd(), "src/components/asset-search-dialog.tsx"), "utf8");
    expect(button).toContain('import("@/components/asset-search-dialog")');
    expect(button).not.toContain('from "@/lib/search/project-index"');
    expect(button).not.toContain('from "@/lib/projects/');
    expect(dialog).not.toContain('from "@/lib/projects/');
    expect(containsLiveWord(button)).toBe(false);
    expect(containsLiveWord(dialog)).toBe(false);
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
  });
});
