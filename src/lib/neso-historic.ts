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

export function nesoSqlRequestInit(sql: string): RequestInit & {
  next: { revalidate: number; tags: string[] };
} {
  return {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql }),
    next: { revalidate: NESO_HISTORIC_REVALIDATE_SECONDS, tags: [NESO_HISTORIC_CACHE_TAG] },
    signal: AbortSignal.timeout(45_000),
  };
}

let nesoFetchTail: Promise<void> = Promise.resolve();

async function fetchNesoSql(sql: string): Promise<NesoHistoricRow[]> {
  const run = nesoFetchTail.then(async () => {
    const response = await fetch(NESO_HISTORIC_SQL_URL, nesoSqlRequestInit(sql));
    if (!response.ok) {
      throw new Error(`NESO historic mix HTTP ${response.status}`);
    }

    const json = (await response.json()) as NesoSqlResponse;
    if (json.success === false) {
      throw new Error(json.error?.message ?? "NESO historic mix query failed");
    }

    const rows: NesoHistoricRow[] = [];
    for (const raw of json.result?.records ?? []) {
      const row = parseNesoHistoricRow(raw);
      if (row) {
        rows.push(row);
      }
    }
    return rows;
  });
  nesoFetchTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
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
  await getHistoricWeeklyRows();
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
