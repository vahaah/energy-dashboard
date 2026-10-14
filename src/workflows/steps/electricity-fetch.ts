import {
  fetchCarbonSnapshotParts,
  fetchElexonSnapshotParts,
  recentSnapshotWindow,
  type CarbonSnapshotParts,
  type ElexonSnapshotParts,
} from "@/lib/ingest/collect-grid";
import { fetchRecentEmbedded, fetchRecentFuelinst } from "@/lib/ingest/collect-generation";
import { stepStatus, type StepStatus } from "@/lib/step-status";
import { writeWorkflowBody } from "@/lib/workflow-body";

export async function fetchCarbonStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const window = recentSnapshotWindow(now);
  const parts = window ? await fetchCarbonSnapshotParts(window.http) : null;
  const bytes = parts ? await writeWorkflowBody("electricity", slot, "carbon", parts) : 0;
  return stepStatus(parts != null, partRows(parts), bytes);
}

export async function fetchElexonStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const window = recentSnapshotWindow(now);
  const parts = window ? await fetchElexonSnapshotParts(window.http, now) : null;
  const bytes = parts ? await writeWorkflowBody("electricity", slot, "elexon", parts) : 0;
  return stepStatus(parts != null, elexonRows(parts), bytes);
}

export async function fetchFuelinstStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const fuel = await fetchRecentFuelinst(new Date(nowIso));
  const bytes = await writeWorkflowBody("electricity", slot, "fuelinst", fuel);
  return stepStatus(!fuel.error, fuel.rows?.length ?? 0, bytes);
}

export async function fetchEmbeddedStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const embedded = await fetchRecentEmbedded(new Date(nowIso));
  const bytes = await writeWorkflowBody("electricity", slot, "embedded", embedded);
  const rows = embedded.reduce((sum, part) => sum + (part.rows?.length ?? 0), 0);
  return stepStatus(embedded.every((part) => !part.error), rows, bytes);
}

(fetchCarbonStep as { maxRetries?: number }).maxRetries = 1;
(fetchElexonStep as { maxRetries?: number }).maxRetries = 1;
(fetchFuelinstStep as { maxRetries?: number }).maxRetries = 1;
(fetchEmbeddedStep as { maxRetries?: number }).maxRetries = 1;

function partRows(parts: CarbonSnapshotParts | null): number {
  if (!parts) {
    return 0;
  }
  return (parts.intensity.value?.length ?? 0) + (parts.mix.value?.length ?? 0);
}

function elexonRows(parts: ElexonSnapshotParts | null): number {
  if (!parts) {
    return 0;
  }
  return (
    (parts.prices.value?.length ?? 0) +
    (parts.marketIndex.value?.length ?? 0) +
    (parts.demand.value?.length ?? 0) +
    (parts.generation.value?.length ?? 0)
  );
}
