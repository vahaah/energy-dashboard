import { observeJobFailure } from "@/lib/blob-readback";
import { CONSTRAINTS_MAX_RETRIES, type ConstraintsStepStatus } from "@/lib/constraints/budget";
import {
  fetchConstraintsBundle,
  publishConstraintsBundle,
  validateConstraintsBundle,
  type ConstraintsFetchResult,
} from "@/lib/constraints/publish";
import type { ConstraintsBundle, FetchMeta } from "@/lib/constraints/release";
import { recordJobSuccess } from "@/lib/job-health";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

const JOB = "cron-constraints" as const;

export async function takeConstraintsSlotStep(slot: string, owner: string): Promise<ConstraintsStepStatus> {
  "use step";
  await takeWorkflowSlot("constraints", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchConstraintsStep(bundle: ConstraintsBundle, nowIso: string): Promise<ConstraintsFetchResult> {
  "use step";
  try {
    return await fetchConstraintsBundle(bundle, new Date(nowIso), stepAttempt());
  } catch (error) {
    await observeJobFailure(JOB, error, CONSTRAINTS_MAX_RETRIES);
    throw error;
  }
}

export async function validateConstraintsStep(
  hash: string,
  bundle: ConstraintsBundle,
  nowIso: string,
  raw?: string,
  meta?: FetchMeta,
): Promise<ConstraintsStepStatus> {
  "use step";
  try {
    return await validateConstraintsBundle(hash, bundle, new Date(nowIso), raw, meta);
  } catch (error) {
    await observeJobFailure(JOB, error, CONSTRAINTS_MAX_RETRIES);
    throw error;
  }
}

export async function publishConstraintsStep(
  hash: string,
  bundle: ConstraintsBundle,
  nowIso: string,
  raw?: string,
  meta?: FetchMeta,
): Promise<ConstraintsStepStatus> {
  "use step";
  try {
    const status = await publishConstraintsBundle(hash, bundle, new Date(nowIso), raw, meta);
    await recordJobSuccess(JOB, new Date(nowIso));
    return status;
  } catch (error) {
    await observeJobFailure(JOB, error, CONSTRAINTS_MAX_RETRIES);
    throw error;
  }
}

(takeConstraintsSlotStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(fetchConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(validateConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(publishConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
