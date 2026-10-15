/**
 * Workflow-bundle constants. This module imports nothing.
 * The workflow VM keeps the module-scope `maxRetries` assignment, so these
 * values cannot live next to Node, Blob, or `next/cache` imports.
 */

/** One initial attempt plus two retries. The next failure is fatal and leaves the pointer. */
export const GAS_MAX_RETRIES = 2;

/**
 * Intraday workflow events on the success path.
 * One run plus four steps, and each step records a start and a result: 9.
 * 24 hourly runs is 216. Completed-day is one step on the existing prices workflow.
 */
export const GAS_WORKFLOW_STEPS = 4;
export const GAS_WORKFLOW_EVENTS_PER_RUN = 1 + GAS_WORKFLOW_STEPS * 2;
export const GAS_INTRADAY_RUNS_PER_DAY = 24;
export const GAS_WORKFLOW_EVENTS_PER_DAY = GAS_WORKFLOW_EVENTS_PER_RUN * GAS_INTRADAY_RUNS_PER_DAY;
export const GAS_COMPLETED_DAY_RUNS_PER_DAY = 4;
export const GAS_TINYBIRD_OPS = 0;

export type GasStepStatus = {
  ok: boolean;
  rows: number;
  bytes: number;
  hash: string;
  releaseId: string;
};

export function emptyGasStatus(): GasStepStatus {
  return { ok: false, rows: 0, bytes: 0, hash: "", releaseId: "" };
}
