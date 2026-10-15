import { countedMegawatts } from "@/lib/catalogue/assets/build";
import type { DukesHeadline } from "@/lib/catalogue/assets/dukes";
import type { AssetRegister } from "@/lib/catalogue/assets/types";

export type TechnologyCount = {
  assets: number;
  counted_mw: number;
};

export type AssetSummary = {
  catalogue_schema_version: 1;
  repd_source_release_id: string;
  dukes_source_release_id: string;
  assets: number;
  projects: number;
  capacity_records: number;
  mappings: number;
  counted_mw: number;
  by_technology: Record<string, TechnologyCount>;
  by_status: Record<string, TechnologyCount>;
  coordinates: { mapped: number; list_only: number };
  dedupe: {
    matches: number;
    high: number;
    medium: number;
    manual: number;
    suppressed_mw: number;
  };
  dukes_headline_mw: DukesHeadline;
  files: Record<string, number>;
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function summarizeRegister(
  register: AssetRegister,
  releases: { repd: string; dukes: string },
  headline: DukesHeadline,
  files: Record<string, number>,
): AssetSummary {
  const currentReleaseIds = new Set([releases.repd, releases.dukes]);
  const currentCapacity = register.capacity.filter((record) => currentReleaseIds.has(record.source_release_id));
  const countedByAsset = new Map<string, number>();
  for (const record of currentCapacity) {
    if (!record.counts) {
      continue;
    }
    countedByAsset.set(record.asset_id, (countedByAsset.get(record.asset_id) ?? 0) + record.mw);
  }
  const byTechnology = new Map<string, TechnologyCount>();
  const byStatus = new Map<string, TechnologyCount>();
  let mapped = 0;
  let listOnly = 0;
  for (const asset of register.assets) {
    const counted = countedByAsset.get(asset.asset_id) ?? 0;
    const technology = byTechnology.get(asset.technology) ?? { assets: 0, counted_mw: 0 };
    technology.assets += 1;
    technology.counted_mw += counted;
    byTechnology.set(asset.technology, technology);
    const status = byStatus.get(asset.status) ?? { assets: 0, counted_mw: 0 };
    status.assets += 1;
    status.counted_mw += counted;
    byStatus.set(asset.status, status);
    if (asset.latitude === null || asset.longitude === null) {
      listOnly += 1;
    } else {
      mapped += 1;
    }
  }
  const technologyEntries = [...byTechnology.entries()].sort((left, right) =>
    left[0] < right[0] ? -1 : 1,
  );
  const statusEntries = [...byStatus.entries()].sort((left, right) => (left[0] < right[0] ? -1 : 1));
  const suppressed = currentCapacity.reduce((sum, record) => sum + (record.counts ? 0 : record.mw), 0);
  return {
    catalogue_schema_version: 1,
    repd_source_release_id: releases.repd,
    dukes_source_release_id: releases.dukes,
    assets: register.assets.length,
    projects: register.projects.length,
    capacity_records: register.capacity.length,
    mappings: register.mappings.length,
    counted_mw: round3(countedMegawatts(currentCapacity)),
    by_technology: Object.fromEntries(
      technologyEntries.map(([key, value]) => [key, { assets: value.assets, counted_mw: round3(value.counted_mw) }]),
    ),
    by_status: Object.fromEntries(
      statusEntries.map(([key, value]) => [key, { assets: value.assets, counted_mw: round3(value.counted_mw) }]),
    ),
    coordinates: { mapped, list_only: listOnly },
    dedupe: {
      matches: register.matches.length,
      high: register.matches.filter((match) => match.confidence === "high").length,
      medium: register.matches.filter((match) => match.confidence === "medium").length,
      manual: register.matches.filter((match) => match.confidence === "manual").length,
      suppressed_mw: round3(suppressed),
    },
    dukes_headline_mw: headline,
    files: Object.fromEntries(Object.entries(files).sort((left, right) => (left[0] < right[0] ? -1 : 1))),
  };
}
