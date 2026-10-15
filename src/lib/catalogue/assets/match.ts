import { stableId } from "@/lib/catalogue/assets/ids";
import { roundMw } from "@/lib/catalogue/assets/parse";
import { countsSource, familyOf, type Family } from "@/lib/catalogue/assets/technologies";
import type { CatalogueStation, MatchOverrides, MatchRecord, MatchRule } from "@/lib/catalogue/assets/types";

const GENERIC_TOKENS = new Set([
  "power",
  "station",
  "windfarm",
  "wind",
  "solar",
  "park",
  "farm",
  "units",
  "unit",
  "biomass",
  "dedicated",
  "extension",
  "phase",
  "limited",
  "ltd",
  "offshore",
  "onshore",
  "hydro",
  "hydroelectricity",
  "repowering",
  "project",
  "energy",
  "waste",
  "incineration",
  "resubmission",
  "campus",
  "building",
  "north",
  "south",
  "east",
  "west",
  "central",
  "circuit",
  "storage",
  "pumped",
  "from",
  "scheme",
  "water",
  "quarry",
  "high",
  "higher",
  "upper",
  "lower",
  "down",
  "close",
  "wall",
  "point",
  "land",
  "little",
  "great",
  "long",
  "drove",
  "station",
  "works",
  "treatment",
  "community",
  "moor",
  "hill",
  "road",
  "lane",
  "hall",
  "bridge",
  "house",
  "green",
  "common",
  "field",
  "bank",
  "the",
  "and",
  "for",
  "with",
]);

const COORD_METRES = 1_500;
const TIGHT_METRES = 250;
const SAME_SITE_METRES = 500;
const NAME_NEAR_METRES = 5_000;
const NAME_MID_METRES = 25_000;
const NAME_FAR_METRES = 100_000;
const GROUP_METRES = 50_000;

