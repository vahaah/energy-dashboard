import type { AssetIndexRow } from "@/lib/assets/types";
import type { EnergyProject } from "@/lib/projects/schema";

/** A detail page is indexable when capacity, location and status are all published. */
export function assetDetailIndexable(row: Pick<AssetIndexRow, "mw" | "latitude" | "longitude" | "status">): boolean {
  return (
    row.status === "operational" &&
    row.mw != null &&
    Number.isFinite(row.mw) &&
    row.mw > 0 &&
    row.latitude != null &&
    row.longitude != null &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude) &&
    !(row.latitude === 0 && row.longitude === 0)
  );
}

export function projectDetailIndexable(
  project: Pick<EnergyProject, "power_mw" | "country" | "region" | "display_stage">,
): boolean {
  const located = project.country != null || (project.region != null && project.region.trim().length > 0);
  return (
    project.display_stage.length > 0 &&
    project.display_stage !== "unknown" &&
    project.power_mw != null &&
    Number.isFinite(project.power_mw) &&
    project.power_mw > 0 &&
    located
  );
}
