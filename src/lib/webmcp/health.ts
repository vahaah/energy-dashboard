export const DATA_HEALTH_CAP = 200;

export type HealthRow = {
  metric_id: string;
  label: string;
  unit: string;
  source: string;
  value: number | null;
  published_at: string | null;
  retrieved_at: string | null;
  stale: boolean;
  state: string | null;
};

export type DataHealthSummary = {
  checkedAt: string | null;
  fresh: number;
  stale: number;
  missing: number;
  readings: HealthRow[];
  omitted: number;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function row(value: unknown): HealthRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    metric_id?: unknown;
    label?: unknown;
    unit?: unknown;
    source?: unknown;
    value?: unknown;
    published_at?: unknown;
    retrieved_at?: unknown;
    stale?: unknown;
    state?: unknown;
  };
  if (typeof record.metric_id !== "string" || typeof record.label !== "string" || typeof record.source !== "string") {
    return null;
  }
  const reading = record.value;
  return {
    metric_id: record.metric_id,
    label: record.label,
    unit: typeof record.unit === "string" ? record.unit : "",
    source: record.source,
    value: typeof reading === "number" && Number.isFinite(reading) ? reading : null,
    published_at: text(record.published_at),
    retrieved_at: text(record.retrieved_at),
    stale: record.stale === true,
    state: text(record.state),
  };
}

export function dataHealthFromApi(body: unknown): DataHealthSummary | null {
  if (!body || typeof body !== "object" || !("readings" in body)) {
    return null;
  }
  const readings = (body as { readings?: unknown }).readings;
  if (!Array.isArray(readings)) {
    return null;
  }
  const parsed = readings.flatMap((item) => {
    const next = row(item);
    return next ? [next] : [];
  });
  const kept = parsed.slice(0, DATA_HEALTH_CAP);
  let fresh = 0;
  let stale = 0;
  let missing = 0;
  for (const item of kept) {
    if (item.value == null && item.published_at == null) {
      missing += 1;
    } else if (item.stale) {
      stale += 1;
    } else {
      fresh += 1;
    }
  }
  const checkedAt = (body as { checkedAt?: unknown }).checkedAt;
  return {
    checkedAt: typeof checkedAt === "string" ? checkedAt : null,
    fresh,
    stale,
    missing,
    readings: kept,
    omitted: Math.max(0, parsed.length - kept.length),
  };
}
