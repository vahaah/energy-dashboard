import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  buildHistoricPeriodView,
  computeRecords,
  emptyRecordsWithDocumentedCoal,
  historicRecordsSql,
  historicWeeklySql,
  NESO_HISTORIC_SQL_URL,
  parseNesoHistoricRow,
  rowsInLastYear,
  rowsSinceHistoricStart,
  type GridRecords,
  type HistoricPeriodView,
  type NesoHistoricRow,
} from "@/lib/historic-mix";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { readSnapshotIntegrity } from "@/lib/snapshot-integrity";
import { historicalCachePolicy } from "@/lib/tinybird-cache";
import { externalCacheKey, readThroughCache } from "@/lib/redis-cache";

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

function cachedRecordRows(excludeTimestamps: string[]) {
  return unstable_cache(
    async () => fetchNesoSql(historicRecordsSql(excludeTimestamps)),
    ["neso-historic-records", ...excludeTimestamps],
    { revalidate: NESO_HISTORIC_REVALIDATE_SECONDS, tags: [NESO_HISTORIC_CACHE_TAG] }
  )();
}

export const getHistoricWeeklyRows = cache(async (): Promise<NesoHistoricRow[]> => {
  return readThroughCache(
    externalCacheKey("neso-historic", ["weekly"]),
    historicalCachePolicy(),
    () => cachedWeeklyRows()
  );
});

export const getGridRecords = cache(async (now = new Date()): Promise<GridRecords> => {
  try {
    await getHistoricWeeklyRows();
    const stored = await readSnapshotIntegrity();
    const excludeTimestamps = stored?.failingTimestamps ?? [];
    const rows = await readThroughCache(
      externalCacheKey("neso-historic", ["records", ...excludeTimestamps]),
      historicalCachePolicy(),
      () => cachedRecordRows(excludeTimestamps)
    );
    return computeRecords(rows, now, excludeTimestamps);
  } catch {
    return emptyRecordsWithDocumentedCoal(now);
  }
});

export const getHistoricPeriodView = cache(
  async (period: Extract<DashboardPeriod, "year" | "all">, now = new Date()): Promise<HistoricPeriodView> => {
    const weekly = await getHistoricWeeklyRows();
    const scoped = period === "year" ? rowsInLastYear(weekly, now) : rowsSinceHistoricStart(weekly);
    return buildHistoricPeriodView(scoped);
  }
);
