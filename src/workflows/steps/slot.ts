import { claimWorkflowSlot, takeWorkflowSlot, type WorkflowJob } from "@/lib/workflow-slot";
import { stepStatus, type StepStatus } from "@/lib/step-status";

export async function takeSlotStep(
  job: WorkflowJob,
  slot: string,
  owner: string
): Promise<StepStatus> {
  "use step";
  await takeWorkflowSlot(job, slot, owner);
  return stepStatus(true, 0, 0);
}

export type ElectricitySlotClaim = StepStatus & { skipped: boolean };

/** Held electricity slot is a skip. /api/cron and /api/cron-warm share it; the loser must not fail the run. */
export async function takeElectricitySlotStep(slot: string, owner: string): Promise<ElectricitySlotClaim> {
  "use step";
  if ((await claimWorkflowSlot("electricity", slot, owner)) === "held") {
    console.info("[workflow] slot skipped", { job: "electricity" });
    return { ...stepStatus(true, 0, 0), skipped: true };
  }
  return { ...stepStatus(true, 0, 0), skipped: false };
}

(takeSlotStep as { maxRetries?: number }).maxRetries = 1;
(takeElectricitySlotStep as { maxRetries?: number }).maxRetries = 1;
