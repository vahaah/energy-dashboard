import { publishAfterSuccess } from "@/lib/cache-warm";
import { stepStatus, type StepStatus } from "@/lib/step-status";

export async function publishStep(nowIso: string, historical: boolean): Promise<StepStatus> {
  "use step";
  await publishAfterSuccess(new Date(nowIso), { historical });
  return stepStatus(true, 0, 0);
}

(publishStep as { maxRetries?: number }).maxRetries = 1;
