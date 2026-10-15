import { notFound } from "next/navigation";
import { NESO_OPEN_DATA_ATTRIBUTION, OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { technologyLabel } from "@/lib/projects/technology";

export const revalidate = 86_400;
export const alt = "Energy project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

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
      kind: "asset",
      title: project.name,
      kicker: technologyLabel(project.technology),
      source: source || OGL_V3_ATTRIBUTION,
    },
    snapshot,
  );
}
