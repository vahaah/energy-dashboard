import { resolveLondonWallSequence } from "@/lib/ingest/national-gas/gas-day";
import {
  EIRGRID_SERIES,
  geographyFromFeedRegion,
  type EirgridSeriesSpec,
  type EirgridSourceLine,
} from "@/lib/eirgrid/spec";

export type ParsedPoint = {
  time: string;
  value: number | null;
};

export type ParsedSeries = {
  metric_id: string;
  geography_id: EirgridSeriesSpec["geography_id"];
  source_line: EirgridSourceLine;
  unit: string;
  points: ParsedPoint[];
};

export type ParseReport = {
  series: ParsedSeries[];
  quarantined: number;
};

type FeedRow = {
  EffectiveTime?: unknown;
  FieldName?: unknown;
  Region?: unknown;
  Value?: unknown;
};

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const STAMP = /^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

/** `14-Oct-2026 00:15:00` to the gas-day wall parser's `DD/MM/YYYY HH:MM:SS`. */
export function eirgridStampToWall(value: string): string | null {
  const match = STAMP.exec(value.trim());
  if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6]) {
    return null;
  }
  const month = MONTHS[match[2]];
  if (!month) {
    return null;
  }
  return `${match[1]}/${month}/${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
}

export function parseChartDocument(body: string): ParseReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return { series: [], quarantined: 1 };
  }
  const rows = readRows(parsed);
  return pointsFromRows(rows);
}

export function parseFuelMixDocument(body: string): ParseReport {
  return parseChartDocument(body);
}

export function parseSnspDocument(body: string): ParseReport {
  return parseChartDocument(body);
}

/** Chart JSON drops unpublished null slots. The NI page table stays on the HTML parser. */
export function parseMarketFeed(body: string): ParseReport {
  if (body.includes("\"Rows\"") || body.includes("\"EffectiveTime\"")) {
    const parsed = parseChartDocument(body);
    return {
      quarantined: parsed.quarantined,
      series: parsed.series
        .map((series) => ({
          ...series,
          points: series.points.filter((point) => point.value != null),
        }))
        .filter((series) => series.points.length > 0),
    };
  }
  return parseMarketPricingDocument(body);
}

type MarketRow = {
  date?: unknown;
  IMBALANCE_SETTLEMENT_PRICE?: unknown;
  NET_IMBALANCE_VOLUME?: unknown;
  IMBALANCE_SETTLEMENT_PRICE_GBP?: unknown;
};

/** SEMO table embedded in the dashboard page. Sterling is dropped. */
export function parseMarketPricingDocument(html: string): ParseReport {
  const decoded = html.includes('\\"') ? html.replaceAll('\\"', '"') : html;
  const start = decoded.indexOf('{"date":');
  if (start < 0) {
    return { series: [], quarantined: 0 };
  }
  const arrayStart = decoded.lastIndexOf("[", start);
  if (arrayStart < 0) {
    return { series: [], quarantined: 1 };
  }
  const slice = decoded.slice(arrayStart);
  const end = slice.indexOf("]");
  if (end < 0) {
    return { series: [], quarantined: 1 };
  }
  let rows: MarketRow[];
  try {
    rows = JSON.parse(slice.slice(0, end + 1)) as MarketRow[];
  } catch {
    return { series: [], quarantined: 1 };
  }
  if (!Array.isArray(rows)) {
    return { series: [], quarantined: 1 };
  }
  const price = collectMarket(rows, "IMBALANCE_SETTLEMENT_PRICE");
  const volume = collectMarket(rows, "NET_IMBALANCE_VOLUME");
  return {
    series: [price.series, volume.series].filter((series) => series.points.length > 0),
    quarantined: price.quarantined + volume.quarantined,
  };
}

function collectMarket(
  rows: readonly MarketRow[],
  field: "IMBALANCE_SETTLEMENT_PRICE" | "NET_IMBALANCE_VOLUME",
): { series: ParsedSeries; quarantined: number } {
  const spec = EIRGRID_SERIES.find((series) => series.field === field && series.area === "marketPricing");
  const walls: string[] = [];
  const values: Array<number | null> = [];
  let quarantined = 0;
  for (const row of rows) {
    if ("IMBALANCE_SETTLEMENT_PRICE_GBP" in row) {
      // Present on the feed. Never stored and never converted.
    }
    const wall = typeof row.date === "string" ? eirgridStampToWall(row.date) : null;
    if (!wall || !spec) {
      quarantined += 1;
      continue;
    }
    const value = row[field];
    if (value == null) {
      walls.push(wall);
      values.push(null);
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      quarantined += 1;
      continue;
    }
    walls.push(wall);
    values.push(value);
  }
  const times = resolveLondonWallSequence(walls);
  const points: ParsedPoint[] = [];
  times.forEach((instant, index) => {
    if (!instant) {
      quarantined += 1;
      return;
    }
    points.push({ time: instant.toISOString(), value: values[index] ?? null });
  });
  return {
    series: spec
      ? {
          metric_id: spec.metric_id,
          geography_id: spec.geography_id,
          source_line: spec.source_line,
          unit: spec.unit,
          points,
        }
      : { metric_id: "", geography_id: "ALL_ISLAND", source_line: "Source: SEMO.", unit: "", points: [] },
    quarantined,
  };
}

function readRows(parsed: unknown): FeedRow[] {
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const rows = (parsed as { Rows?: unknown }).Rows;
  return Array.isArray(rows) ? (rows as FeedRow[]) : [];
}

function pointsFromRows(rows: readonly FeedRow[]): ParseReport {
  const grouped = new Map<string, { spec: EirgridSeriesSpec; walls: string[]; values: Array<number | null> }>();
  let quarantined = 0;
  for (const row of rows) {
    const field = typeof row.FieldName === "string" ? row.FieldName : "";
    const region = typeof row.Region === "string" ? row.Region : "";
    const geography = geographyFromFeedRegion(region);
    const wall = typeof row.EffectiveTime === "string" ? eirgridStampToWall(row.EffectiveTime) : null;
    if (!geography || !wall || region === "GB" || region === "UK") {
      quarantined += 1;
      continue;
    }
    const spec = EIRGRID_SERIES.find((series) => series.field === field && series.geography_id === geography);
    if (!spec) {
      quarantined += 1;
      continue;
    }
    const bucket = grouped.get(spec.metric_id) ?? { spec, walls: [], values: [] };
    if (row.Value == null) {
      bucket.walls.push(wall);
      bucket.values.push(null);
    } else if (typeof row.Value === "number" && Number.isFinite(row.Value)) {
      bucket.walls.push(wall);
      bucket.values.push(row.Value);
    } else {
      quarantined += 1;
      continue;
    }
    grouped.set(spec.metric_id, bucket);
  }
  const series: ParsedSeries[] = [];
  for (const bucket of grouped.values()) {
    const times = resolveLondonWallSequence(bucket.walls);
    const points: ParsedPoint[] = [];
    times.forEach((instant, index) => {
      if (!instant) {
        quarantined += 1;
        return;
      }
      points.push({ time: instant.toISOString(), value: bucket.values[index] ?? null });
    });
    const kept = points.filter((point) => point.value != null);
    if (kept.length === 0) {
      continue;
    }
    series.push({
      metric_id: bucket.spec.metric_id,
      geography_id: bucket.spec.geography_id,
      source_line: bucket.spec.source_line,
      unit: bucket.spec.unit,
      points: points.sort((left, right) => left.time.localeCompare(right.time)),
    });
  }
  return { series, quarantined };
}

export function mergeParseReports(reports: readonly ParseReport[]): ParseReport {
  const byMetric = new Map<string, ParsedSeries>();
  let quarantined = 0;
  for (const report of reports) {
    quarantined += report.quarantined;
    for (const series of report.series) {
      const existing = byMetric.get(series.metric_id);
      if (!existing) {
        byMetric.set(series.metric_id, { ...series, points: [...series.points] });
        continue;
      }
      const seen = new Set(existing.points.map((point) => point.time));
      for (const point of series.points) {
        if (!seen.has(point.time)) {
          existing.points.push(point);
        }
      }
      existing.points.sort((left, right) => left.time.localeCompare(right.time));
    }
  }
  return { series: [...byMetric.values()], quarantined };
}