export function distinctiveTokens(name: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of name.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")) {
    if (token.length < 4 || GENERIC_TOKENS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function metres(left: CatalogueStation, right: CatalogueStation): number | null {
  if (
    left.easting === null ||
    left.northing === null ||
    right.easting === null ||
    right.northing === null
  ) {
    return null;
  }
  return Math.hypot(left.easting - right.easting, left.northing - right.northing);
}

function withinRatio(left: number, right: number, ratio: number): boolean {
  if (left <= 0 || right <= 0) {
    return false;
  }
  return Math.abs(left - right) / Math.max(left, right) <= ratio;
}

function sharedTokens(left: string, right: string): string[] {
  const tokens = new Set(distinctiveTokens(right));
  return distinctiveTokens(left).filter((token) => tokens.has(token));
}

function sharesToken(left: string, right: string): boolean {
  return sharedTokens(left, right).length > 0;
}

function longestTokenLength(name: string): number {
  return distinctiveTokens(name).reduce((best, token) => Math.max(best, token.length), 0);
}

/**
 * Past 25 km a shared word is not enough: both names have to lead with that
 * same token, and it has to be at least six letters. That keeps Hornsea and
 * drops "Dundee" matched to a factory whose real name is Michelin.
 */
function sameSiteName(left: string, right: string): boolean {
  const shared = sharedTokens(left, right);
  const longestShared = shared.reduce((best, token) => Math.max(best, token.length), 0);
  return (
    longestShared >= 6 &&
    longestShared === longestTokenLength(left) &&
    longestShared === longestTokenLength(right)
  );
}

function mwOf(station: CatalogueStation): number {
  return station.mw ?? 0;
}

function sumMw(stations: readonly CatalogueStation[]): number {
  return stations.reduce((sum, station) => sum + mwOf(station), 0);
}

function minDistance(left: readonly CatalogueStation[], right: readonly CatalogueStation[]): number | null {
  let best: number | null = null;
  for (const dukes of left) {
    for (const repd of right) {
      const distance = metres(dukes, repd);
      if (distance === null) {
        continue;
      }
      if (best === null || distance < best) {
        best = distance;
      }
    }
  }
  return best === null ? null : Math.round(best);
}

function bySize(left: CatalogueStation, right: CatalogueStation): number {
  return mwOf(right) - mwOf(left) || (left.externalRef < right.externalRef ? -1 : 1);
}

type Claim = {
  dukes: CatalogueStation[];
  repd: CatalogueStation[];
  confidence: MatchRecord["confidence"];
  rule: MatchRule;
};

/**
 * One DUKES station or a same-site group matches one REPD row or group.
 * Manual links win. Then same-grid capacity, then a shared distinctive name
 * token. Ambiguous pairs are left unmatched rather than guessed.
 * Conventional gas, oil and nuclear do not auto-match: REPD does not list them.
 */
export function matchStations(
  repd: readonly CatalogueStation[],
  dukes: readonly CatalogueStation[],
  overrides: MatchOverrides,
): MatchRecord[] {
  const repdByRef = new Map(repd.map((station) => [station.externalRef, station]));
  const dukesByCode = new Map(dukes.map((station) => [station.externalRef, station]));
  const usedRepd = new Set<string>();
  const usedDukes = new Set<string>();
  const claims: Claim[] = [];
  const forbidden = new Set<string>();
  for (const unlink of overrides.unlinks) {
    for (const code of unlink.dukes_site_codes) {
      for (const ref of unlink.repd_refs) {
        forbidden.add(`${code}\0${ref}`);
      }
    }
  }

  function allowed(code: string, ref: string): boolean {
    return !forbidden.has(`${code}\0${ref}`);
  }

  function claim(
    dukesStations: CatalogueStation[],
    repdStations: CatalogueStation[],
    confidence: MatchRecord["confidence"],
    rule: MatchRule,
  ): boolean {
    if (dukesStations.length === 0 || repdStations.length === 0) {
      return false;
    }
    if (dukesStations.some((station) => usedDukes.has(station.externalRef))) {
      return false;
    }
    if (repdStations.some((station) => usedRepd.has(station.externalRef))) {
      return false;
    }
    const family = familyOf(dukesStations[0]?.technology ?? "solar_pv");
    if (dukesStations.some((station) => familyOf(station.technology) !== family)) {
      throw new Error(`match mixes DUKES families (${rule})`);
    }
    if (repdStations.some((station) => familyOf(station.technology) !== family)) {
      throw new Error(`match mixes REPD and DUKES families (${rule})`);
    }
    for (const station of dukesStations) {
      usedDukes.add(station.externalRef);
    }
    for (const station of repdStations) {
      usedRepd.add(station.externalRef);
    }
    claims.push({ dukes: dukesStations, repd: repdStations, confidence, rule });
    return true;
  }

  function requireStation(
    map: Map<string, CatalogueStation>,
    ref: string,
    label: string,
    note: string,
  ): CatalogueStation {
    const station = map.get(ref);
    if (!station) {
      throw new Error(`match override (${note}) ${label} ${ref} is not in this extract`);
    }
    return station;
  }

  for (const link of overrides.links) {
    const dukesStations = link.dukes_site_codes.map((code) =>
      requireStation(dukesByCode, code, "DUKES", link.note),
    );
    const repdStations = link.repd_refs.map((ref) => requireStation(repdByRef, ref, "REPD", link.note));
    if (!claim(dukesStations, repdStations, "manual", "manual")) {
      throw new Error(`match override (${link.note}) overlaps another link`);
    }
  }

  const repdByFamily = new Map<Family, CatalogueStation[]>();
  for (const station of repd) {
    const family = familyOf(station.technology);
    const list = repdByFamily.get(family) ?? [];
    list.push(station);
    repdByFamily.set(family, list);
  }

  const dukesOrder = [...dukes].sort(bySize);
  for (const station of dukesOrder) {
    if (usedDukes.has(station.externalRef) || station.mw === null || station.mw <= 0) {
      continue;
    }
    const pool = (repdByFamily.get(familyOf(station.technology)) ?? []).filter(
      (candidate) => !usedRepd.has(candidate.externalRef) && allowed(station.externalRef, candidate.externalRef),
    );
    const near = pool.filter((candidate) => {
      const distance = metres(station, candidate);
      return distance !== null && distance <= COORD_METRES;
    });
    const singles = near.filter((candidate) => withinRatio(mwOf(candidate), mwOf(station), 0.12));
    const ranked = [...singles].sort(
      (left, right) =>
        Math.abs(mwOf(left) - mwOf(station)) - Math.abs(mwOf(right) - mwOf(station)) ||
        (metres(station, left) ?? 0) - (metres(station, right) ?? 0) ||
        (left.externalRef < right.externalRef ? -1 : 1),
    );
    const best = ranked[0];
    const next = ranked[1];
    if (best && (!next || gapIsClear(station, best, next))) {
      claim([station], [best], "high", "coordinates");
      continue;
    }
    const grouped = near.filter((candidate) => {
      const distance = metres(station, candidate) ?? Number.POSITIVE_INFINITY;
      return distance <= TIGHT_METRES || sharesToken(station.name, candidate.name);
    });
    if (grouped.length >= 2 && withinRatio(sumMw(grouped), mwOf(station), 0.1)) {
      const singleDelta = best ? Math.abs(mwOf(best) - mwOf(station)) : Number.POSITIVE_INFINITY;
      if (Math.abs(sumMw(grouped) - mwOf(station)) < singleDelta) {
        claim([station], grouped, "high", "coordinate_group");
        continue;
      }
    }
    const revised = near.filter(
      (candidate) =>
        (metres(station, candidate) ?? Number.POSITIVE_INFINITY) <= SAME_SITE_METRES &&
        sharesToken(station.name, candidate.name) &&
        withinRatio(mwOf(candidate), mwOf(station), 0.4),
    );
    if (revised.length === 1 && revised[0]) {
      claim([station], [revised[0]], "high", "coordinates");
    }
  }

  for (const station of dukesOrder) {
    if (usedDukes.has(station.externalRef) || station.mw === null || station.mw <= 0) {
      continue;
    }
    const tokens = new Set(distinctiveTokens(station.name));
    if (tokens.size === 0) {
      continue;
    }
    const pool = (repdByFamily.get(familyOf(station.technology)) ?? []).filter(
      (candidate) => !usedRepd.has(candidate.externalRef) && allowed(station.externalRef, candidate.externalRef),
    );
    const named = pool.filter((candidate) => {
      if (!sharesToken(station.name, candidate.name)) {
        return false;
      }
      const distance = metres(station, candidate);
      if (distance === null) {
        return withinRatio(mwOf(candidate), mwOf(station), 0.08);
      }
      if (distance <= NAME_NEAR_METRES) {
        return withinRatio(mwOf(candidate), mwOf(station), 0.15);
      }
      if (distance <= NAME_MID_METRES) {
        return withinRatio(mwOf(candidate), mwOf(station), 0.08);
      }
      return (
        distance <= NAME_FAR_METRES &&
        sameSiteName(station.name, candidate.name) &&
        withinRatio(mwOf(candidate), mwOf(station), 0.05)
      );
    });
    const ranked = [...named].sort(
      (left, right) =>
        Math.abs(mwOf(left) - mwOf(station)) - Math.abs(mwOf(right) - mwOf(station)) ||
        (metres(station, left) ?? Number.POSITIVE_INFINITY) -
          (metres(station, right) ?? Number.POSITIVE_INFINITY) ||
        (left.externalRef < right.externalRef ? -1 : 1),
    );
    const best = ranked[0];
    const next = ranked[1];
    if (!best || (next && !gapIsClear(station, best, next))) {
      continue;
    }
    const distance = metres(station, best);
    claim([station], [best], distance !== null && distance <= NAME_NEAR_METRES ? "high" : "medium", "name");
  }

  claimNameGroups(dukes, repd, usedDukes, usedRepd, allowed, claim);

  return claims.map(toRecord);
}

function gapIsClear(dukes: CatalogueStation, best: CatalogueStation, next: CatalogueStation): boolean {
  const bestDelta = Math.abs(mwOf(best) - mwOf(dukes));
  const nextDelta = Math.abs(mwOf(next) - mwOf(dukes));
  if (nextDelta - bestDelta > Math.max(0.5, 0.02 * mwOf(dukes))) {
    return true;
  }
  const bestDistance = metres(dukes, best) ?? Number.POSITIVE_INFINITY;
  const nextDistance = metres(dukes, next) ?? Number.POSITIVE_INFINITY;
  return bestDistance + 50 < nextDistance && bestDelta <= nextDelta;
}

function claimNameGroups(
  dukes: readonly CatalogueStation[],
  repd: readonly CatalogueStation[],
  usedDukes: Set<string>,
  usedRepd: Set<string>,
  allowed: (code: string, ref: string) => boolean,
  claim: (
    dukesStations: CatalogueStation[],
    repdStations: CatalogueStation[],
    confidence: MatchRecord["confidence"],
    rule: MatchRule,
  ) => boolean,
): void {
  type Bucket = { family: Family; token: string; dukes: CatalogueStation[]; repd: CatalogueStation[] };
  const buckets = new Map<string, Bucket>();
  function add(station: CatalogueStation, side: "dukes" | "repd"): void {
    const family = familyOf(station.technology);
    for (const token of distinctiveTokens(station.name)) {
      const key = `${family}\0${token}`;
      const bucket = buckets.get(key) ?? { family, token, dukes: [], repd: [] };
      bucket[side].push(station);
      buckets.set(key, bucket);
    }
  }
  for (const station of dukes) {
    if (!usedDukes.has(station.externalRef)) {
      add(station, "dukes");
    }
  }
  for (const station of repd) {
    if (!usedRepd.has(station.externalRef)) {
      add(station, "repd");
    }
  }
  const candidates = [...buckets.values()]
    .filter((bucket) => bucket.dukes.length > 0 && bucket.repd.length > 0)
    .filter((bucket) => bucket.dukes.length <= 8 && bucket.repd.length <= 15)
    .sort(
      (left, right) =>
        sumMw(right.dukes) - sumMw(left.dukes) ||
        (left.token < right.token ? -1 : 1) ||
        (left.family < right.family ? -1 : 1),
    );
  for (const bucket of candidates) {
    const dukesLeft = bucket.dukes.filter((station) => !usedDukes.has(station.externalRef));
    const anchor = [...dukesLeft].sort(bySize)[0];
    if (!anchor || anchor.easting === null) {
      continue;
    }
    const nearDukes = dukesLeft.filter((station) => {
      const distance = metres(anchor, station);
      return distance !== null && distance <= GROUP_METRES;
    });
    const nearRepd = bucket.repd.filter((station) => {
      if (usedRepd.has(station.externalRef)) {
        return false;
      }
      if (nearDukes.some((dukesStation) => !allowed(dukesStation.externalRef, station.externalRef))) {
        return false;
      }
      const distance = metres(anchor, station);
      return distance !== null && distance <= GROUP_METRES;
    });
    if (nearDukes.length + nearRepd.length < 3 || nearRepd.length === 0) {
      continue;
    }
    if (!withinRatio(sumMw(nearDukes), sumMw(nearRepd), 0.08)) {
      continue;
    }
    const farthest = Math.max(
      ...nearDukes.map((station) => metres(anchor, station) ?? 0),
      ...nearRepd.map((station) => metres(anchor, station) ?? 0),
    );
    claim(nearDukes, nearRepd, farthest <= NAME_NEAR_METRES ? "high" : "medium", "name_group");
  }
}

function toRecord(claim: Claim): MatchRecord {
  const orderedDukes = [...claim.dukes].sort((left, right) =>
    left.externalRef < right.externalRef ? -1 : left.externalRef > right.externalRef ? 1 : 0,
  );
  const codes = orderedDukes.map((station) => station.externalRef);
  const names = orderedDukes.map((station) => station.name);
  const refs = [...claim.repd.map((station) => station.externalRef)].sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const family = familyOf(claim.dukes[0]?.technology ?? "solar_pv");
  return {
    match_id: stableId("mat", `match:${codes.join(",")}|${refs.join(",")}`),
    confidence: claim.confidence,
    rule: claim.rule,
    dukes_site_codes: codes,
    dukes_names: names,
    repd_refs: refs,
    distance_m: minDistance(claim.dukes, claim.repd),
    repd_mw: roundMw(sumMw(claim.repd)),
    dukes_mw: roundMw(sumMw(claim.dukes)),
    counts_source: countsSource(family),
  };
}
