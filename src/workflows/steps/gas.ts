import { RetryableError } from "workflow";
import { emptyGasStatus, GAS_MAX_RETRIES, type GasStepStatus } from "@/lib/gas/budget";
import { fetchGasBundle, publishGasBundle, validateGasBundle } from "@/lib/gas/pipeline";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

export async function takeGasSlotStep(slot: string, owner: string): Promise<GasStepStatus> {
  "use step";
  await takeWorkflowSlot("gas", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchGasIntradayStep(nowIso: string): Promise<GasStepStatus> {
  "use step";
  return fetchGasBundle("intraday", new Date(nowIso), stepAttempt());
}

export async function validateGasIntradayStep(hash: string, nowIso: string): Promise<GasStepStatus> {
  "use step";
  return validateGasBundle(hash, "intraday", new Date(nowIso));
}

export async function publishGasIntradayStep(hash: string, nowIso: string): Promise<GasStepStatus> {
  "use step";
  return publishGasBundle(hash, "intraday", new Date(nowIso));
}

export async function publishCompletedGasDayStep(nowIso: string): Promise<GasStepStatus> {
  "use step";
  const attempt = stepAttempt();
  try {
    const fetched = await fetchGasBundle("completed-day", new Date(nowIso), attempt);
    await validateGasBundle(fetched.hash, "completed-day", new Date(nowIso));
    return await publishGasBundle(fetched.hash, "completed-day", new Date(nowIso));
  } catch (error) {
    if (error instanceof RetryableError && attempt <= GAS_MAX_RETRIES) {
      throw error;
    }
    console.error("[gas] completed-day kept the previous release");
    return emptyGasStatus();
  }
}

(takeGasSlotStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(fetchGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(validateGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(publishGasIntradayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
(publishCompletedGasDayStep as { maxRetries?: number }).maxRetries = GAS_MAX_RETRIES;
