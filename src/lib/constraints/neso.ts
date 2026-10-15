import { FatalError, RetryableError } from "workflow";
import { NESO_MIN_GAP_MS } from "@/lib/constraints/budget";
import { breakdownResourceName, nesoFinancialYear } from "@/lib/constraints/parse";
import type { ConstraintsBundle } from "@/lib/constraints/release";

export const NESO_BREAKDOWN_PACKAGE_URL =
  "https://api.neso.energy/api/3/action/package_show?id=constraint-breakdown";
export const NESO_DAY_AHEAD_PACKAGE_URL =
  "https://api.neso.energy/api/3/action/package_show?id=day-ahead-constraint-flows-and-limits";
export const DAY_AHEAD_RESOURCE_NAME = "Day Ahead Constraint Flows and Limits";

export type NesoResource = {
  name: string;
  format: string;
  url: string;
  last_modified: string | null;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class ConstraintsHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`NESO HTTP ${status}`);
    this.name = "ConstraintsHttpError";
    this.status = status;
  }
}

export function isRetryableConstraintsStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

export function packageUrl(bundle: ConstraintsBundle): string {
  switch (bundle) {
    case "breakdown":
      return NESO_BREAKDOWN_PACKAGE_URL;
    case "day-ahead":
      return NESO_DAY_AHEAD_PACKAGE_URL;
    default: {
      const exhaustive: never = bundle;
      return exhaustive;
    }
  }
}

export function ckanInstant(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z?$/.exec(value);
  if (!match?.[1]) {
    return null;
  }
  const fraction = (match[2] ?? "0").slice(0, 3).padEnd(3, "0");
  const instant = `${match[1]}.${fraction}Z`;
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== instant) {
    return null;
  }
  return instant;
}

export function selectNesoResource(
  resources: readonly NesoResource[],
  name: string,
): NesoResource | null {
  const matches = resources.filter(
    (resource) => resource.format.toUpperCase() === "CSV" && resource.name === name && resource.url.startsWith("https://api.neso.energy/"),
  );
  if (matches.length !== 1) {
    return null;
  }
  return matches[0] ?? null;
}

export function resourceNameFor(bundle: ConstraintsBundle, now: Date): string {
  switch (bundle) {
    case "breakdown":
      return breakdownResourceName(nesoFinancialYear(now));
    case "day-ahead":
      return DAY_AHEAD_RESOURCE_NAME;
    default: {
      const exhaustive: never = bundle;
      return exhaustive;
    }
  }
}

let lastNesoRequestAt = 0;

export function resetNesoPaceForTests(): void {
  lastNesoRequestAt = 0;
}

/** At most two NESO calls a minute inside this process. */
export async function paceNeso(gapMs = NESO_MIN_GAP_MS, now = Date.now()): Promise<void> {
  const wait = lastNesoRequestAt + gapMs - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    lastNesoRequestAt = Date.now();
    return;
  }
  lastNesoRequestAt = now;
}

export function constraintsRetryAfter(attempt: number, now = Date.now()): Date {
  const base = attempt <= 1 ? 30_000 : 120_000;
  const jitter = Math.floor(Math.random() * 10_000);
  return new Date(now + base + jitter);
}

export function constraintsStepError(error: unknown, attempt: number, maxRetries: number): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }
  const retryable = error instanceof ConstraintsHttpError && isRetryableConstraintsStatus(error.status);
  const message = error instanceof ConstraintsHttpError ? error.message : "NESO request failed";
  if (!retryable || attempt > maxRetries) {
    return new FatalError(message);
  }
  return new RetryableError(message, { retryAfter: constraintsRetryAfter(attempt) });
}
