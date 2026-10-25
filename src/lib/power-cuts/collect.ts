import { API_KEY_ABSENT_REASON, UNLICENSED_REASON } from "@/lib/power-cuts/copy";
import { POWER_CUT_ENDPOINTS } from "@/lib/power-cuts/endpoints";
import { fetchBounded } from "@/lib/power-cuts/fetch";
import { parseOperator } from "@/lib/power-cuts/parse";
import {
  OPERATORS,
  STALE_AFTER_MS,
  type Operator,
  type PowerCut,
  type PowerCutsSnapshot,
  type SourceReport,
  type SourceStatus,
} from "@/lib/power-cuts/schema";
import type { SectorPointLookup } from "@/lib/postcode/sector";

export type PowerCutsFlags = {
  enwKey: string | null;
  spenKey: string | null;
  /** Licence is not cleared. A true flag still fetches; the page does not attribute the source. */
  enableSsen: boolean;
  enableNie: boolean;
};

export function powerCutsFlags(env: NodeJS.ProcessEnv = process.env): PowerCutsFlags {
  return {
    enwKey: env.ENW_ODS_API_KEY?.trim() || null,
    spenKey: env.SPEN_ODS_API_KEY?.trim() || null,
    enableSsen: env.POWER_CUTS_ENABLE_SSEN === "1" || env.POWER_CUTS_ENABLE_SSEN === "true",
    enableNie: env.POWER_CUTS_ENABLE_NIE === "1" || env.POWER_CUTS_ENABLE_NIE === "true",
  };
}

export type FetchedSource = {
  operator: Operator;
  status: Exclude<SourceStatus, "stale">;
  incidents: PowerCut[];
  error?: string;
};

function enabled(operator: Operator, flags: PowerCutsFlags): boolean {
  switch (operator) {
    case "ssen":
      return flags.enableSsen;
    case "nie":
      return flags.enableNie;
    case "ukpn":
    case "nged":
    case "npg":
    case "enw":
    case "spen":
      return true;
    default: {
      const exhaustive: never = operator;
      return exhaustive;
    }
  }
}

function apiKey(operator: Operator, flags: PowerCutsFlags): string | null {
  switch (operator) {
    case "enw":
      return flags.enwKey;
    case "spen":
      return flags.spenKey;
    case "ukpn":
    case "nged":
    case "npg":
    case "ssen":
    case "nie":
      return null;
    default: {
      const exhaustive: never = operator;
      return exhaustive;
    }
  }
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "fetch failed";
  return message.replace(/Apikey\s+\S+/gi, "Apikey [redacted]").slice(0, 200);
}

export async function fetchSource(
  operator: Operator,
  flags: PowerCutsFlags,
  now: Date,
  fetchImpl?: typeof fetch,
  lookup?: SectorPointLookup,
): Promise<FetchedSource> {
  if (!enabled(operator, flags)) {
    return { operator, status: "unlicensed", incidents: [], error: UNLICENSED_REASON };
  }
  const endpoint = POWER_CUT_ENDPOINTS.find((item) => item.operator === operator);
  if (!endpoint) {
    return { operator, status: "absent", incidents: [], error: "no endpoint" };
  }
  const key = endpoint.apiKeyEnv ? apiKey(operator, flags) : null;
  if (endpoint.apiKeyEnv && !key) {
    return { operator, status: "absent", incidents: [], error: API_KEY_ABSENT_REASON };
  }
  try {
    const body = await fetchBounded(endpoint.url, {
      fetchImpl,
      init: key ? { headers: { Authorization: `Apikey ${key}`, Accept: "application/json" } } : { headers: { Accept: endpoint.format === "csv" ? "text/csv" : "application/json" } },
    });
    const payload = endpoint.format === "csv" ? body : (JSON.parse(body) as unknown);
    return { operator, status: "ok", incidents: parseOperator(operator, payload, now, lookup) };
  } catch (error) {
    return { operator, status: "absent", incidents: [], error: publicError(error) };
  }
}

export async function fetchAllSources(
  flags: PowerCutsFlags,
  now: Date,
  fetchImpl?: typeof fetch,
  lookup?: SectorPointLookup,
): Promise<FetchedSource[]> {
  return Promise.all(OPERATORS.map((operator) => fetchSource(operator, flags, now, fetchImpl, lookup)));
}

function report(status: SourceStatus, fetchedAt: string | null, count: number, error?: string): SourceReport {
  return error ? { status, fetchedAt, count, error } : { status, fetchedAt, count };
}

/** A failed source keeps its last good rows until they are two hours old. */
export function mergeSnapshot(fetched: readonly FetchedSource[], previous: PowerCutsSnapshot | null, now: Date): PowerCutsSnapshot {
  const fetchedAt = now.toISOString();
  const sources = {} as PowerCutsSnapshot["sources"];
  const incidents: PowerCut[] = [];

  for (const operator of OPERATORS) {
    const next = fetched.find((item) => item.operator === operator);
    const priorReport = previous?.sources[operator];
    const priorRows = previous?.incidents.filter((incident) => incident.operator === operator) ?? [];
    if (!next || next.status === "unlicensed") {
      sources[operator] = report("unlicensed", null, 0, next?.error ?? UNLICENSED_REASON);
      continue;
    }
    if (next.status === "ok") {
      sources[operator] = report("ok", fetchedAt, next.incidents.length);
      incidents.push(...next.incidents);
      continue;
    }
    const priorAt = priorReport?.fetchedAt ? new Date(priorReport.fetchedAt).getTime() : Number.NaN;
    const freshEnough = Number.isFinite(priorAt) && now.getTime() - priorAt < STALE_AFTER_MS;
    const keep = (priorReport?.status === "ok" || priorReport?.status === "stale") && freshEnough && next.error !== API_KEY_ABSENT_REASON;
    if (keep && priorReport?.fetchedAt) {
      sources[operator] = report("stale", priorReport.fetchedAt, priorRows.length, next.error);
      incidents.push(...priorRows);
      continue;
    }
    sources[operator] = report("absent", null, 0, next.error);
  }

  return { fetchedAt, sources, incidents };
}
