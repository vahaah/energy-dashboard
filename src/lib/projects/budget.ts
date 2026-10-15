/** Workflow-bundle constants. This module imports nothing. */

export const TEC_MAX_RETRIES = 2;
export const TEC_WORKFLOW_STEPS = 4;
export const TEC_WORKFLOW_EVENTS_PER_RUN = 1 + TEC_WORKFLOW_STEPS * 2;

/** Monday and Thursday. */
export const TEC_RUNS_PER_WEEK = 2;

/** One package lookup and one CSV, paced at or under 2 requests a minute. */
export const TEC_NESO_REQUESTS_PER_RUN = 2;

export const TEC_TINYBIRD_OPS = 0;

export type TecStepStatus = {
  ok: boolean;
  rows: number;
  bytes: number;
  hash: string;
  releaseId: string;
};

export function emptyTecStatus(): TecStepStatus {
  return { ok: false, rows: 0, bytes: 0, hash: "", releaseId: "" };
}
