import { CONSTRAINTS_MAX_RETRIES, type ConstraintsStepStatus } from "@/lib/constraints/budget";
import {
  fetchConstraintsBundle,
  publishConstraintsBundle,
  validateConstraintsBundle,
} from "@/lib/constraints/publish";
import type { ConstraintsBundle } from "@/lib/constraints/release";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

export async function takeConstraintsSlotStep(slot: string, owner: string): Promise<ConstraintsStepStatus> {
  "use step";
  await takeWorkflowSlot("constraints", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchConstraintsStep(bundle: ConstraintsBundle, nowIso: string): Promise<ConstraintsStepStatus> {
  "use step";
  return fetchConstraintsBundle(bundle, new Date(nowIso), stepAttempt());
}

export async function validateConstraintsStep(
  hash: string,
  bundle: ConstraintsBundle,
  nowIso: string,
): Promise<ConstraintsStepStatus> {
  "use step";
  return validateConstraintsBundle(hash, bundle, new Date(nowIso));
}

export async function publishConstraintsStep(
  hash: string,
  bundle: ConstraintsBundle,
  nowIso: string,
): Promise<ConstraintsStepStatus> {
  "use step";
  return publishConstraintsBundle(hash, bundle, new Date(nowIso));
}

(takeConstraintsSlotStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(fetchConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(validateConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
(publishConstraintsStep as { maxRetries?: number }).maxRetries = CONSTRAINTS_MAX_RETRIES;
