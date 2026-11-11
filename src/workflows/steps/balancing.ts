import { FatalError, RetryableError } from "workflow";
import { dayTotalPence } from "@/lib/balancing/aggregate";
import { sumCategoryPence } from "@/lib/balancing/categories";
import { collectDailyWindow, fetchBounded, isRetryableBalancingError, type DailyWindow } from "@/lib/balancing/fetch";
import { BALANCING_MAX_RETRIES } from "@/lib/balancing/budget";
import { publishMergedWindow } from "@/lib/balancing/publish";
import { observeJobFailure } from "@/lib/blob-readback";
import { recordJobSuccess } from "@/lib/job-health";
import { getLondonDate } from "@/lib/london-time";
import { stepAttempt } from "@/lib/step-attempt";
import { takeWorkflowSlot } from "@/lib/workflow-slot";

const JOB = "cron-balancing" as const;

function balancingStepError(error: unknown, attempt: number): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }
  const message = error instanceof Error ? error.message : "Balancing request failed";
  if (!isRetryableBalancingError(error) || attempt > BALANCING_MAX_RETRIES) {
    return new FatalError(message);
  }
  const base = attempt <= 1 ? 30_000 : 120_000;
  const jitter = Math.floor(Math.random() * 10_000);
  return new RetryableError(message, { retryAfter: new Date(Date.now() + base + jitter) });
}

export function assertBalancingWindow(window: DailyWindow): void {
  for (const day of window.days) {
    if (dayTotalPence(day) !== sumCategoryPence(day.pence)) {
      throw new FatalError("balancing day does not reconcile");
    }
    if (day.provisional !== day.periods < day.expected_periods) {
      throw new FatalError("provisional flag does not match the period count");
    }
  }
  for (const day of window.tradeDays) {
    for (const country of day.countries) {
      if (country.import_mwh < 0 || country.export_mwh < 0) {
        throw new FatalError("trade flow is signed the wrong way");
      }
    }
  }
}

export async function takeBalancingSlotStep(slot: string, owner: string): Promise<{ ok: true }> {
  "use step";
  await takeWorkflowSlot("balancing", slot, owner);
  return { ok: true };
}

export async function fetchBalancingStep(nowIso: string): Promise<DailyWindow> {
  "use step";
  try {
    return await collectDailyWindow(getLondonDate(new Date(nowIso)), fetchBounded);
  } catch (error) {
    await observeJobFailure(JOB, error, BALANCING_MAX_RETRIES);
    throw balancingStepError(error, stepAttempt());
  }
}

export async function validateBalancingStep(window: DailyWindow): Promise<{ ok: true }> {
  "use step";
  try {
    assertBalancingWindow(window);
    return { ok: true };
  } catch (error) {
    await observeJobFailure(JOB, error, BALANCING_MAX_RETRIES);
    throw error;
  }
}

export async function publishBalancingStep(window: DailyWindow, nowIso: string): Promise<{ ok: true; releaseId: string }> {
  "use step";
  try {
    const published = await publishMergedWindow(window, new Date(nowIso));
    await recordJobSuccess(JOB, new Date(nowIso));
    return { ok: true, releaseId: published.releaseId };
  } catch (error) {
    await observeJobFailure(JOB, error, BALANCING_MAX_RETRIES);
    throw error;
  }
}

(takeBalancingSlotStep as { maxRetries?: number }).maxRetries = BALANCING_MAX_RETRIES;
(fetchBalancingStep as { maxRetries?: number }).maxRetries = BALANCING_MAX_RETRIES;
(validateBalancingStep as { maxRetries?: number }).maxRetries = BALANCING_MAX_RETRIES;
(publishBalancingStep as { maxRetries?: number }).maxRetries = BALANCING_MAX_RETRIES;
