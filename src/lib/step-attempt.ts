import { getStepMetadata } from "workflow";

/** 1 outside the workflow runtime, where step metadata is unavailable. */
export function stepAttempt(): number {
  try {
    return getStepMetadata().attempt;
  } catch {
    return 1;
  }
}
