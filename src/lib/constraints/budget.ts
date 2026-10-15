/**
 * Workflow-bundle constants. This module imports nothing.
 * The workflow VM keeps the module-scope `maxRetries` assignment, so these
 * values cannot live next to Node, Blob, or `next/cache` imports.
 */

/** One initial attempt plus two retries. The next failure is fatal and leaves the pointer. */
export const CONSTRAINTS_MAX_RETRIES = 2;

/** Slot, fetch, validate, publish. */
export const CONSTRAINTS_WORKFLOW_STEPS = 4;

/** One run plus each step's start and result. */
export const CONSTRAINTS_WORKFLOW_EVENTS_PER_RUN = 1 + CONSTRAINTS_WORKFLOW_STEPS * 2;

/** Breakdown every day, day-ahead on weekdays. About 12 runs a week, about 2 a day. */
export const CONSTRAINTS_BREAKDOWN_RUNS_PER_DAY = 1;
export const CONSTRAINTS_DAY_AHEAD_RUNS_PER_WEEK = 5;
export const CONSTRAINTS_RUNS_PER_DAY = CONSTRAINTS_BREAKDOWN_RUNS_PER_DAY + CONSTRAINTS_DAY_AHEAD_RUNS_PER_WEEK / 7;

/** Each run is one package lookup and one CSV, paced at or under 2 requests a minute. */
export const NESO_DATASTORE_MAX_PER_MINUTE = 2;
export const NESO_MIN_GAP_MS = 60_000 / NESO_DATASTORE_MAX_PER_MINUTE;

export const CONSTRAINTS_TINYBIRD_OPS = 0;

export type ConstraintsStepStatus = {
  ok: boolean;
  rows: number;
  bytes: number;
  hash: string;
  releaseId: string;
};

export function emptyConstraintsStatus(): ConstraintsStepStatus {
  return { ok: false, rows: 0, bytes: 0, hash: "", releaseId: "" };
}
