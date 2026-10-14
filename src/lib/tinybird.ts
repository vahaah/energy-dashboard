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
import { isPastLondonDay, readDatedPipe } from "@/lib/dated-pipe";
import { getRedis, peekThroughCache } from "@/lib/redis-cache";
import {
  dateForTinybirdCacheKey,
  getTinybirdCachePolicy,
  getTinybirdLastGood,
  isTinybirdLimitError,
  setTinybirdLastGood,
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
    throw new TinybirdHttpError(res.status, body, res.headers.get("retry-after"));
  }

  return res.json();
}

export type QueryPipeOptions = Pick<TinybirdCacheInput, "range" | "date" | "now" | "purpose">;

type PipeJson<T> = { data: T[] };

export class TinybirdHttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryAfter: string | null;

  constructor(status: number, body: string, retryAfter: string | null) {
    super(`Tinybird query error (${status}): ${body}`);
    this.name = "TinybirdHttpError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

/** Thrown when a public read has no warmed Redis envelope. Never triggers a pipe call. */
export class WarmedEnvelopeMissing extends Error {
  readonly retryAfterSeconds = 60;

  constructor(logicalKey: string) {
    super(`warmed envelope missing: ${logicalKey}`);
    this.name = "WarmedEnvelopeMissing";
  }
}

export async function fetchPipeRows<T>(
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
    const retryAfter = res.headers.get("retry-after");
    if (isTinybirdLimitError(res.status, body)) {
      throw new TinybirdHttpError(res.status, body, retryAfter);
    }
    throw new TinybirdHttpError(res.status, body, retryAfter);
  }

  const json: PipeJson<T> = await res.json();
  return json.data;
}

async function queryPipeDeduped<T>(
  pipeName: string,
  logicalKey: string,
  policyRevalidateSeconds: number,
  policy: TinybirdCacheInput & { revalidateSeconds?: number }
): Promise<T[]> {
  const cachePolicy = getTinybirdCachePolicy({
    pipeName,
    params: policy.params,
    range: policy.range,
    date: policy.date,
    now: policy.now,
    purpose: policy.purpose,
  });
  const cached = unstable_cache(
    async () => {
      const data = await peekThroughCache<T[]>(logicalKey, {
        ...cachePolicy,
        revalidateSeconds: policyRevalidateSeconds,
      });
      if (data == null) {
        throw new WarmedEnvelopeMissing(logicalKey);
      }
      setTinybirdLastGood(logicalKey, data);
      return data;
    },
    [logicalKey],
    {
      revalidate: policyRevalidateSeconds,
      tags: [DASHBOARD_CACHE_TAG, `pipe:${pipeName}`],
    }
  );

  try {
    return await cached();
  } catch (error) {
    if (error instanceof WarmedEnvelopeMissing) {
      const lastGood = getTinybirdLastGood<T>(logicalKey);
      if (lastGood) {
        return lastGood;
      }
    }
    throw error;
  }
}

const queryPipePerRequest = cache(queryPipeDeduped);

// ─── Query (Pipe endpoints) ─────────────────────────────────

export function pipeCacheIdentity(
  pipeName: string,
  params: Record<string, string> | undefined,
  options?: QueryPipeOptions
): {
  logicalKey: string;
  policy: ReturnType<typeof getTinybirdCachePolicy>;
} {
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
  return { logicalKey, policy };
}

function withoutCommodity(params?: Record<string, string>): {
  commodity: string | null;
  params?: Record<string, string>;
} {
  if (!params?.commodity) {
    return { commodity: null, params };
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== "commodity") {
      next[key] = value;
    }
  }
  return { commodity: params.commodity, params: next };
}

function filterCommodity<T>(rows: T[], commodity: string | null): T[] {
  if (!commodity) {
    return rows;
  }
  return rows.filter((row) => {
    if (!row || typeof row !== "object" || !("commodity" in row)) {
      return false;
    }
    return (row as { commodity: unknown }).commodity === commodity;
  });
}

export async function queryPipe<T = Record<string, unknown>>(
  pipeName: string,
  params?: Record<string, string>,
  options?: QueryPipeOptions
): Promise<T[]> {
  const { commodity, params: pipeParams } = withoutCommodity(params);
  const rows = await queryPipeUnfiltered<T>(pipeName, pipeParams, options);
  return filterCommodity(rows, commodity);
}

async function queryPipeUnfiltered<T>(
  pipeName: string,
  params: Record<string, string> | undefined,
  options?: QueryPipeOptions
): Promise<T[]> {
  const now = options?.now ?? new Date();
  const date = options?.date ?? null;

  // A past London day is sliced from the warmed envelope, or one bounded read
  // cached on the historical TTL. Without Upstash there is no envelope, so
  // this is still that civil-day read and the page does not 503.
  if (date && isPastLondonDay(date, now)) {
    return readDatedPipe<T>(pipeName, date, now, (dayParams) =>
      fetchPipeRows<T>(pipeName, dayParams)
    );
  }

  // No Upstash: read the rolling window directly so a page is never a 503
  // solely because the warmed envelope cannot exist.
  if (getRedis() == null) {
    return fetchPipeRows<T>(pipeName, params);
  }

  const { logicalKey, policy } = pipeCacheIdentity(pipeName, params, options);
  const cacheDate = dateForTinybirdCacheKey(options?.range, options?.date);

  // Request path reads the warmed Redis envelope through Next's data cache.
  // A miss must not call Tinybird — the workflow is the only reader.
  return queryPipePerRequest<T>(pipeName, logicalKey, policy.revalidateSeconds, {
    pipeName,
    params,
    range: options?.range,
    date: cacheDate === "" ? undefined : cacheDate,
    now: options?.now,
    purpose: options?.purpose,
  });
}
