/**
 * Tinybird client for both ingestion (Events API) and querying (Pipe endpoints).
 *
 * Env vars:
 *   TINYBIRD_URL  — e.g. https://api.eu-central-1.aws.tinybird.co
 *   TINYBIRD_TOKEN    — admin token (write) used by cron and backfill
 *   TINYBIRD_READ_TOKEN — required read-only token for pipe queries
 */

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { readThroughCache } from "@/lib/redis-cache";
import {
  dateForTinybirdCacheKey,
  deserializePipeParams,
  getTinybirdCachePolicy,
  getTinybirdLastGood,
  isTinybirdLimitError,
  serializePipeParams,
  setTinybirdLastGood,
  TinybirdLimitError,
  tinybirdLogicalCacheKey,
  type TinybirdCacheInput,
} from "@/lib/tinybird-cache";

const apiUrl = () => process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";

function writeToken(): string {
  const token = process.env.TINYBIRD_TOKEN;
  if (!token) {
    throw new Error("TINYBIRD_TOKEN is not set");
  }
  return token;
}

function readToken(): string {
  const token = process.env.TINYBIRD_READ_TOKEN;
  if (!token) {
    throw new Error("TINYBIRD_READ_TOKEN is not set");
  }
  return token;
}

// ─── Ingestion ──────────────────────────────────────────────

export async function ingestRows(datasource: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return { successful_rows: 0 };
  }

  const ndjson = rows.map((row) => JSON.stringify(row)).join("\n");

  const res = await fetch(`${apiUrl()}/v0/events?name=${datasource}&format=ndjson`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken()}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tinybird ingest error (${res.status}): ${body}`);
  }

  return res.json();
}

export type QueryPipeOptions = Pick<TinybirdCacheInput, "range" | "date" | "now" | "purpose">;

type PipeJson<T> = { data: T[] };

async function fetchPipeRows<T>(
  pipeName: string,
  params: Record<string, string> | undefined
): Promise<T[]> {
  const url = new URL(`${apiUrl()}/v0/pipes/${pipeName}.json`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${readToken()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    if (isTinybirdLimitError(res.status, body)) {
      throw new TinybirdLimitError(`Tinybird query error (${res.status}): ${body}`);
    }
    throw new Error(`Tinybird query error (${res.status}): ${body}`);
  }

  const json: PipeJson<T> = await res.json();
  return json.data;
}

const queryPipeDeduped = cache(
  async (
    pipeName: string,
    paramsKey: string,
    range: string,
    date: string,
    revalidateSeconds: number
  ) => {
    const params = deserializePipeParams(paramsKey);
    const logicalKey = tinybirdLogicalCacheKey({
      pipeName,
      range,
      date,
      params,
      revalidateSeconds,
    });

    const cached = unstable_cache(
      async () => {
        const data = await fetchPipeRows(pipeName, params);
        setTinybirdLastGood(logicalKey, data);
        return data;
      },
      [logicalKey],
      { revalidate: revalidateSeconds, tags: [DASHBOARD_CACHE_TAG, `pipe:${pipeName}`] }
    );

    try {
      return await cached();
    } catch (error) {
      if (error instanceof TinybirdLimitError) {
        const lastGood = getTinybirdLastGood(logicalKey);
        if (lastGood) {
          return lastGood;
        }
      }
      throw error;
    }
  }
);

// ─── Query (Pipe endpoints) ─────────────────────────────────

export async function queryPipe<T = Record<string, unknown>>(
  pipeName: string,
  params?: Record<string, string>,
  options?: QueryPipeOptions
): Promise<T[]> {
  const cacheDate = dateForTinybirdCacheKey(options?.range, options?.date);
  const policy = getTinybirdCachePolicy({
    pipeName,
    params,
    range: options?.range,
    date: cacheDate === "" ? undefined : cacheDate,
    now: options?.now,
    purpose: options?.purpose,
  });

  const logicalKey = tinybirdLogicalCacheKey({
    pipeName,
    range: options?.range,
    date: cacheDate,
    params,
    revalidateSeconds: policy.revalidateSeconds,
  });

  // Always fill through Next's data cache. Redis is L2 only — if it is
  // configured but dead, skipping unstable_cache made every edge STALE
  // revalidation hit Tinybird.
  const rows = await readThroughCache(logicalKey, policy, () =>
    queryPipeDeduped(
      pipeName,
      serializePipeParams(params),
      options?.range ?? "",
      cacheDate,
      policy.revalidateSeconds
    )
  );
  return rows as T[];
}
