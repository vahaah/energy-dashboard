import { isUtcInstant } from "@/lib/catalogue/schema";
import type { GasInstantaneousSample } from "@/lib/ingest/national-gas/release";

/**
 * Instantaneous Flow API. No key. Probed 22 Oct 2026: the body is
 * `{ publishedTime, currentGasDay, instantaneousFlow: [{ description, sites }] }`
 * and a site is `{ siteName, siteGasDetail: [{ applicableAt, flowRate, qualityIndicator }] }`.
 * There is no publicationId. Catalogue v2.3.7 names these series only here.
 */
export const GAS_INSTANTANEOUS_URL =
  "https://api.nationalgas.com/operationaldata/v1/instantaneousflow/sites";

export const GAS_INSTANTANEOUS_TIMEOUT_MS = 10_000;

/** Initial request plus two retries. 200ms then 800ms, and only for a retryable failure. */
export const GAS_INSTANTANEOUS_ATTEMPTS = 3;

export const GAS_INSTANTANEOUS_BACKOFF_MS = [200, 800] as const;

export const NTS_DEMAND_FLOW = "NTS Demand Flow";

export const NTS_ACTUAL_LINEPACK = "NTS Actual Linepack";

/** Storage injection on the within-day feed is the offtake into storage. */
export const STORAGE_DEMAND_FLOW = "Storage Demand Flow";

export const DEMAND_PART_NAMES = [
  "Industrial Demand Flow",
  "Interconnector Export Demand Flow",
  "LDZ Offtake Flow",
  "Power Station Demand Flow",
  STORAGE_DEMAND_FLOW,
] as const;

/**
 * Medium and long-range storage entry points present on the 22 Oct 2026 feed.
 * LNG terminals (Grain, Dragon, South Hook) are supply, not withdrawal.
 * Hatfield Moor and Humbly Grove were absent from that feed and are not invented.
 */
export const STORAGE_WITHDRAWAL_SITES = [
  "ALDBROUGH",
  "EASINGTON ROUGH ST",
  "HILLTOP",
  "HOLE HOUSE FARM",
  "HOLFORD",
  "HORNSEA",
  "STUBLACH",
] as const;

const DEMAND_PARTS = new Set<string>(DEMAND_PART_NAMES);
const WITHDRAWAL_SITES = new Set<string>(STORAGE_WITHDRAWAL_SITES);

type InstantaneousRole = GasInstantaneousSample["role"];

export function parseInstantaneousFlow(text: string): GasInstantaneousSample[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const body = parsed as { publishedTime?: unknown; instantaneousFlow?: unknown };
  const publishedAt = toInstant(body.publishedTime);
  if (!publishedAt || !Array.isArray(body.instantaneousFlow)) {
    return [];
  }
  const samples: GasInstantaneousSample[] = [];
  for (const group of body.instantaneousFlow) {
    if (!group || typeof group !== "object") {
      continue;
    }
    const sites = (group as { sites?: unknown }).sites;
    if (!Array.isArray(sites)) {
      continue;
    }
    for (const site of sites) {
      if (!site || typeof site !== "object") {
        continue;
      }
      const name = (site as { siteName?: unknown }).siteName;
      const details = (site as { siteGasDetail?: unknown }).siteGasDetail;
      if (typeof name !== "string" || !Array.isArray(details)) {
        continue;
      }
      const role = roleFor(name);
      if (!role) {
        continue;
      }
      for (const detail of details) {
        const sample = sampleFrom(name, role, publishedAt, detail);
        if (sample) {
          samples.push(sample);
        }
      }
    }
  }
  return samples;
}

function roleFor(name: string): InstantaneousRole | null {
  if (name === NTS_DEMAND_FLOW) {
    return "demand";
  }
  if (DEMAND_PARTS.has(name)) {
    return "demand_part";
  }
  if (name === NTS_ACTUAL_LINEPACK) {
    return "linepack";
  }
  if (WITHDRAWAL_SITES.has(name)) {
    return "storage_withdrawal";
  }
  return null;
}

function sampleFrom(
  name: string,
  role: InstantaneousRole,
  publishedAt: string,
  detail: unknown,
): GasInstantaneousSample | null {
  if (!detail || typeof detail !== "object") {
    return null;
  }
  const row = detail as { applicableAt?: unknown; flowRate?: unknown };
  const applicableAt = toInstant(row.applicableAt);
  if (!applicableAt || typeof row.flowRate !== "number" || !Number.isFinite(row.flowRate)) {
    return null;
  }
  return {
    role,
    name,
    unit: role === "linepack" ? "mscm" : "mscm/d",
    value: row.flowRate,
    applicable_at: applicableAt,
    published_at: publishedAt,
  };
}

function toInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const iso = parsed.toISOString();
  return isUtcInstant(iso) ? iso : null;
}
