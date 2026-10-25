const SECTOR = /^([A-Z]{1,2}\d[A-Z\d]?)[ ]?(\d)$/;

export type PostcodeSector = {
  outward: string;
  digit: string;
  /** Outward code, a space, then the sector digit. `G1 2`. */
  label: string;
};

/** A postcode sector is the outward code plus the first digit of the inward code. */
export function parsePostcodeSector(input: string): PostcodeSector | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "");
  const match = SECTOR.exec(compact);
  const outward = match?.[1];
  const digit = match?.[2];
  if (!outward || !digit) {
    return null;
  }
  return { outward, digit, label: `${outward} ${digit}` };
}

export type SectorPointLookup = (label: string) => readonly [number, number] | null;

/**
 * The NSPL shards store the local authority, not a coordinate, so the default
 * lookup has nothing to return. Callers that know a centroid pass their own lookup.
 */
export const emptySectorPointLookup: SectorPointLookup = () => null;

/** `[lon, lat]`, or null. `(0, 0)` is never a sector centroid. */
export function postcodeSectorPoint(
  sector: string,
  lookup: SectorPointLookup = emptySectorPointLookup,
): [number, number] | null {
  const parsed = parsePostcodeSector(sector);
  if (!parsed) {
    return null;
  }
  const point = lookup(parsed.label);
  if (!point) {
    return null;
  }
  const [longitude, latitude] = point;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  if (longitude === 0 && latitude === 0) {
    return null;
  }
  return [longitude, latitude];
}
