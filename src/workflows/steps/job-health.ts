import { recordJobFailure, recordJobSuccess, type CronJobId } from "@/lib/job-health";

export async function recordJobSuccessStep(job: CronJobId, nowIso: string): Promise<void> {
  "use step";
  await recordJobSuccess(job, new Date(nowIso));
}

export async function recordJobFailureStep(job: CronJobId, message: string): Promise<void> {
  "use step";
  await recordJobFailure(job, message);
}

(recordJobSuccessStep as { maxRetries?: number }).maxRetries = 0;
(recordJobFailureStep as { maxRetries?: number }).maxRetries = 0;
