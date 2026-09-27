import {
  sourceStatusesHaveFailure,
  type CollectionResult,
  type SourceStatus,
} from "@/lib/http";

export function describeCollection(result: CollectionResult): string {
  const parts = result.sources.map((source) =>
    source.ok
      ? `${source.source}=${source.rows ?? 0}`
      : `${source.source} failed: ${source.error}`
  );

  if (result.rows.length > 0) {
    return `${result.rows.length} rows (${parts.join("; ")})`;
  }
  if (sourceStatusesHaveFailure(result.sources)) {
    return `skipped ingest (${parts.join("; ")})`;
  }
  return "no data";
}

export function shouldFailBackfill(results: Array<{ sources: SourceStatus[] }>): boolean {
  return results.some((result) => sourceStatusesHaveFailure(result.sources));
}
