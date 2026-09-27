/**
 * Tinybird client for both ingestion (Events API) and querying (Pipe endpoints).
 *
 * Env vars:
 *   TINYBIRD_URL  — e.g. https://api.eu-central-1.aws.tinybird.co
 *   TINYBIRD_TOKEN    — admin token (write) used by cron and backfill
 *   TINYBIRD_READ_TOKEN — required read-only token for pipe queries
 */

import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";

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

// ─── Query (Pipe endpoints) ─────────────────────────────────

export async function queryPipe<T = Record<string, unknown>>(
  pipeName: string,
  params?: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${apiUrl()}/v0/pipes/${pipeName}.json`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${readToken()}` },
    next: { revalidate: 60, tags: [DASHBOARD_CACHE_TAG, `pipe:${pipeName}`] },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tinybird query error (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.data as T[];
}
