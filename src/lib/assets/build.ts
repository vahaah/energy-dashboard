import { roundMw } from "@/lib/catalogue/assets/parse";
import { partyKey, type PartyRecord } from "@/lib/catalogue/assets/parties";
import { currentCapacityRecords } from "@/lib/catalogue/assets/releases";
import type {
  AssetRecord,
  CapacityRecord,
  MatchRecord,
  ProjectRecord,
} from "@/lib/catalogue/assets/types";
import type { SourceRelease } from "@/lib/catalogue/schema";
import { areaAt, type GeoJsonFeature } from "@/lib/map/geojson";
import { sourceLabel } from "@/lib/assets/labels";
import { foldSearch } from "@/lib/assets/query";
import {
  UNLOCATED_REGION,
  type AssetCapacityView,
  type AssetDetail,
  type AssetIndexRow,
  type AssetMatchView,
  type AssetProjectView,
  type AssetSourceLabel,
  type MapPoint,
} from "@/lib/assets/types";

export type ReleaseMeta = {
  edition: string;
  publishedAt: string | null;
  downloadUrl: string | null;
};

export type BuiltDirectory = {
  rows: AssetIndexRow[];
  details: Map<string, AssetDetail>;
};

function releaseMeta(release: SourceRelease | undefined): ReleaseMeta {
  if (!release || typeof release.content !== "object" || release.content === null) {
    return { edition: "", publishedAt: null, downloadUrl: null };
  }
  const content = release.content as { edition?: unknown; published_at?: unknown; download_url?: unknown };
  return {
    edition: typeof content.edition === "string" ? content.edition : "",
    publishedAt: typeof content.published_at === "string" ? content.published_at : release.published_at,
    downloadUrl: typeof content.download_url === "string" ? content.download_url : null,
  };
}

function pushUnique(parts: string[], value: string | null): void {
  if (!value) {
    return;
  }
  if (parts.some((part) => part.toLowerCase() === value.toLowerCase())) {
    return;
  }
  parts.push(value);
}

