import type { StepStatus } from "@/lib/step-status";
import { warmPipeById } from "@/lib/warm-pipes";

export async function warmPipeStep(pipeId: string, nowIso: string): Promise<StepStatus> {
  "use step";
  return warmPipeById(pipeId, new Date(nowIso));
}

(warmPipeStep as { maxRetries?: number }).maxRetries = 1;
