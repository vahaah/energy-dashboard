import { FatalError } from "workflow";
import { getLondonDate, yesterdayLondonDate } from "@/lib/london-time";
import {
  EIRGRID_FETCH_TIMEOUT_MS,
  EIRGRID_MIN_GAP_MS,
  EIRGRID_REQUEST_RETRIES,
} from "@/lib/eirgrid/budget";
import { CHART_AREAS, EIRGRID_CHART_ORIGIN } from "@/lib/eirgrid/spec";

const REGIONS = ["NI", "ROI", "ALL"] as const;

export const EIRGRID_PART_IDS = [
  "chart:NI",
  "interconnection:NI",
  "fuel:NI",
  "chart:ROI",
  "interconnection:ROI",
  "fuel:ROI",
  "chart:ALL",
  "interconnection:ALL",
  "fuel:ALL",
  "snsp",
  "market",
] as const;

export type EirgridPartId = (typeof EIRGRID_PART_IDS)[number];

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
  /** Parts whose own retries were exhausted, or that failed with a non-retryable status. */
  failed_parts?: EirgridPartId[];
};

export type EirgridFetchOptions = {
  fetchImpl?: typeof fetch;
  gapMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export function failedPartIds(bundle: EirgridFetchBundle): EirgridPartId[] {
  if (!Array.isArray(bundle.failed_parts)) {
    return [];
  }
  return bundle.failed_parts.filter((part): part is EirgridPartId =>
    (EIRGRID_PART_IDS as readonly string[]).includes(part),
  );
}

/** 1s then 2s, plus up to 250ms. Held inside the step, so it is not the old 30s/120s suspension. */
export function eirgridRequestBackoffMs(attempt: number, random: () => number = Math.random): number {
  const base = 1_000 * 2 ** Math.max(0, attempt - 1);
  return base + Math.floor(random() * 250);
}

function isEirgridDeadline(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) {
    return false;
  }
  if ("name" in error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }
  return "cause" in error && isEirgridDeadline(error.cause, depth + 1);
}

function isPartFailure(error: unknown): boolean {
  return error instanceof FatalError || error instanceof EirgridHttpError || isEirgridDeadline(error);
}

function isEirgridRequestRetryable(error: unknown): boolean {
  if (isEirgridDeadline(error)) {
    return true;
  }
  return error instanceof EirgridHttpError && (error.status === 429 || error.status >= 500);
}

export async function fetchEirgridBundle(now: Date, options: EirgridFetchOptions = {}): Promise<EirgridFetchBundle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const gapMs = options.gapMs ?? EIRGRID_MIN_GAP_MS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const from = yesterdayLondonDate(now);
  const to = getLondonDate(now);
  const charts: Record<string, string> = {};
  const interconnection: Record<string, string> = {};
  const fuel: Record<string, string> = {};
  const failed: EirgridPartId[] = [];
  let first = true;
  const pace = async () => {
    if (first) {
      first = false;
      return;
    }
    if (gapMs > 0) {
      await sleep(gapMs);
    }
  };
  const take = async (part: EirgridPartId, url: string): Promise<string | null> => {
    await pace();
    try {
      return await getTextWithRetry(url, fetchImpl, sleep, random);
    } catch (error) {
      if (!isPartFailure(error)) {
        throw error;
      }
      failed.push(part);
      return null;
    }
  };
  for (const region of REGIONS) {
    const chart = await take(`chart:${region}`, chartUrl(region, from, to, CHART_AREAS.join(",")));
    if (chart != null) {
      charts[region] = chart;
    }
    const link = await take(`interconnection:${region}`, chartUrl(region, from, to, "interconnection"));
    if (link != null) {
      interconnection[region] = link;
    }
    const mix = await take(`fuel:${region}`, fuelUrl(region));
    if (mix != null) {
      fuel[region] = mix;
    }
  }
  const snsp = await take("snsp", snspUrl(from, to));
  const market = await take("market", `${EIRGRID_CHART_ORIGIN}/ni/market-pricing/`);
  if (failed.length === EIRGRID_PART_IDS.length) {
    throw new FatalError("EirGrid requests failed");
  }
  return {
    retrieved_at: now.toISOString(),
    charts,
    interconnection,
    fuel,
    snsp: snsp ?? "",
    market: market ?? "",
    failed_parts: failed,
  };
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

async function getTextWithRetry(
  url: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
): Promise<string> {
  for (let attempt = 1; attempt <= EIRGRID_REQUEST_RETRIES + 1; attempt += 1) {
    try {
      return await getText(url, fetchImpl);
    } catch (error) {
      if (!isEirgridRequestRetryable(error) || attempt > EIRGRID_REQUEST_RETRIES) {
        throw error;
      }
      await sleep(eirgridRequestBackoffMs(attempt, random));
    }
  }
  throw new FatalError("EirGrid request failed");
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
