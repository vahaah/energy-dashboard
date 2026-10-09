import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  buildHistoricPeriodView,
  historicRecordsSql,
  historicWeeklySql,
  NESO_HISTORIC_SQL_URL,
  parseNesoHistoricRow,
  rowsInLastYear,
  type GridRecords,
  type HistoricPeriodView,
  type NesoHistoricRow,
  computeRecords,
} from "@/lib/historic-mix";
import type { DashboardPeriod } from "@/lib/dashboard-period";

export const NESO_HISTORIC_REVALIDATE_SECONDS = 86_400;
export const NESO_HISTORIC_CACHE_TAG = "neso-historic";

type NesoSqlResponse = {
  success?: boolean;
  result?: { records?: Record<string, unknown>[] };
  error?: { message?: string };
};

async function fetchNesoSql(sql: string): Promise<NesoHistoricRow[]> {
  const url = `${NESO_HISTORIC_SQL_URL}?sql=${encodeURIComponent(sql)}`;
  const init: RequestInit & { next: { revalidate: number; tags: string[] } } = {
    next: { revalidate: NESO_HISTORIC_REVALIDATE_SECONDS, tags: [NESO_HISTORIC_CACHE_TAG] },
    signal: AbortSignal.timeout(45_000),
  };
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`NESO historic mix HTTP ${response.status}`);
  }

  const json = (await response.json()) as NesoSqlResponse;
  if (json.success === false) {
    return [];
  }

  const rows: NesoHistoricRow[] = [];
  for (const raw of json.result?.records ?? []) {
    const row = parseNesoHistoricRow(raw);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

const cachedWeeklyRows = unstable_cache(
  async () => fetchNesoSql(historicWeeklySql()),
  ["neso-historic-weekly"],
  { revalidate: NESO_HISTORIC_REVALIDATE_SECONDS, tags: [NESO_HISTORIC_CACHE_TAG] }
);

const cachedRecordRows = unstable_cache(
  async () => fetchNesoSql(historicRecordsSql()),
  ["neso-historic-records"],
  { revalidate: NESO_HISTORIC_REVALIDATE_SECONDS, tags: [NESO_HISTORIC_CACHE_TAG] }
);

export const getHistoricWeeklyRows = cache(async (): Promise<NesoHistoricRow[]> => {
  return cachedWeeklyRows();
});

export const getGridRecords = cache(async (now = new Date()): Promise<GridRecords> => {
  const rows = await cachedRecordRows();
  return computeRecords(rows, now);
});

export const getHistoricPeriodView = cache(
  async (period: Extract<DashboardPeriod, "year" | "all">, now = new Date()): Promise<HistoricPeriodView> => {
    const weekly = await getHistoricWeeklyRows();
    const scoped = period === "year" ? rowsInLastYear(weekly, now) : weekly;
    return buildHistoricPeriodView(scoped);
  }
);
