import { randomBytes } from "node:crypto";
import { CATALOGUE_SCHEMA_VERSION } from "@/lib/catalogue/schema";

/** One invocation, one run. The id is not the publisher's `published_at`. */
export function ingestionRunLine(
  datasetId: string,
  releaseId: string,
  startedAt: string,
  finishedAt: string,
): { id: string; line: string } {
  const id = `run:${datasetId}:${startedAt}:${randomBytes(4).toString("hex")}`;
  const record = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    ingestion_run_id: id,
    dataset_id: datasetId,
    source_release_id: releaseId,
    started_at: startedAt,
    finished_at: finishedAt,
    status: "succeeded" as const,
  };
  return { id, line: JSON.stringify(record) };
}
