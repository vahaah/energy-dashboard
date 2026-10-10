import {
  inflatedSnapshotFromWideRow,
  inflatedSnapshotSql,
  type InflatedSnapshotRow,
} from "./snapshot-integrity";

type TinybirdSqlResponse<T> = {
  data: T[];
};

export class TinybirdSqlPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TinybirdSqlPermissionError";
  }
}

function tinybirdApiUrl(): string {
  return process.env.TINYBIRD_URL ?? "https://api.eu-central-1.aws.tinybird.co";
}

export function tinybirdSqlToken(
  env: Record<string, string | undefined> = process.env
): string {
  const token = env.TINYBIRD_TOKEN ?? env.TINYBIRD_READ_TOKEN ?? "";
  if (!token) {
    throw new Error("TINYBIRD_TOKEN or TINYBIRD_READ_TOKEN is not set");
  }
  return token;
}

export function tinybirdReadToken(
  env: Record<string, string | undefined> = process.env
): string {
  const token = env.TINYBIRD_READ_TOKEN ?? "";
  if (!token) {
    throw new Error("TINYBIRD_READ_TOKEN is not set");
  }
  return token;
}

export async function queryTinybirdSql<T>(sql: string): Promise<T[]> {
  const response = await fetch(`${tinybirdApiUrl()}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tinybirdSqlToken()}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      throw new TinybirdSqlPermissionError(`Tinybird SQL error (${response.status}): ${body}`);
    }
    throw new Error(`Tinybird SQL error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as TinybirdSqlResponse<T>;
  return json.data;
}

/** One pipe request. Scripts only — do not call from cron. */
export async function queryTinybirdPipe<T>(
  pipeName: string,
  params?: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${tinybirdApiUrl()}/v0/pipes/${pipeName}.json`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${tinybirdReadToken()}` },
  });

  if (!response.ok) {
    throw new Error(`Tinybird pipe error (${response.status}): ${await response.text()}`);
  }

  const json = (await response.json()) as TinybirdSqlResponse<T>;
  return json.data;
}

export const SNAPSHOTS_RANGE_DIAGNOSTIC_START = "2025-01-01 00:00:00";
export const SNAPSHOTS_RANGE_DIAGNOSTIC_END = "2099-01-01 00:00:00";

export type InflatedSnapshotQueryResult = {
  rows: InflatedSnapshotRow[];
  source: "sql" | "snapshots_range";
};

/**
 * Official path is one Tinybird SQL statement. dashboard_read cannot hit /v0/sql,
 * so fall back to one snapshots_range pipe (no FUELINST join).
 */
export async function queryInflatedSnapshots(): Promise<InflatedSnapshotQueryResult> {
  try {
    return {
      rows: await queryTinybirdSql<InflatedSnapshotRow>(inflatedSnapshotSql()),
      source: "sql",
    };
  } catch (error) {
    if (!(error instanceof TinybirdSqlPermissionError)) {
      throw error;
    }
    const wide = await queryTinybirdPipe<Record<string, unknown>>("snapshots_range", {
      start: SNAPSHOTS_RANGE_DIAGNOSTIC_START,
      end: SNAPSHOTS_RANGE_DIAGNOSTIC_END,
    });
    const rows: InflatedSnapshotRow[] = [];
    for (const row of wide) {
      const inflated = inflatedSnapshotFromWideRow(row);
      if (inflated) {
        rows.push(inflated);
      }
    }
    return { rows, source: "snapshots_range" };
  }
}
