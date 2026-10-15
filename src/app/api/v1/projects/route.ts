import { NextResponse } from "next/server";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { projectIndexRow } from "@/lib/projects/page-model";
import { isDisplayStage } from "@/lib/projects/status";

/**
 * GET /api/v1/projects?display_stage=&limit=&offset=
 *
 * Checked-in project register. No Tinybird query.
 * An unknown filter is 400. Each response is one page.
 */

export const dynamic = "force-dynamic";

export const PROJECTS_PAGE_DEFAULT = 100;
export const PROJECTS_PAGE_MAX = 500;
const OFFSET_MAX = 1_000_000;

const ALLOWED = new Set(["display_stage", "limit", "offset"]);

function bound(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null) {
    return fallback;
  }
  if (!/^\d{1,7}$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!ALLOWED.has(key)) {
      return NextResponse.json({ error: "unsupported filter" }, { status: 400 });
    }
  }
  const stage = params.get("display_stage");
  if (stage !== null && !isDisplayStage(stage)) {
    return NextResponse.json({ error: "unsupported filter" }, { status: 400 });
  }
  const limit = bound(params.get("limit"), PROJECTS_PAGE_DEFAULT, 1, PROJECTS_PAGE_MAX);
  const offset = bound(params.get("offset"), 0, 0, OFFSET_MAX);
  if (limit === null || offset === null) {
    return NextResponse.json({ error: "unsupported filter" }, { status: 400 });
  }
  const matched = loadProjectCatalogue().projects.filter((project) => stage === null || project.display_stage === stage);
  const projects = matched.slice(offset, offset + limit);
  return NextResponse.json({
    total: matched.length,
    limit,
    offset,
    projects: projects.map((project) => ({
      ...projectIndexRow(project),
      display_stage: project.display_stage,
      planning_status: project.planning_status,
      construction_status: project.construction_status,
      connection_gate: project.connection_gate,
      agreement_status: project.agreement_status,
      operational_status: project.operational_status,
      power_mw: project.power_mw,
      connection_capacity_mw: project.connection_capacity_mw,
      storage_energy_mwh: project.storage_energy_mwh,
    })),
  });
}
