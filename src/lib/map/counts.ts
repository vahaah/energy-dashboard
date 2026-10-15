import { isOrigin } from "@/lib/map/origin";

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapSegment = {
  gbLongitude: number;
  gbLatitude: number;
  remoteLongitude: number;
  remoteLatitude: number;
};

export type MapCensusAsset = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  line: MapSegment | null;
};

export type MapCounts = {
  inView: number;
  matching: number;
  unlocated: number;
  line: string;
};

export function mapCountLine(counts: Pick<MapCounts, "inView" | "matching" | "unlocated">): string {
  return `${counts.inView} in view · ${counts.matching} matching filters · ${counts.unlocated} without a location`;
}

function pointInBounds(longitude: number, latitude: number, bounds: MapBounds): boolean {
  return (
    longitude >= bounds.west &&
    longitude <= bounds.east &&
    latitude >= bounds.south &&
    latitude <= bounds.north
  );
}

function cross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const adx = dx - ax;
  const ady = dy - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const cax = ax - cx;
  const cay = ay - cy;
  const cbx = bx - cx;
  const cby = by - cy;
  const abAcross = abx * acy - aby * acx;
  const abAcrossEnd = abx * ady - aby * adx;
  const cdAcross = cdx * cay - cdy * cax;
  const cdAcrossEnd = cdx * cby - cdy * cbx;
  if (abAcross === 0 && abAcrossEnd === 0) {
    return false;
  }
  return abAcross * abAcrossEnd <= 0 && cdAcross * cdAcrossEnd <= 0;
}

function segmentHits(line: MapSegment, bounds: MapBounds): boolean {
  const start: [number, number] = [line.gbLongitude, line.gbLatitude];
  const end: [number, number] = [line.remoteLongitude, line.remoteLatitude];
  if (pointInBounds(start[0], start[1], bounds) || pointInBounds(end[0], end[1], bounds)) {
    return true;
  }
  const edges: [[number, number], [number, number]][] = [
    [[bounds.west, bounds.south], [bounds.east, bounds.south]],
    [[bounds.east, bounds.south], [bounds.east, bounds.north]],
    [[bounds.east, bounds.north], [bounds.west, bounds.north]],
    [[bounds.west, bounds.north], [bounds.west, bounds.south]],
  ];
  return edges.some(([left, right]) => cross(start[0], start[1], end[0], end[1], left[0], left[1], right[0], right[1]));
}

export function assetHasLocation(asset: MapCensusAsset): boolean {
  if (asset.line) {
    return (
      !isOrigin(asset.line.gbLongitude, asset.line.gbLatitude) &&
      !isOrigin(asset.line.remoteLongitude, asset.line.remoteLatitude)
    );
  }
  if (asset.latitude === null || asset.longitude === null) {
    return false;
  }
  return !isOrigin(asset.longitude, asset.latitude);
}

export function assetInView(asset: MapCensusAsset, bounds: MapBounds | null): boolean {
  if (!assetHasLocation(asset)) {
    return false;
  }
  if (!bounds) {
    return true;
  }
  if (asset.line) {
    return segmentHits(asset.line, bounds);
  }
  if (asset.latitude === null || asset.longitude === null) {
    return false;
  }
  return pointInBounds(asset.longitude, asset.latitude, bounds);
}

export function mapCounts(assets: readonly MapCensusAsset[], bounds: MapBounds | null): MapCounts {
  let unlocated = 0;
  let inView = 0;
  for (const asset of assets) {
    if (!assetHasLocation(asset)) {
      unlocated += 1;
      continue;
    }
    if (assetInView(asset, bounds)) {
      inView += 1;
    }
  }
  const matching = assets.length;
  return {
    inView,
    matching,
    unlocated,
    line: mapCountLine({ inView, matching, unlocated }),
  };
}