function primarySource(
  capacity: readonly { source: AssetSourceLabel; counts: boolean; mw: number }[],
  present: readonly AssetSourceLabel[],
): AssetSourceLabel {
  const totals = new Map<AssetSourceLabel, number>();
  for (const record of capacity) {
    if (!record.counts) {
      continue;
    }
    totals.set(record.source, (totals.get(record.source) ?? 0) + record.mw);
  }
  const ranked = [...totals.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (ranked[0]) {
    return ranked[0][0];
  }
  const fallback = present.slice().sort((left, right) => left.localeCompare(right))[0];
  if (!fallback) {
    throw new Error("asset has no source");
  }
  return fallback;
}

export function mapPoints(rows: readonly AssetIndexRow[]): MapPoint[] {
  const points: MapPoint[] = [];
  for (const row of rows) {
    if (row.latitude === null || row.longitude === null) {
      continue;
    }
    points.push({
      id: row.id,
      name: row.name,
      technology: row.technology,
      mw: row.mw,
      region: row.region,
      longitude: row.longitude,
      latitude: row.latitude,
    });
  }
  return points;
}

export function buildAssetDirectory(input: {
  assets: readonly AssetRecord[];
  projects: readonly ProjectRecord[];
  capacity: readonly CapacityRecord[];
  matches: readonly MatchRecord[];
  parties: readonly PartyRecord[];
  releases: readonly SourceRelease[];
  dnoFeatures: readonly GeoJsonFeature[];
}): BuiltDirectory {
  const projectsByAsset = new Map<string, ProjectRecord[]>();
  for (const project of input.projects) {
    const list = projectsByAsset.get(project.asset_id) ?? [];
    list.push(project);
    projectsByAsset.set(project.asset_id, list);
  }
  const capacityByAsset = new Map<string, CapacityRecord[]>();
  for (const record of input.capacity) {
    const list = capacityByAsset.get(record.asset_id) ?? [];
    list.push(record);
    capacityByAsset.set(record.asset_id, list);
  }
  const partiesByKey = new Map<string, PartyRecord>();
  for (const party of input.parties) {
    partiesByKey.set(partyKey(party), party);
  }
  const matchesByKey = new Map<string, MatchRecord[]>();
  const addMatch = (key: string, match: MatchRecord) => {
    const list = matchesByKey.get(key) ?? [];
    list.push(match);
    matchesByKey.set(key, list);
  };
  for (const match of input.matches) {
    for (const ref of match.repd_refs) {
      addMatch(partyKey({ source_id: "desnz-repd", external_ref: ref }), match);
    }
    for (const code of match.dukes_site_codes) {
      addMatch(partyKey({ source_id: "desnz-dukes", external_ref: code }), match);
    }
  }
  const releasesById = new Map(input.releases.map((release) => [release.source_release_id, release]));
  const rows: AssetIndexRow[] = [];
  const details = new Map<string, AssetDetail>();

  for (const asset of input.assets) {
    const projects = (projectsByAsset.get(asset.asset_id) ?? []).slice().sort((left, right) =>
      left.project_id < right.project_id ? -1 : 1,
    );
    if (projects.length === 0) {
      throw new Error(`${asset.asset_id} has no project`);
    }
    const projectViews: AssetProjectView[] = projects.map((project) => {
      const party = partiesByKey.get(partyKey(project));
      return {
        projectId: project.project_id,
        name: project.name,
        source: sourceLabel(project.source_id),
        externalRef: project.external_ref,
        operator: party?.operator ?? "",
        region: party?.region ?? null,
        county: party?.county ?? null,
      };
    });
    const capacityRecords = capacityByAsset.get(asset.asset_id) ?? [];
    const headlineIds = new Set(
      currentCapacityRecords(capacityRecords, input.releases).map((record) => record.capacity_record_id),
    );
    const capacityViews: AssetCapacityView[] = capacityRecords
      .map((record) => {
        const meta = releaseMeta(releasesById.get(record.source_release_id));
        return {
          capacityId: record.capacity_record_id,
          source: sourceLabel(record.source_id),
          releaseId: record.source_release_id,
          edition: meta.edition,
          publishedAt: meta.publishedAt,
          downloadUrl: meta.downloadUrl,
          mw: record.mw,
          counts: record.counts,
        };
      })
      .sort((left, right) => {
        const leftTime = left.publishedAt ?? "";
        const rightTime = right.publishedAt ?? "";
        return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : left.capacityId < right.capacityId ? -1 : 1;
      });
    const present = [...new Set(projectViews.map((project) => project.source))].sort((left, right) =>
      left.localeCompare(right),
    );
    const headlineViews = capacityViews.filter((record) => headlineIds.has(record.capacityId));
    const source = primarySource(headlineViews, present);
    const counted = headlineViews.filter((record) => record.counts).reduce((sum, record) => sum + record.mw, 0);
    const hasCounted = headlineViews.some((record) => record.counts);
    const dno =
      asset.latitude !== null && asset.longitude !== null
        ? areaAt(input.dnoFeatures, asset.longitude, asset.latitude)
        : null;
    const registerRegions = projectViews.map((project) => project.region);
    const region = dno ?? registerRegions.find((value): value is string => Boolean(value)) ?? asset.country ?? UNLOCATED_REGION;
    const locationParts: string[] = [];
    pushUnique(locationParts, dno);
    for (const value of registerRegions) {
      pushUnique(locationParts, value);
    }
    for (const project of projectViews) {
      pushUnique(locationParts, project.county);
    }
    pushUnique(locationParts, asset.country);
    if (locationParts.length === 0) {
      locationParts.push(UNLOCATED_REGION);
    }
    const operators = [...new Set(projectViews.map((project) => project.operator).filter((value) => value.length > 0))].sort(
      (left, right) => left.localeCompare(right, "en"),
    );
    const assetName = foldSearch(asset.name);
    const aliases = [
      ...new Set(
        projectViews
          .map((project) => project.name)
          .filter((name) => name.length > 0 && foldSearch(name) !== assetName),
      ),
    ].sort((left, right) => left.localeCompare(right, "en"));
    const matchIds = new Set<string>();
    const matches: AssetMatchView[] = [];
    for (const project of projects) {
      for (const match of matchesByKey.get(partyKey(project)) ?? []) {
        if (matchIds.has(match.match_id)) {
          continue;
        }
        matchIds.add(match.match_id);
        matches.push({
          matchId: match.match_id,
          confidence: match.confidence,
          rule: match.rule,
          countsSource: sourceLabel(match.counts_source),
          repdMw: match.repd_mw,
          dukesMw: match.dukes_mw,
          distanceM: match.distance_m,
        });
      }
    }
    const row: AssetIndexRow = {
      id: asset.asset_id,
      name: asset.name,
      operator: operators.join(" · "),
      technology: asset.technology,
      status: asset.status,
      mw: hasCounted ? roundMw(counted) : null,
      region,
      location: locationParts.join(", "),
      country: asset.country,
      source,
      sources: present,
      latitude: asset.latitude,
      longitude: asset.longitude,
      aka: aliases.join(" "),
    };
    rows.push(row);
    details.set(row.id, { row, projects: projectViews, capacity: capacityViews, matches });
  }

  rows.sort((left, right) => left.id.localeCompare(right.id));
  return { rows, details };
}
