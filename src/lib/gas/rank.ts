import type { GasRelease } from "@/lib/ingest/national-gas/release";

const DEMAND_HEADLINES = ["PUBOB637", "PUBOBJ635"] as const;
const FLOW_HEADLINE = "PUBOB2042";
const LINEPACK_PUBLICATIONS = ["PUBOB693", "PUBOB29", "PUBOB694", "PUBOB30", "PUBOB31"] as const;

/** Higher covers more of the gas day. A linepack-only release must not hide a flow release. */
export function gasReleaseCoverageRank(release: GasRelease): number {
  const ids = new Set(
    release.components.filter((component) => component.value != null).map((component) => component.publication_id),
  );
  let rank = 0;
  if (DEMAND_HEADLINES.some((id) => ids.has(id))) {
    rank += 4;
  }
  if (ids.has(FLOW_HEADLINE)) {
    rank += 2;
  }
  if (
    release.instantaneous.some(
      (sample) =>
        sample.role === "demand" ||
        sample.role === "demand_part" ||
        sample.role === "linepack" ||
        sample.role === "storage_withdrawal",
    )
  ) {
    rank += 2;
  }
  if (LINEPACK_PUBLICATIONS.some((id) => ids.has(id))) {
    rank += 1;
  }
  return rank;
}

export function newestGasPublishedAt(release: GasRelease): string {
  let stamp = "";
  for (const component of release.components) {
    if (component.published_at > stamp) {
      stamp = component.published_at;
    }
  }
  for (const sample of release.instantaneous) {
    if (sample.published_at > stamp) {
      stamp = sample.published_at;
    }
  }
  return stamp;
}

export function preferGasRelease(current: GasRelease, incoming: GasRelease): GasRelease {
  const currentRank = gasReleaseCoverageRank(current);
  const incomingRank = gasReleaseCoverageRank(incoming);
  if (incomingRank !== currentRank) {
    return incomingRank > currentRank ? incoming : current;
  }
  return newestGasPublishedAt(incoming) >= newestGasPublishedAt(current) ? incoming : current;
}
