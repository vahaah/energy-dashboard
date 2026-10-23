import { FatalError } from "workflow";
import { resolveLondonWallSequence } from "@/lib/ingest/national-gas/gas-day";
import { getLondonDate, yesterdayLondonDate } from "@/lib/london-time";
import {
  EIRGRID_FETCH_TIMEOUT_MS,
  EIRGRID_MIN_GAP_MS,
  EIRGRID_REQUEST_RETRIES,
} from "@/lib/eirgrid/budget";
import { eirgridStampToWall } from "@/lib/eirgrid/parse";
import { CHART_AREAS, EIRGRID_CHART_ORIGIN, EIRGRID_SERIES, geographyFromFeedRegion } from "@/lib/eirgrid/spec";

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

export type EirgridPartFailure = {
  part: EirgridPartId;
  reason: string;
};

export type EirgridFetchBundle = {
  retrieved_at: string;
  charts: Record<string, string>;
  interconnection: Record<string, string>;
  fuel: Record<string, string>;
  snsp: string;
  market: string;
  /** Parts whose own retries were exhausted, that failed with a non-retryable status, or that returned no valued rows. */
  failed_parts?: EirgridPartId[];
  /** Same parts as `failed_parts`, with the timeout, status, or zero-row reason. */
  part_failures?: EirgridPartFailure[];
  /**
   * Chart metrics whose own area request failed or returned none of that area's fields.
   * The combined chart call drops series, so each area is fetched alone and a miss is carried.
   */
  carry_metric_ids?: string[];
  /** ISO publisher time for a chart area that returned its own field. Absent areas keep the previous stamp. */
  chart_area_updated?: Record<string, string>;
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
  const failures: EirgridPartFailure[] = [];
  const carry = new Set<string>();
  const areaUpdated = new Map<string, string>();
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
      const body = await getTextWithRetry(url, fetchImpl, sleep, random);
      if (valuedFeedRows(body) === 0) {
        failures.push({ part, reason: "zero rows" });
        return null;
      }
      return body;
    } catch (error) {
      if (!isPartFailure(error)) {
        throw error;
      }
      failures.push({ part, reason: failureReason(error) });
      return null;
    }
  };
  /** One area per request. A combined `areas` list drops fields, including NI demand, on a 200. */
  const takeChart = async (region: (typeof REGIONS)[number]): Promise<string | null> => {
    const rows: ChartFeedRow[] = [];
    const seen = new Set<string>();
    let succeeded = 0;
    let httpFailed = false;
    let reason = "zero rows";
    let regionStamp: { iso: string; raw: string } | null = null;
    for (const area of CHART_AREAS) {
      await pace();
      let body: string;
      try {
        body = await getTextWithRetry(chartUrl(region, from, to, area), fetchImpl, sleep, random);
      } catch (error) {
        if (!isPartFailure(error)) {
          throw error;
        }
        httpFailed = true;
        reason = failureReason(error);
        for (const metricId of metricIdsForArea(region, area)) {
          carry.add(metricId);
        }
        continue;
      }
      const kept = rowsForChartArea(body, region, area);
      if (kept.rows.length === 0) {
        for (const metricId of metricIdsForArea(region, area)) {
          carry.add(metricId);
        }
        continue;
      }
      succeeded += 1;
      if (kept.updated && (!areaUpdated.get(area) || kept.updated.iso > (areaUpdated.get(area) ?? ""))) {
        areaUpdated.set(area, kept.updated.iso);
      }
      if (kept.updated && (!regionStamp || kept.updated.iso > regionStamp.iso)) {
        regionStamp = kept.updated;
      }
      for (const row of kept.rows) {
        const key = `${String(row.Region)}|${String(row.FieldName)}|${String(row.EffectiveTime)}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        rows.push(row);
      }
    }
    // A region whose every area missed counts as that chart part. A partial region only carries the missed metrics.
    if (succeeded === 0) {
      failures.push({ part: `chart:${region}`, reason: httpFailed ? reason : "zero rows" });
      return null;
    }
    return JSON.stringify({
      ...(regionStamp ? { LastUpdated: regionStamp.raw } : {}),
      Rows: rows,
    });
  };
  for (const region of REGIONS) {
    const chart = await takeChart(region);
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
  const market = await take("market", marketUrl(from, to));
  if (failures.length === EIRGRID_PART_IDS.length) {
    throw new FatalError("EirGrid requests failed");
  }
  return {
    retrieved_at: now.toISOString(),
    charts,
    interconnection,
    fuel,
    snsp: snsp ?? "",
    market: market ?? "",
    failed_parts: failures.map((failure) => failure.part),
    part_failures: failures,
    carry_metric_ids: [...carry],
    chart_area_updated: Object.fromEntries(areaUpdated),
  };
}

type ChartFeedRow = {
  EffectiveTime?: unknown;
  FieldName?: unknown;
  Region?: unknown;
  Value?: unknown;
};

function metricIdsForArea(region: string, area: string): string[] {
  const geography = geographyFromFeedRegion(region);
  if (!geography) {
    return [];
  }
  return EIRGRID_SERIES.filter((series) => series.geography_id === geography && series.area === area).map(
    (series) => series.metric_id,
  );
}

function publishedIso(stamp: string): string | null {
  const wall = eirgridStampToWall(stamp);
  if (!wall) {
    return null;
  }
  return resolveLondonWallSequence([wall])[0]?.toISOString() ?? null;
}

function rowsForChartArea(
  body: string,
  region: string,
  area: string,
): { rows: ChartFeedRow[]; updated: { iso: string; raw: string } | null } {
  const fields = new Set(metricIdsForArea(region, area).map((metricId) => {
    return EIRGRID_SERIES.find((series) => series.metric_id === metricId)?.field ?? "";
  }));
  let parsed: { LastUpdated?: unknown; Rows?: unknown };
  try {
    parsed = JSON.parse(body) as { LastUpdated?: unknown; Rows?: unknown };
  } catch {
    return { rows: [], updated: null };
  }
  const source = Array.isArray(parsed.Rows) ? (parsed.Rows as ChartFeedRow[]) : [];
  const rows = source.filter((row) => {
    return row.Region === region && typeof row.FieldName === "string" && fields.has(row.FieldName);
  });
  const valued = rows.some((row) => typeof row.Value === "number" && Number.isFinite(row.Value));
  if (!valued) {
    return { rows: [], updated: null };
  }
  const raw = typeof parsed.LastUpdated === "string" ? parsed.LastUpdated : null;
  const fromStamp = raw ? publishedIso(raw) : null;
  if (raw && fromStamp) {
    return { rows, updated: { iso: fromStamp, raw } };
  }
  let updated: { iso: string; raw: string } | null = null;
  for (const row of rows) {
    if (typeof row.EffectiveTime !== "string" || typeof row.Value !== "number" || !Number.isFinite(row.Value)) {
      continue;
    }
    const iso = publishedIso(row.EffectiveTime);
    if (!iso) {
      continue;
    }
    if (!updated || iso > updated.iso) {
      updated = { iso, raw: row.EffectiveTime };
    }
  }
  return { rows, updated };
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

/**
 * Chart API, same ISO window as the other areas.
 * `DashboardService.svc/data` with a date-only `dateto` stops at midnight on that
 * Irish day (23:00Z during summer time) and 503s if `dateto` is tomorrow.
 */
function snspUrl(from: string, to: string): string {
  return chartUrl("ALL", from, to, "SnspAll");
}

/** Full settlement-period series. The NI page table can stop one period earlier. */
function marketUrl(from: string, to: string): string {
  return chartUrl("ALL", from, to, "imbalancePrice,imbalanceVolume");
}

/** Rows with a finite `Value`. Null when the body is not a `{ Rows }` document. */
export function valuedFeedRows(body: string): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || !("Rows" in parsed)) {
    return null;
  }
  const rows = (parsed as { Rows?: unknown }).Rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }
    const value = (row as { Value?: unknown }).Value;
    return typeof value === "number" && Number.isFinite(value);
  }).length;
}

function failureReason(error: unknown): string {
  if (error instanceof EirgridHttpError) {
    return `HTTP ${error.status}`;
  }
  if (isEirgridDeadline(error)) {
    return "timeout";
  }
  if (error instanceof FatalError || error instanceof Error) {
    return error.message.length > 0 ? error.message : error.name;
  }
  return "request failed";
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
