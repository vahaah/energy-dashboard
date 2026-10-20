import { FatalError, RetryableError } from "workflow";
import { getLondonDate, yesterdayLondonDate } from "@/lib/london-time";
import { EIRGRID_MAX_RETRIES, EIRGRID_MIN_GAP_MS } from "@/lib/eirgrid/budget";
import { CHART_AREAS, EIRGRID_CHART_ORIGIN } from "@/lib/eirgrid/spec";

const REGIONS = ["NI", "ROI", "ALL"] as const;

export class EirgridHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`EirGrid responded ${status}`);
    this.name = "EirgridHttpError";
    this.status = status;
  }
}

export type EirgridFetchBundle = {
  retrieved_at: string;
  charts: Record<string, string>;
  interconnection: Record<string, string>;
  fuel: Record<string, string>;
  snsp: string;
  market: string;
};

export function eirgridRetryAfter(attempt: number, now = Date.now()): Date {
  const base = attempt <= 1 ? 30_000 : 120_000;
  const jitter = Math.floor(Math.random() * 10_000);
  return new Date(now + base + jitter);
}

const EIRGRID_FETCH_TIMEOUT_MS = 10_000;

function isEirgridDeadline(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export function eirgridStepError(error: unknown, attempt: number): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }
  const status = error instanceof EirgridHttpError ? error.status : 0;
  const retryable = status === 429 || status >= 500 || isEirgridDeadline(error);
  const message = error instanceof Error ? error.message : "EirGrid request failed";
  if (!retryable) {
    return new FatalError(message);
  }
  if (attempt > EIRGRID_MAX_RETRIES) {
    return new FatalError(message);
  }
  return new RetryableError(message, { retryAfter: eirgridRetryAfter(attempt) });
}

export async function fetchEirgridBundle(
  now: Date,
  attempt: number,
  fetchImpl: typeof fetch = fetch,
  gapMs = EIRGRID_MIN_GAP_MS,
): Promise<EirgridFetchBundle> {
  const from = yesterdayLondonDate(now);
  const to = getLondonDate(now);
  const charts: Record<string, string> = {};
  const interconnection: Record<string, string> = {};
  const fuel: Record<string, string> = {};
  let first = true;
  const pace = async () => {
    if (first) {
      first = false;
      return;
    }
    if (gapMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
  };
  try {
    for (const region of REGIONS) {
      await pace();
      charts[region] = await getText(chartUrl(region, from, to, CHART_AREAS.join(",")), fetchImpl);
      await pace();
      interconnection[region] = await getText(chartUrl(region, from, to, "interconnection"), fetchImpl);
      await pace();
      fuel[region] = await getText(fuelUrl(region), fetchImpl);
    }
    await pace();
    const snsp = await getText(snspUrl(from, to), fetchImpl);
    await pace();
    const market = await getText(`${EIRGRID_CHART_ORIGIN}/ni/market-pricing/`, fetchImpl);
    return { retrieved_at: now.toISOString(), charts, interconnection, fuel, snsp, market };
  } catch (error) {
    throw eirgridStepError(error, attempt);
  }
}

function chartUrl(region: string, from: string, to: string, areas: string): string {
  const params = new URLSearchParams({
    region,
    chartType: "line",
    dateRange: "day",
    dateFrom: from,
    dateTo: to,
    areas,
  });
  return `${EIRGRID_CHART_ORIGIN}/api/chart/?${params.toString()}`;
}

function fuelUrl(region: string): string {
  const params = new URLSearchParams({ area: "fuelmix", region, dateRange: "day" });
  return `${EIRGRID_CHART_ORIGIN}/api/average-fuel-mix/?${params.toString()}`;
}

function snspUrl(from: string, to: string): string {
  const params = new URLSearchParams({
    area: "SnspAll",
    region: "ALL",
    datefrom: isoToFeedDay(from),
    dateto: isoToFeedDay(to),
  });
  return `${EIRGRID_CHART_ORIGIN}/DashboardService.svc/data?${params.toString()}`;
}

function isoToFeedDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}-${names[Number(month) - 1]}-${year}`;
}

async function getText(url: string, fetchImpl: typeof fetch): Promise<string> {
  if (!url.startsWith(`${EIRGRID_CHART_ORIGIN}/`)) {
    throw new FatalError("EirGrid URL is not on the Smart Grid Dashboard");
  }
  const response = await fetchImpl(url, {
    headers: { accept: "application/json,text/html", "user-agent": "Grid/1.0 (+https://grid.vahaah.com)" },
    signal: AbortSignal.timeout(EIRGRID_FETCH_TIMEOUT_MS),
  });
  const body = await response.text();
  if (response.status === 429 || response.status >= 500) {
    throw new EirgridHttpError(response.status);
  }
  if (!response.ok) {
    throw new FatalError(`EirGrid responded ${response.status}`);
  }
  return body;
}
