import { sourceStatusesHaveFailure, type SourceStatus } from "@/lib/http";
import { collectGenerationForSettlementDate } from "@/lib/ingest/collect-generation";
import { collectSnapshotsForSettlementDate } from "@/lib/ingest/collect-grid";
import { formatTinybirdDateTime, yesterdayLondonDate } from "@/lib/london-time";
import {
  integrityReportForWrittenRows,
  integritySourceStatus,
  logSoftIntegrityFindings,
  recordSnapshotIntegrity,
  shouldRecordSnapshotIntegrity,
  type SnapshotIntegrityReport,
} from "@/lib/snapshot-integrity";
import { stepStatus, type StepStatus } from "@/lib/step-status";
import { readWorkflowBody, writeWorkflowBody } from "@/lib/workflow-body";
import { postTinybirdRows } from "@/workflows/steps/post";

type StoredSnapshots = {
  settlementDate: string;
  rows: Record<string, unknown>[];
  sources: SourceStatus[];
  integrity: SnapshotIntegrityReport | null;
};

type StoredGeneration = {
  rows: Record<string, unknown>[];
  sources: SourceStatus[];
};

export async function fetchYesterdaySnapshotsStep(
  slot: string,
  nowIso: string
): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const settlementDate = yesterdayLondonDate(now);
  const snapshots = await collectSnapshotsForSettlementDate(settlementDate, now);
  const body: StoredSnapshots = {
    settlementDate,
    rows: snapshots.rows,
    sources: snapshots.sources,
    integrity: snapshots.integrity ?? null,
  };
  const bytes = await writeWorkflowBody("yesterday", slot, "snapshots", body);
  return stepStatus(!sourceStatusesHaveFailure(snapshots.sources), snapshots.rows.length, bytes);
}

export async function fetchYesterdayGenerationStep(
  slot: string,
  nowIso: string
): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const settlementDate = yesterdayLondonDate(now);
  const generation = await collectGenerationForSettlementDate(settlementDate, now);
  const body: StoredGeneration = { rows: generation.rows, sources: generation.sources };
  const bytes = await writeWorkflowBody("yesterday", slot, "generation", body);
  return stepStatus(!sourceStatusesHaveFailure(generation.sources), generation.rows.length, bytes);
}

export async function postYesterdaySnapshotsStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const stored = await readWorkflowBody<StoredSnapshots>("yesterday", slot, "snapshots");
  if (!stored) {
    return stepStatus(false, 0, 0);
  }

  let snapshotIngestFailed = false;
  let status = stepStatus(true, 0, 0);
  if (stored.rows.length > 0) {
    try {
      status = await postTinybirdRows("energy_snapshots", stored.rows, now);
    } catch (error) {
      snapshotIngestFailed = true;
      throw error;
    }
  }

  const integrity =
    stored.integrity ?? {
      checkedAt: formatTinybirdDateTime(now),
      settlementDate: stored.settlementDate,
      checkedTimestamps: [],
      failing: [],
    };
  if (shouldRecordSnapshotIntegrity(integrity, stored.rows, snapshotIngestFailed)) {
    await recordSnapshotIntegrity(integrityReportForWrittenRows(integrity, stored.rows));
  }
  logSoftIntegrityFindings(integrity, "cron-yesterday");
  const sources = [...stored.sources, integritySourceStatus(integrity)];
  console.info("[workflow] yesterday snapshots", {
    settlementDate: stored.settlementDate,
    ok: sources.every((source) => source.ok) && !snapshotIngestFailed,
  });
  return status;
}

export async function postYesterdayGenerationStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const stored = await readWorkflowBody<StoredGeneration>("yesterday", slot, "generation");
  if (!stored) {
    return stepStatus(false, 0, 0);
  }
  console.info("[workflow] yesterday generation", {
    ok: stored.sources.every((source) => source.ok),
    rows: stored.rows.length,
  });
  return postTinybirdRows("generation_5min", stored.rows, now);
}

(fetchYesterdaySnapshotsStep as { maxRetries?: number }).maxRetries = 1;
(fetchYesterdayGenerationStep as { maxRetries?: number }).maxRetries = 1;
(postYesterdaySnapshotsStep as { maxRetries?: number }).maxRetries = 1;
(postYesterdayGenerationStep as { maxRetries?: number }).maxRetries = 1;
