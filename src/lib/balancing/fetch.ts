import { balancingResourceName, financialYearId, financialYearsInRange } from "@/lib/balancing/aggregate";
import { costSql, parseCostRecords, parseTariffRecords, parseTradeDays, priceIndex, tariffSql, type NesoCostRecord, type NesoTariffRecord, type FuelHourRow, type PriceRow } from "@/lib/balancing/parse";
import type { BalancingDay, BalancingTariff, TradeDay } from "@/lib/balancing/types";
import { addUtcDays, londonMidnightUtc } from "@/lib/london-time";

export const BALANCING_FETCH_TIMEOUT_MS = 25_000;
export const BALANCING_FETCH_RETRIES = 2;
export const BALANCING_BACKOFF_MS = [200, 800] as const;
export const NESO_MIN_GAP_MS = 30_000;
export const ELEXON_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const NESO_COSTS_PACKAGE = "daily-balancing-costs-balancing-services-use-of-system";
export const NESO_TARIFF_PACKAGE = "bsuos-fixed-tariffs";
export const NESO_ACTION = "https://api.neso.energy/api/3/action";
export const ELEXON_FUELHH = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH";
export const ELEXON_MARKET_INDEX = "https://data.elexon.co.uk/bmrs/api/v1/balancing/pricing/market-index";

