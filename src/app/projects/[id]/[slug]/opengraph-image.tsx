import { notFound } from "next/navigation";
import { NESO_OPEN_DATA_ATTRIBUTION, OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { formatEnergy } from "@/lib/format/quantity";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";
import { displayProjectName } from "@/lib/projects/copy";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { displayStageLabel } from "@/lib/projects/status";
import { technologyLabel } from "@/lib/projects/technology";

export const revalidate = 86_400;
export const alt = "Energy project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

function capacityLabel(mw: number | null): string | null {
  if (mw == null || !Number.isFinite(mw) || mw <= 0) {
    return null;
  }
  const energy = formatEnergy(mw);
  return `${energy.value} ${energy.unit}`;
}

export default async function ProjectOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;
  const project = loadProjectCatalogue().byId.get(id);
  if (!project) {
    notFound();
  }
  const neso = project.members.some((member) => member.source_id === "neso-open-data");
  const repd = project.members.some((member) => member.source_id === "desnz-repd");
  const source = [repd ? OGL_V3_ATTRIBUTION : "", neso ? NESO_OPEN_DATA_ATTRIBUTION : ""].filter(Boolean).join(" ");
  return renderOgImageResponse(
    {
      kind: "project",
      title: displayProjectName(project.name),
      technology: technologyLabel(project.technology),
      capacity: capacityLabel(project.power_mw),
      status: displayStageLabel(project.display_stage),
      region: project.region?.trim() || project.country,
      source: source || OGL_V3_ATTRIBUTION,
    },
    snapshot,
  );
}
