import { RetryableError } from "workflow";
import { observeJobFailure } from "@/lib/blob-readback";
import { emptyGasStatus, GAS_MAX_RETRIES, type GasStepStatus } from "@/lib/gas/budget";
import { fetchGasBundle, publishGasBundle, validateGasBundle } from "@/lib/gas/pipeline";
import { recordJobFailure, recordJobSuccess } from "@/lib/job-health";
import { publishMapGasFlows } from "@/lib/map/flows-release";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

const JOB = "cron-gas" as const;

export async function takeGasSlotStep(slot: string, owner: string): Promise<GasStepStatus> {
  "use step";
  await takeWorkflowSlot("gas", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchGasIntradayStep(
  nowIso: string,
): Promise<GasStepStatus & { raw?: string; instantaneous?: string }> {
  "use step";
  try {
    return await fetchGasBundle("intraday", new Date(nowIso), stepAttempt());
  } catch (error) {
    await observeJobFailure(JOB, error, GAS_MAX_RETRIES);
    throw error;
  }
}

export async function validateGasIntradayStep(
  hash: string,
  nowIso: string,
  raw?: string,
  instantaneous?: string,
): Promise<GasStepStatus> {
  "use step";
  try {
    return await validateGasBundle(hash, "intraday", new Date(nowIso), raw, instantaneous);
  } catch (error) {
    await observeJobFailure(JOB, error, GAS_MAX_RETRIES);
    throw error;
  }
}

export async function publishGasIntradayStep(
  hash: string,
  nowIso: string,
  raw?: string,
  instantaneous?: string,
): Promise<GasStepStatus> {
  "use step";
  try {
    const status = await publishGasBundle(hash, "intraday", new Date(nowIso), undefined, raw, instantaneous);
    if (status.ok) {
      await publishMapGasFlows(new Date(nowIso)).catch(() => undefined);
      await recordJobSuccess(JOB, new Date(nowIso));
    }
    return status;
  } catch (error) {
    await observeJobFailure(JOB, error, GAS_MAX_RETRIES);
    throw error;
  }
}

export async function publishCompletedGasDayStep(nowIso: string): Promise<GasStepStatus> {
  "use step";
  const attempt = stepAttempt();
  try {
    const fetched = await fetchGasBundle("completed-day", new Date(nowIso), attempt);
    await validateGasBundle(fetched.hash, "completed-day", new Date(nowIso), fetched.raw);
    return await publishGasBundle(fetched.hash, "completed-day", new Date(nowIso), undefined, fetched.raw);
  } catch (error) {
    if (error instanceof RetryableError && attempt <= GAS_MAX_RETRIES) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "completed gas day failed";
    await recordJobFailure("cron-prices", message);
    console.error("[gas] completed-day kept the previous release");
    return emptyGasStatus();
  }
}

(takeGasSlotStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(fetchGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(validateGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(publishGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(publishCompletedGasDayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
