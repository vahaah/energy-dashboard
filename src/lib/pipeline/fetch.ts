/** Hard timeout for the REPD extract download. The page build does not call this. */
export const PIPELINE_FETCH_TIMEOUT_MS = 30_000;

export const PIPELINE_FETCH_ATTEMPTS = 3;

/** Delay before the next attempt. Null when the attempt budget is spent. */
export function pipelineRetryDelayMs(failedAttempt: number): number | null {
  if (failedAttempt >= PIPELINE_FETCH_ATTEMPTS) {
    return null;
  }
  if (failedAttempt <= 1) {
    return 2_000;
  }
  return 8_000;
}

export function pipelineStatusRetries(status: number): boolean {
  return status === 429 || status >= 500;
}
