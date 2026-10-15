import { NextResponse } from "next/server";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { projectIndexRow } from "@/lib/projects/page-model";
import { isDisplayStage } from "@/lib/projects/status";

/**
 * GET /api/v1/projects?display_stage=
 *
 * Checked-in project register. No Tinybird query.
 * An unknown filter is 400.
 */

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["display_stage"]);

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
  const projects = loadProjectCatalogue().projects.filter((project) => stage === null || project.display_stage === stage);
  return NextResponse.json({
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
