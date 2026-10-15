/**
 * `source_releases.ndjson` is append-only. A later line replaces an earlier one
 * when its `published_at` is equal or newer. A later line with an older
 * `published_at` does not.
 */

type DatedRelease = {
  dataset_id: string;
  published_at: string | null;
  content: unknown;
};

type CapacityRelease = {
  source_release_id: string;
  published_at: string | null;
};

type CapacityRow = {
  project_id: string;
  source_id: string;
  source_release_id: string;
};

export function extractSha256(content: unknown): string | undefined {
  if (!content || typeof content !== "object") {
    return undefined;
  }
  const hash = (content as { extract_sha256?: unknown }).extract_sha256;
  return typeof hash === "string" ? hash : undefined;
}

export function newestExtractSha256(releases: readonly DatedRelease[], datasetId: string): string | undefined {
  let chosen: { at: string; hash: string } | undefined;
  for (const release of releases) {
    if (release.dataset_id !== datasetId) {
      continue;
    }
    const hash = extractSha256(release.content);
    if (!hash) {
      continue;
    }
    const at = release.published_at ?? "";
    if (!chosen || at >= chosen.at) {
      chosen = { at, hash };
    }
  }
  return chosen?.hash;
}

/**
 * Headline megawatts use one release per source and project: the latest
 * release that actually has a row for that project. Older rows stay in the
 * capacity history.
 */
export function currentCapacityRecords<T extends CapacityRow>(
  records: readonly T[],
  releases: readonly CapacityRelease[],
): T[] {
  const order = new Map(releases.map((release, index) => [release.source_release_id, index]));
  const published = new Map(releases.map((release) => [release.source_release_id, release.published_at ?? ""]));
  const best = new Map<string, { releaseId: string; at: string; index: number }>();
  for (const record of records) {
    const key = `${record.source_id}\t${record.project_id}`;
    const at = published.get(record.source_release_id) ?? "";
    const index = order.get(record.source_release_id) ?? -1;
    const current = best.get(key);
    if (!current || at > current.at || (at === current.at && index >= current.index)) {
      best.set(key, { releaseId: record.source_release_id, at, index });
    }
  }
  const chosen = new Set([...best.entries()].map(([key, value]) => `${key}\t${value.releaseId}`));
  return records.filter((record) => chosen.has(`${record.source_id}\t${record.project_id}\t${record.source_release_id}`));
}
