export const GAS_INSTANTANEOUS_URL = "https://api.nationalgas.com/operationaldata/v1/instantaneousflow/sites";

export const GAS_FLOW_TIMEOUT_MS = 20_000;

const ACCEPTED_QUALITY = new Set(["", "A", "L"]);

const TERMINAL_SITES: Record<string, { key: string; role: "entry" | "exit" }> = {
  "BACTON IPs Terminal": { key: "bacton-ips", role: "entry" },
  "BACTON UKCS Terminal": { key: "bacton-ukcs", role: "entry" },
  "BARROW TERMINAL": { key: "barrow", role: "entry" },
  "EASINGTON TERMINAL": { key: "easington", role: "entry" },
  "ISLE OF GRAIN TERMINAL": { key: "isle-of-grain", role: "entry" },
  "MILFORD HAVEN TERMINAL": { key: "milford-haven", role: "entry" },
  "ST FERGUS TERMINAL": { key: "st-fergus", role: "entry" },
  "TEESSIDE TERMINAL": { key: "teesside", role: "entry" },
  "Moffat Export": { key: "moffat", role: "exit" },
};

const PARENT_DESCRIPTIONS = new Set(["Supply from terminals", "Demand from interconnectors"]);

export type GasTerminalSample = {
  key: string;
  role: "entry" | "exit";
  mcmPerDay: number;
  at: string;
};

export type GasTerminalFlowsRelease = {
  generated_at: string;
  published_at: string | null;
  samples: GasTerminalSample[];
  /** Hourly samples kept from earlier publishes, newest last, capped at 24. */
  history: Record<string, GasTerminalSample[]>;
};

type Detail = {
  applicableAt?: unknown;
  flowRate?: unknown;
  qualityIndicator?: unknown;
};

type Site = {
  siteName?: unknown;
  siteGasDetail?: unknown;
};

type Block = {
  description?: unknown;
  sites?: unknown;
};

export type ParsedGasFlows = {
  publishedAt: string | null;
  samples: GasTerminalSample[];
  skipped: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function latestAccepted(details: readonly Detail[]): { at: string; mcmPerDay: number } | null {
  let best: { at: string; mcmPerDay: number; time: number } | null = null;
  for (const detail of details) {
    if (typeof detail.applicableAt !== "string" || typeof detail.flowRate !== "number" || !Number.isFinite(detail.flowRate)) {
      continue;
    }
    const quality = typeof detail.qualityIndicator === "string" ? detail.qualityIndicator : "";
    if (!ACCEPTED_QUALITY.has(quality)) {
      continue;
    }
    const time = Date.parse(detail.applicableAt);
    if (!Number.isFinite(time)) {
      continue;
    }
    if (!best || time >= best.time) {
      best = { at: new Date(time).toISOString(), mcmPerDay: detail.flowRate, time };
    }
  }
  return best ? { at: best.at, mcmPerDay: best.mcmPerDay } : null;
}

/** Parent terminal totals and the Moffat exit. Child entry points are ignored so a parent is not counted twice. */
export function parseInstantaneousFlows(body: unknown): ParsedGasFlows {
  const root = asRecord(body);
  const publishedRaw = root && typeof root.publishedTime === "string" ? Date.parse(root.publishedTime) : Number.NaN;
  const publishedAt = Number.isFinite(publishedRaw) ? new Date(publishedRaw).toISOString() : null;
  const blocks = root && Array.isArray(root.instantaneousFlow) ? root.instantaneousFlow : [];
  const samples: GasTerminalSample[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const record = asRecord(block) as Block | null;
    if (!record || typeof record.description !== "string" || !PARENT_DESCRIPTIONS.has(record.description)) {
      continue;
    }
    const sites = Array.isArray(record.sites) ? record.sites : [];
    for (const site of sites) {
      const row = asRecord(site) as Site | null;
      if (!row || typeof row.siteName !== "string") {
        skipped += 1;
        continue;
      }
      const mapped = TERMINAL_SITES[row.siteName];
      if (!mapped) {
        skipped += 1;
        continue;
      }
      const details = Array.isArray(row.siteGasDetail) ? (row.siteGasDetail.filter((item) => asRecord(item)) as Detail[]) : [];
      const latest = latestAccepted(details);
      if (!latest) {
        skipped += 1;
        continue;
      }
      samples.push({ key: mapped.key, role: mapped.role, mcmPerDay: latest.mcmPerDay, at: latest.at });
    }
  }
  samples.sort((left, right) => left.key.localeCompare(right.key));
  return { publishedAt, samples, skipped };
}

export function rollGasHistory(
  previous: GasTerminalFlowsRelease | null,
  parsed: ParsedGasFlows,
  now: Date,
): GasTerminalFlowsRelease {
  const history: Record<string, GasTerminalSample[]> = { ...(previous?.history ?? {}) };
  for (const sample of parsed.samples) {
    const prior = history[sample.key] ?? [];
    const next = prior.filter((item) => item.at !== sample.at);
    next.push(sample);
    next.sort((left, right) => left.at.localeCompare(right.at));
    history[sample.key] = next.slice(-24);
  }
  return {
    generated_at: now.toISOString(),
    published_at: parsed.publishedAt,
    samples: parsed.samples,
    history,
  };
}
