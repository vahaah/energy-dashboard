/** Workflow-bundle constants. This module imports nothing. */

export const EIRGRID_MAX_RETRIES = 2;

export const EIRGRID_WORKFLOW_STEPS = 4;

export const EIRGRID_WORKFLOW_EVENTS_PER_RUN = 1 + EIRGRID_WORKFLOW_STEPS * 2;

/** Hourly cron. One run an hour. */
export const EIRGRID_RUNS_PER_DAY = 24;

export const EIRGRID_TINYBIRD_OPS = 0;

export const EIRGRID_MIN_GAP_MS = 1_500;

export type EirgridStepStatus = {
  ok: boolean;
  rows: number;
  bytes: number;
  hash: string;
  releaseId: string;
};

export function emptyEirgridStatus(): EirgridStepStatus {
  return { ok: false, rows: 0, bytes: 0, hash: "", releaseId: "" };
}
