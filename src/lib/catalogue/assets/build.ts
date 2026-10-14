import { stableId } from "@/lib/catalogue/assets/ids";
import { matchStations } from "@/lib/catalogue/assets/match";
import { osgbToWgs84 } from "@/lib/catalogue/assets/osgb";
import { roundMw } from "@/lib/catalogue/assets/parse";
import { DUKES_SOURCE_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";
import type {
  AssetRecord,
  AssetRegister,
  CapacityRecord,
  CatalogueStation,
  MappingRecord,
  MatchOverrides,
  ProjectRecord,
  ReleaseBinding,
} from "@/lib/catalogue/assets/types";

function pointOf(station: CatalogueStation): { latitude: number | null; longitude: number | null } {
  if (station.easting === null || station.northing === null) {
    return { latitude: null, longitude: null };
  }
  return osgbToWgs84(station.easting, station.northing) ?? { latitude: null, longitude: null };
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function countedMegawatts(records: readonly { mw: number; counts: boolean }[]): number {
  return records.reduce((sum, record) => sum + (record.counts ? record.mw : 0), 0);
}

export function buildAssetRegister(
  repd: readonly CatalogueStation[],
  dukes: readonly CatalogueStation[],
  overrides: MatchOverrides,
  releases: ReleaseBinding,
): AssetRegister {
  const matches = matchStations(repd, dukes, overrides).sort((left, right) =>
    compareId(left.match_id, right.match_id),
  );
  const matchByRepd = new Map<string, (typeof matches)[number]>();
  const matchByDukes = new Map<string, (typeof matches)[number]>();
  for (const match of matches) {
    for (const ref of match.repd_refs) {
      matchByRepd.set(ref, match);
    }
    for (const code of match.dukes_site_codes) {
      matchByDukes.set(code, match);
    }
  }
  const nameCounts = new Map<string, number>();
  for (const station of dukes) {
    const key = station.name.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const assets: AssetRecord[] = [];
  const projects: ProjectRecord[] = [];
  const capacity: CapacityRecord[] = [];
  const mappings: MappingRecord[] = [];

  function pushCapacity(
    source: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID,
    externalRef: string,
    assetId: string,
    projectId: string,
    releaseId: string,
    mw: number | null,
    counts: boolean,
  ): void {
    if (mw === null) {
      return;
    }
    capacity.push({
      capacity_record_id: stableId("cap", `${source}:${externalRef}:${releaseId}`),
      asset_id: assetId,
      project_id: projectId,
      source_id: source,
      source_release_id: releaseId,
      mw: roundMw(mw),
      counts,
    });
  }

  for (const station of repd) {
    const assetId = stableId("ast", `repd:${station.externalRef}`);
    const projectId = stableId("prj", `repd:${station.externalRef}`);
    const match = matchByRepd.get(station.externalRef);
    assets.push({
      asset_id: assetId,
      name: station.name,
      technology: station.technology,
      status: "operational",
      country: station.country,
      ...pointOf(station),
    });
    projects.push({
      project_id: projectId,
      asset_id: assetId,
      name: station.name,
      source_id: REPD_SOURCE_ID,
      external_ref: station.externalRef,
    });
    mappings.push({ scheme: "REPD_REF", source_entity_id: station.externalRef, asset_id: assetId });
    pushCapacity(
      REPD_SOURCE_ID,
      station.externalRef,
      assetId,
      projectId,
      releases.repd,
      station.mw,
      !match || match.counts_source === REPD_SOURCE_ID,
    );
  }

  for (const station of dukes) {
    const match = matchByDukes.get(station.externalRef);
    const primaryRef = match?.repd_refs[0];
    const assetId = primaryRef
      ? stableId("ast", `repd:${primaryRef}`)
      : stableId("ast", `dukes:${station.externalRef}`);
    const projectId = stableId("prj", `dukes:${station.externalRef}`);
    if (!primaryRef) {
      assets.push({
        asset_id: assetId,
        name: station.name,
        technology: station.technology,
        status: "operational",
        country: station.country,
        ...pointOf(station),
      });
    }
    projects.push({
      project_id: projectId,
      asset_id: assetId,
      name: station.name,
      source_id: DUKES_SOURCE_ID,
      external_ref: station.externalRef,
    });
    const entityId =
      (nameCounts.get(station.name.toLowerCase()) ?? 0) > 1
        ? `${station.name}|${station.externalRef}`
        : station.name;
    mappings.push({ scheme: "DUKES_NAME", source_entity_id: entityId, asset_id: assetId });
    pushCapacity(
      DUKES_SOURCE_ID,
      station.externalRef,
      assetId,
      projectId,
      releases.dukes,
      station.mw,
      !match || match.counts_source === DUKES_SOURCE_ID,
    );
  }

  assets.sort((left, right) => compareId(left.asset_id, right.asset_id));
  projects.sort((left, right) => compareId(left.project_id, right.project_id));
  capacity.sort((left, right) => compareId(left.capacity_record_id, right.capacity_record_id));
  mappings.sort(
    (left, right) =>
      compareId(left.scheme, right.scheme) || compareId(left.source_entity_id, right.source_entity_id),
  );
  return { assets, projects, capacity, mappings, matches };
}
