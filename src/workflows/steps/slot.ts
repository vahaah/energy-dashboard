import { takeWorkflowSlot, type WorkflowJob } from "@/lib/workflow-slot";
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

(takeSlotStep as { maxRetries?: number }).maxRetries = 1;
