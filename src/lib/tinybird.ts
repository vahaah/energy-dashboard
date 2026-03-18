/**
 * Tinybird client for both ingestion (Events API) and querying (Pipe endpoints).
 *
 * Env vars:
 *   TINYBIRD_API_URL  — e.g. https://api.eu-central-1.aws.tinybird.co
 *   TINYBIRD_TOKEN    — admin token (write + read) used by cron
 *   TINYBIRD_READ_TOKEN — (optional) read-only token for pipe queries; falls back to TINYBIRD_TOKEN
 */

const apiUrl = () => process.env.TINYBIRD_API_URL ?? "https://api.eu-central-1.aws.tinybird.co";
const writeToken = () => process.env.TINYBIRD_TOKEN ?? "";
const readToken = () => process.env.TINYBIRD_READ_TOKEN ?? process.env.TINYBIRD_TOKEN ?? "";

// ─── Ingestion ──────────────────────────────────────────────

export async function ingestRows(datasource: string, rows: Record<string, unknown>[]) {
  const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");

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
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${readToken()}` },
    next: { revalidate: 300 }, // ISR: cache for 5 min in Next.js
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tinybird query error (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.data as T[];
}