export class BalancingHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Balancing HTTP ${status}`);
    this.name = "BalancingHttpError";
    this.status = status;
  }
}

export type FetchText = (url: string) => Promise<string>;

export function isRetryableBalancingError(error: unknown): boolean {
  if (error instanceof BalancingHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export async function fetchBounded(url: string, timeoutMs = BALANCING_FETCH_TIMEOUT_MS): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: "application/json",
      "user-agent": "Grid/balancing (https://grid.vahaah.com)",
    },
  });
  if (!response.ok) {
    throw new BalancingHttpError(response.status);
  }
  return response.text();
}

export async function fetchBoundedRetry(
  url: string,
  options?: { timeoutMs?: number; retries?: number; backoffMs?: readonly number[] },
): Promise<string> {
  const retries = options?.retries ?? BALANCING_FETCH_RETRIES;
  const backoff = options?.backoffMs ?? BALANCING_BACKOFF_MS;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchBounded(url, options?.timeoutMs ?? BALANCING_FETCH_TIMEOUT_MS);
    } catch (error) {
      last = error;
      if (!isRetryableBalancingError(error) || attempt === retries) {
        throw error;
      }
      const wait = backoff[Math.min(attempt, backoff.length - 1)] ?? 800;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw last instanceof Error ? last : new Error("Balancing fetch failed");
}

export type NesoResource = {
  id: string;
  name: string;
  format: string;
  last_modified: string | null;
};

type PackageShow = {
  success?: boolean;
  result?: { resources?: Array<Record<string, unknown>> };
};

type SqlShow = {
  success?: boolean;
  result?: { records?: unknown[] };
};

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

export function selectCsvResource(resources: readonly NesoResource[], name: string): NesoResource | null {
  const matches = resources.filter((resource) => resource.format.toUpperCase() === "CSV" && resource.name.trim() === name);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

async function readJson(url: string, fetchText: FetchText): Promise<unknown> {
  return JSON.parse(await fetchText(url)) as unknown;
}

export async function loadNesoResources(packageId: string, fetchText: FetchText): Promise<NesoResource[]> {
  const body = (await readJson(`${NESO_ACTION}/package_show?id=${encodeURIComponent(packageId)}`, fetchText)) as PackageShow;
  if (!body.success || !body.result?.resources) {
    throw new Error(`NESO package ${packageId} has no resources`);
  }
  const resources: NesoResource[] = [];
  for (const resource of body.result.resources) {
    if (typeof resource.id !== "string" || typeof resource.name !== "string") {
      continue;
    }
    resources.push({
      id: resource.id,
      name: resource.name,
      format: typeof resource.format === "string" ? resource.format : "",
      last_modified: typeof resource.last_modified === "string" ? resource.last_modified : null,
    });
  }
  return resources;
}

async function loadSql(sql: string, fetchText: FetchText): Promise<unknown[]> {
  const body = (await readJson(`${NESO_ACTION}/datastore_search_sql?sql=${encodeURIComponent(sql)}`, fetchText)) as SqlShow;
  if (!body.success || !body.result?.records) {
    throw new Error("NESO SQL was rejected");
  }
  if (body.result.records.length >= 10_000) {
    throw new Error("NESO SQL result looks truncated");
  }
  return body.result.records;
}

export async function loadCostDays(
  resourceId: string,
  fetchText: FetchText,
  from?: string,
  to?: string,
): Promise<BalancingDay[]> {
  const records = await loadSql(costSql(resourceId, from, to), fetchText);
  return parseCostRecords(records as NesoCostRecord[]);
}

export async function loadTariffs(resourceId: string, fetchText: FetchText): Promise<BalancingTariff[]> {
  const records = await loadSql(tariffSql(resourceId), fetchText);
  const parsed = parseTariffRecords(records as NesoTariffRecord[]);
  if (parsed.tariffs.length === 0) {
    throw new Error("NESO published no BSUoS tariffs");
  }
  return parsed.tariffs;
}

export type SettlementWindow = { from: string; to: string; fromIso: string; toIso: string };

/** Inclusive settlement-date windows that stay inside Elexon's 7-day limit, including clock-change days. */
export function tradeWindows(start: string, today: string): SettlementWindow[] {
  const windows: SettlementWindow[] = [];
  let from = start;
  while (from <= today) {
    let to = addUtcDays(from, 5);
    if (to > today) {
      to = today;
    }
    let toIso = londonMidnightUtc(addUtcDays(to, 1)).toISOString();
    const fromIso = londonMidnightUtc(from).toISOString();
    while (new Date(toIso).getTime() - new Date(fromIso).getTime() > ELEXON_MAX_WINDOW_MS && to > from) {
      to = addUtcDays(to, -1);
      toIso = londonMidnightUtc(addUtcDays(to, 1)).toISOString();
    }
    windows.push({ from, to, fromIso, toIso });
    from = addUtcDays(to, 1);
  }
  return windows;
}

export function elexonWindow(endDate: string, days: number): SettlementWindow {
  let count = days;
  while (count >= 1) {
    const from = addUtcDays(endDate, -(count - 1));
    const fromIso = londonMidnightUtc(from).toISOString();
    const toIso = londonMidnightUtc(addUtcDays(endDate, 1)).toISOString();
    if (new Date(toIso).getTime() - new Date(fromIso).getTime() <= ELEXON_MAX_WINDOW_MS) {
      return { from, to: endDate, fromIso, toIso };
    }
    count -= 1;
  }
  throw new Error("Elexon window is empty");
}

export async function loadFuelRows(from: string, to: string, fetchText: FetchText): Promise<FuelHourRow[]> {
  const url = `${ELEXON_FUELHH}?settlementDateFrom=${from}&settlementDateTo=${to}&format=json`;
  const body = (await readJson(url, fetchText)) as { data?: FuelHourRow[] };
  return body.data ?? [];
}

export async function loadPriceRows(fromIso: string, toIso: string, fetchText: FetchText): Promise<PriceRow[]> {
  const url = `${ELEXON_MARKET_INDEX}?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&dataProviders=APXMIDP`;
  const body = (await readJson(url, fetchText)) as { data?: PriceRow[] };
  return body.data ?? [];
}

export type DailyWindow = {
  from: string;
  to: string;
  days: BalancingDay[];
  tariffs: BalancingTariff[];
  tradeDays: TradeDay[];
  tradeFrom: string;
  costsIssuedAt: string | null;
  tariffsIssuedAt: string | null;
  unknownFuels: string[];
};

async function pause(ms: number): Promise<void> {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Last 10 settlement dates of costs, the tariff file, and one Elexon window. No Tinybird call. */
export async function collectDailyWindow(
  today: string,
  fetchText: FetchText,
  gapMs = NESO_MIN_GAP_MS,
): Promise<DailyWindow> {
  const from = addUtcDays(today, -9);
  const costResources = await loadNesoResources(NESO_COSTS_PACKAGE, fetchText);
  const days: BalancingDay[] = [];
  let costsIssuedAt: string | null = null;
  for (const year of financialYearsInRange(from, today)) {
    const costResource = selectCsvResource(costResources, balancingResourceName(year));
    if (!costResource) {
      throw new Error("NESO daily balancing cost resource is missing");
    }
    await pause(gapMs);
    const fetched = await loadCostDays(costResource.id, fetchText, from, today);
    days.push(...fetched.filter((day) => financialYearId(day.date) === year && day.date >= from && day.date <= today));
    costsIssuedAt = ckanInstant(costResource.last_modified ?? "") ?? costsIssuedAt;
  }
  await pause(gapMs);
  const tariffResources = await loadNesoResources(NESO_TARIFF_PACKAGE, fetchText);
  const tariffResource = tariffResources.find((resource) => resource.format.toUpperCase() === "CSV");
  if (!tariffResource) {
    throw new Error("NESO BSUoS tariff resource is missing");
  }
  await pause(gapMs);
  const tariffs = await loadTariffs(tariffResource.id, fetchText);
  const trade = elexonWindow(today, 7);
  const fuel = await loadFuelRows(trade.from, trade.to, fetchText);
  const prices = await loadPriceRows(trade.fromIso, trade.toIso, fetchText);
  const parsed = parseTradeDays(fuel, priceIndex(prices));
  return {
    from,
    to: today,
    days,
    tariffs,
    tradeDays: parsed.days.filter((day) => day.date >= trade.from && day.date <= trade.to),
    tradeFrom: trade.from,
    costsIssuedAt,
    tariffsIssuedAt: ckanInstant(tariffResource.last_modified ?? ""),
    unknownFuels: parsed.unknownFuels,
  };
}
