import { EIRGRID_MAX_RETRIES, type EirgridStepStatus } from "@/lib/eirgrid/budget";
import { fetchNiBundle, publishNiBundle, validateNiBundle } from "@/lib/eirgrid/pipeline";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

export async function takeNiSlotStep(slot: string, owner: string): Promise<EirgridStepStatus> {
  "use step";
  await takeWorkflowSlot("eirgrid", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchNiStep(nowIso: string): Promise<EirgridStepStatus> {
  "use step";
  return fetchNiBundle(new Date(nowIso), stepAttempt());
}

export async function validateNiStep(hash: string): Promise<EirgridStepStatus> {
  "use step";
  return validateNiBundle(hash);
}

export async function publishNiStep(hash: string, nowIso: string): Promise<EirgridStepStatus> {
  "use step";
  return publishNiBundle(hash, new Date(nowIso));
}

(takeNiSlotStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(fetchNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(validateNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
(publishNiStep as { maxRetries?: number }).maxRetries = EIRGRID_MAX_RETRIES;
