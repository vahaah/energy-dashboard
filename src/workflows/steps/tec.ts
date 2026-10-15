import { TEC_MAX_RETRIES, type TecStepStatus } from "@/lib/projects/budget";
import { fetchTecRegister, publishTecRegister, validateTecRegister } from "@/lib/projects/publish";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

export async function takeTecSlotStep(slot: string, owner: string): Promise<TecStepStatus> {
  "use step";
  await takeWorkflowSlot("tec", slot, owner);
  return { ok: true, rows: 0, bytes: 0, hash: "", releaseId: "" };
}

export async function fetchTecStep(nowIso: string): Promise<TecStepStatus> {
  "use step";
  return fetchTecRegister(new Date(nowIso), stepAttempt());
}

export async function validateTecStep(hash: string, nowIso: string): Promise<TecStepStatus> {
  "use step";
  return validateTecRegister(hash, new Date(nowIso));
}

export async function publishTecStep(hash: string, nowIso: string): Promise<TecStepStatus> {
  "use step";
  return publishTecRegister(hash, new Date(nowIso));
}

(takeTecSlotStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(fetchTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(validateTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
(publishTecStep as { maxRetries?: number }).maxRetries = TEC_MAX_RETRIES;
