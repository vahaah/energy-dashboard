import {
  assembleSnapshotParts,
  recentSnapshotWindow,
  type CarbonSnapshotParts,
  type ElexonSnapshotParts,
} from "@/lib/ingest/collect-grid";
import { mergeSettledGeneration, type SettledGeneration } from "@/lib/ingest/collect-generation";
import {
  emptyIntegrityReport,
  integritySourceStatus,
  logSoftIntegrityFindings,
} from "@/lib/snapshot-integrity";
import { stepStatus, type StepStatus } from "@/lib/step-status";
import { readWorkflowBody } from "@/lib/workflow-body";
import { postTinybirdRows } from "@/workflows/steps/post";

export async function postSnapshotsStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const window = recentSnapshotWindow(now);
  const carbon = await readWorkflowBody<CarbonSnapshotParts>("electricity", slot, "carbon");
  const elexon = await readWorkflowBody<ElexonSnapshotParts>("electricity", slot, "elexon");
  if (!window || !carbon || !elexon) {
    return stepStatus(false, 0, 0);
  }

  const collection = assembleSnapshotParts(window.periods, carbon, elexon, { now });
  const integrity = collection.integrity ?? emptyIntegrityReport(now);
  logSoftIntegrityFindings(integrity, "cron");
  const sources = [...collection.sources, integritySourceStatus(integrity)];
  console.info("[workflow] snapshots", {
    ok: sources.every((source) => source.ok),
    sources: sources.map((source) => ({
      source: source.source,
      ok: source.ok,
      rows: source.rows ?? 0,
    })),
  });

  return postTinybirdRows("energy_snapshots", collection.rows, now);
}

export async function postGenerationStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const fuel = await readWorkflowBody<SettledGeneration>("electricity", slot, "fuelinst");
  const embedded = await readWorkflowBody<SettledGeneration[]>("electricity", slot, "embedded");
  const collection = mergeSettledGeneration([
    fuel ?? { source: "fuelinst", error: "missing fuelinst body" },
    ...(embedded ?? []),
  ]);
  console.info("[workflow] generation", {
    ok: collection.sources.every((source) => source.ok),
    sources: collection.sources.map((source) => ({
      source: source.source,
      ok: source.ok,
      rows: source.rows ?? 0,
    })),
  });
  return postTinybirdRows("generation_5min", collection.rows, now);
}

(postSnapshotsStep as { maxRetries?: number }).maxRetries = 1;
(postGenerationStep as { maxRetries?: number }).maxRetries = 1;
