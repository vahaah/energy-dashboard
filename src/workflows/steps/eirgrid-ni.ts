import { observeJobFailure } from "@/lib/blob-readback";
import { EIRGRID_MAX_RETRIES, type EirgridStepStatus } from "@/lib/eirgrid/budget";
import type { EirgridFetchBundle } from "@/lib/eirgrid/fetch";
import { fetchNiBundle, publishNiBundle, validateNiBundle, type NiFetchResult } from "@/lib/eirgrid/pipeline";
import { recordJobSuccess } from "@/lib/job-health";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

const JOB = "cron-northern-ireland" as const;

export async function takeNiSlotStep(slot: string, owner: string): Promise<EirgridStepStatus> {
  "use step";
  await takeWorkflowSlot("eirgrid", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchNiStep(nowIso: string): Promise<NiFetchResult> {
  "use step";
  try {
    return await fetchNiBundle(new Date(nowIso));
  } catch (error) {
    await observeJobFailure(JOB, error, EIRGRID_MAX_RETRIES);
    throw error;
  }
}

export async function validateNiStep(hash: string, bundle?: EirgridFetchBundle): Promise<EirgridStepStatus> {
  "use step";
  try {
    return await validateNiBundle(hash, bundle);
  } catch (error) {
    await observeJobFailure(JOB, error, EIRGRID_MAX_RETRIES);
    throw error;
  }
}

export async function publishNiStep(
  hash: string,
  nowIso: string,
  bundle?: EirgridFetchBundle,
): Promise<EirgridStepStatus> {
  "use step";
  try {
    const status = await publishNiBundle(hash, new Date(nowIso), bundle);
    await recordJobSuccess(JOB, new Date(nowIso));
    return status;
  } catch (error) {
    await observeJobFailure(JOB, error, EIRGRID_MAX_RETRIES);
    throw error;
  }
}

(takeNiSlotStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(fetchNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(validateNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(publishNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
