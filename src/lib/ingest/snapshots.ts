import { SNAPSHOT_FUELS, SNAPSHOT_MIX_FUELS } from "@/lib/ingest/fuels";
import { formatTinybirdDateTime } from "@/lib/london-time";

export type CarbonPoint = {
  actual: number | null;
  forecast: number | null;
  index: string;
};

export type SnapshotSources = {
  timestamp: Date;
  carbon?: CarbonPoint | null;
  mix?: Record<string, number> | null;
  demandMw?: number | null;
  priceGbpMwh?: number | null;
  genMw?: Record<string, number> | null;
};

export function nullableNumber(value: number | null | undefined): number | null {
  return value == null || Number.isNaN(value) ? null : value;
}

export function buildSnapshotRow(input: SnapshotSources): Record<string, unknown> {
  const carbon = input.carbon ?? null;
  const mix = input.mix ?? null;
  const genMw = input.genMw ?? null;

  const row: Record<string, unknown> = {
    timestamp: formatTinybirdDateTime(input.timestamp),
    carbon_intensity: carbon ? nullableNumber(carbon.actual) : null,
    carbon_forecast: carbon ? nullableNumber(carbon.forecast) : null,
    carbon_index: carbon?.index ?? "unknown",
    demand_mw: nullableNumber(input.demandMw),
    price_gbp_mwh: nullableNumber(input.priceGbpMwh),
  };

  for (const fuel of SNAPSHOT_MIX_FUELS) {
    row[`gen_${fuel}_pct`] = mix ? (mix[fuel] ?? 0) : null;
  }

  for (const fuel of SNAPSHOT_FUELS) {
    row[`gen_${fuel}_mw`] = genMw ? nullableNumber(genMw[fuel]) : null;
  }

  return row;
}
