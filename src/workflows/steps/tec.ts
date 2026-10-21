import { observeJobFailure } from "@/lib/blob-readback";
import { recordJobSuccess } from "@/lib/job-health";
import { TEC_MAX_RETRIES, type TecStepStatus } from "@/lib/projects/budget";
import {
  fetchTecRegister,
  publishTecRegister,
  validateTecRegister,
  type FetchMeta,
  type TecFetchResult,
} from "@/lib/projects/publish";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

const JOB = "cron-tec" as const;

export async function takeTecSlotStep(slot: string, owner: string): Promise<TecStepStatus> {
  "use step";
  await takeWorkflowSlot("tec", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchTecStep(nowIso: string): Promise<TecFetchResult> {
  "use step";
  try {
    return await fetchTecRegister(new Date(nowIso), stepAttempt());
  } catch (error) {
    await observeJobFailure(JOB, error, TEC_MAX_RETRIES);
    throw error;
  }
}

export async function validateTecStep(
  hash: string,
  nowIso: string,
  raw?: string,
  meta?: FetchMeta,
): Promise<TecStepStatus> {
  "use step";
  try {
    return await validateTecRegister(hash, new Date(nowIso), raw, meta);
  } catch (error) {
    await observeJobFailure(JOB, error, TEC_MAX_RETRIES);
    throw error;
  }
}

export async function publishTecStep(
  hash: string,
  nowIso: string,
  raw?: string,
  meta?: FetchMeta,
): Promise<TecStepStatus> {
  "use step";
  try {
    const status = await publishTecRegister(hash, new Date(nowIso), raw, meta);
    await recordJobSuccess(JOB, new Date(nowIso));
    return status;
  } catch (error) {
    await observeJobFailure(JOB, error, TEC_MAX_RETRIES);
    throw error;
  }
}

(takeTecSlotStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(fetchTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(validateTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(publishTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
