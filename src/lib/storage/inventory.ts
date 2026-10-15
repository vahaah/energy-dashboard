import { assetPath } from "@/lib/assets/href";
import { roundMw } from "@/lib/catalogue/assets/parse";
import type { StorageRecord, StorageStatus, StorageTechnology } from "@/lib/storage/records";

export type StorageInput = {
  id: string;
  name: string;
  technology: StorageTechnology;
  status: StorageStatus;
  country: string;
  ratedMw: number | null;
  energyMwh: number | null;
  externalRef: string;
  colocatedRef: string | null;
  assetId: string | null;
  /** Catalogue side that counts. A linked REPD row stays `false` so its megawatts are not added. */
  counts: boolean;
};

export type StorageAsset = {
  id: string;
  name: string;
  technology: StorageTechnology;
  status: StorageStatus;
  country: string;
  ratedMw: number | null;
  energyMwh: number | null;
  durationHours: number | null;
  href: string | null;
  covered: boolean;
};

export type StorageInventory = {
  assets: StorageAsset[];
  operating: StorageAsset[];
};

function findRoot(parent: number[], index: number): number {
  let cursor = index;
  while (parent[cursor] !== cursor) {
    cursor = parent[cursor] ?? cursor;
  }
  return cursor;
}

function union(parent: number[], left: number, right: number) {
  const rootLeft = findRoot(parent, left);
  const rootRight = findRoot(parent, right);
  if (rootLeft !== rootRight) {
    parent[rootRight] = rootLeft;
  }
}

function uniqueNumber(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null).map((value) => roundMw(value));
  const unique = [...new Set(present)];
  if (unique.length === 1) {
    return unique[0] ?? null;
  }
  return null;
}

function ratedMwOf(group: readonly StorageInput[]): number | null {
  if (group.some((row) => row.assetId !== null)) {
    const counted = group.filter((row) => row.counts && row.ratedMw !== null);
    if (counted.length === 0) {
      return null;
    }
    return roundMw(counted.reduce((sum, row) => sum + (row.ratedMw ?? 0), 0));
  }
  return uniqueNumber(group.map((row) => row.ratedMw));
}

function energyMwhOf(group: readonly StorageInput[]): number | null {
  if (group.some((row) => row.assetId !== null)) {
    const counted = group.filter((row) => row.counts && row.energyMwh !== null);
    if (counted.length === 0) {
      return uniqueNumber(group.map((row) => row.energyMwh));
    }
    return uniqueNumber(counted.map((row) => row.energyMwh));
  }
  return uniqueNumber(group.map((row) => row.energyMwh));
}

export function durationHours(ratedMw: number | null, energyMwh: number | null): number | null {
  if (ratedMw === null || energyMwh === null || ratedMw <= 0) {
    return null;
  }
  return energyMwh / ratedMw;
}

function groupName(group: readonly StorageInput[]): string {
  const catalogue = group.find((row) => row.assetId !== null);
  if (catalogue) {
    return catalogue.name;
  }
  return [...group].sort((left, right) => left.externalRef.localeCompare(right.externalRef, "en"))[0]?.name ?? "";
}

function groupStatus(group: readonly StorageInput[]): StorageStatus {
  return group.some((row) => row.status === "operational") ? "operational" : "not_operating";
}

/**
 * One station per catalogue asset, and one station per REPD co-location link.
 * Counted megawatts win when a REPD row and a DUKES row share an asset.
 * A co-located pair with the same figure counts once.
 */
export function buildStorageInventory(
  rows: readonly StorageInput[],
  coveredIds: ReadonlySet<string> = new Set(),
): StorageInventory {
  const parent = rows.map((_, index) => index);
  const byAsset = new Map<string, number>();
  const byRef = new Map<string, number>();
  rows.forEach((row, index) => {
    const existingRef = byRef.get(row.externalRef);
    if (existingRef !== undefined && rows[existingRef]?.technology === row.technology) {
      union(parent, existingRef, index);
    } else if (existingRef === undefined) {
      byRef.set(row.externalRef, index);
    }
    if (!row.assetId) {
      return;
    }
    const existing = byAsset.get(row.assetId);
    if (existing === undefined) {
      byAsset.set(row.assetId, index);
      return;
    }
    if (rows[existing]?.technology === row.technology) {
      union(parent, existing, index);
    }
  });
  rows.forEach((row, index) => {
    if (!row.colocatedRef) {
      return;
    }
    const other = byRef.get(row.colocatedRef);
    if (other === undefined || rows[other]?.technology !== row.technology) {
      return;
    }
    union(parent, index, other);
  });

  const groups = new Map<number, StorageInput[]>();
  rows.forEach((row, index) => {
    const root = findRoot(parent, index);
    const group = groups.get(root);
    if (group) {
      group.push(row);
    } else {
      groups.set(root, [row]);
    }
  });

  const assets: StorageAsset[] = [];
  for (const group of groups.values()) {
    const assetId = group.find((row) => row.assetId)?.assetId ?? null;
    const name = groupName(group);
    const id =
      assetId ??
      [...group].sort((left, right) => left.id.localeCompare(right.id))[0]?.id ??
      "";
    const ratedMw = ratedMwOf(group);
    const energyMwh = energyMwhOf(group);
    assets.push({
      id,
      name,
      technology: group[0]?.technology ?? "battery",
      status: groupStatus(group),
      country: group.find((row) => row.assetId)?.country ?? group[0]?.country ?? "",
      ratedMw,
      energyMwh,
      durationHours: durationHours(ratedMw, energyMwh),
      href: assetId ? assetPath(assetId, name) : null,
      covered: coveredIds.has(id),
    });
  }
  assets.sort((left, right) => {
    if (left.technology !== right.technology) {
      return left.technology === "pumped_storage" ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "en") || left.id.localeCompare(right.id);
  });
  return {
    assets,
    operating: assets.filter((asset) => asset.status === "operational"),
  };
}

export function storageInputFromRecord(record: StorageRecord): StorageInput {
  return {
    id: record.record_id,
    name: record.name,
    technology: record.technology,
    status: record.status,
    country: record.country,
    ratedMw: record.rated_mw,
    energyMwh: record.energy_mwh,
    externalRef: record.external_ref,
    colocatedRef: record.colocated_ref,
    assetId: null,
    counts: true,
  };
}
