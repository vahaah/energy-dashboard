import { displayedPercents } from "@/lib/display-rounding";
import { SEMO_SOURCE_LINE, SONI_SOURCE_LINE } from "@/lib/attribution";
import { formatAbsent } from "@/lib/data-state";
import { NI_EMPTY, NI_PARTIAL, niLatestSentence } from "@/lib/eirgrid/copy";
import type { NiRelease, NiSeries } from "@/lib/eirgrid/release";
import { EIRGRID_SERIES, type EirgridSeriesSpec } from "@/lib/eirgrid/spec";
import { formatLondonDateTimeStamp, parseUtcDateTime } from "@/lib/london-time";

export type NiScopeId = "ni" | "all";

export type NiFigure = {
  metricId: string;
  label: string;
  unit: string;
  sourceLine: string;
  value: string;
  rows: { time: string; value: string }[];
};

export type NiFuelRow = {
  metricId: string;
  label: string;
  mwh: string;
  share: string | null;
};

export type NiScopeModel = {
  id: NiScopeId;
  label: string;
  figures: NiFigure[];
  fuels: NiFuelRow[];
  fuelSourceLine: string;
  semo: NiFigure[];
};

export type NiPageModel = {
  available: boolean;
  status: string;
  partial: boolean;
  attribution: string;
  scopes: NiScopeModel[];
};

const NI_FIGURES = [
  "elec.ni.demand.system",
  "elec.ni.generation.system",
  "elec.ni.generation.wind",
  "elec.ni.generation.wind_forecast",
  "elec.ni.generation.solar",
  "elec.ni.generation.solar_forecast",
  "elec.ni.carbon.intensity",
  "elec.ni.transfers.moyle",
  "elec.ni.transfers.net",
] as const;

const ALL_FIGURES = [
  "elec.all_island.demand.system",
  "elec.all_island.generation.system",
  "elec.all_island.generation.wind",
  "elec.all_island.generation.wind_forecast",
  "elec.all_island.generation.solar",
  "elec.all_island.generation.solar_forecast",
  "elec.all_island.carbon.intensity",
  "elec.all_island.transfers.net",
  "elec.all_island.snsp.share",
] as const;

const SEMO_FIGURES = ["elec.all_island.price.imbalance", "elec.all_island.imbalance.volume"] as const;

const TABLE_ROWS = 8;

export function buildNiPage(release: NiRelease | null, attribution: string): NiPageModel {
  if (!release || !hasNorthernIrelandPoint(release)) {
    return {
      available: false,
      status: NI_EMPTY,
      partial: false,
      attribution,
      scopes: [],
    };
  }
  const byId = new Map(release.series.map((series) => [series.metric_id, series]));
  const partial = NI_FIGURES.some((metricId) => seriesMissing(byId.get(metricId)));
  const observed = latestSoniInstant(release);
  return {
    available: true,
    status: observed ? niLatestSentence(formatLondonDateTimeStamp(observed)) : NI_EMPTY,
    partial,
    attribution,
    scopes: [
      scopeModel("ni", "Northern Ireland", NI_FIGURES, "NI", byId),
      scopeModel("all", "All-island", ALL_FIGURES, "ALL_ISLAND", byId),
    ],
  };
}

export function pageStatus(model: NiPageModel): string {
  if (!model.available) {
    return NI_EMPTY;
  }
  if (model.partial) {
    return NI_PARTIAL;
  }
  return model.status;
}

function scopeModel(
  id: NiScopeId,
  label: string,
  figureIds: readonly string[],
  geography: "NI" | "ALL_ISLAND",
  byId: Map<string, NiSeries>,
): NiScopeModel {
  return {
    id,
    label,
    figures: figureIds.map((metricId) => figure(metricId, byId.get(metricId))),
    fuels: fuelRows(geography, byId),
    fuelSourceLine: SONI_SOURCE_LINE,
    semo: id === "all" ? SEMO_FIGURES.map((metricId) => figure(metricId, byId.get(metricId))) : [],
  };
}

function figure(metricId: string, series: NiSeries | undefined): NiFigure {
  const spec = specFor(metricId);
  const points = series?.points ?? [];
  const latest = [...points].reverse().find((point) => point.value != null) ?? null;
  const rows = points.slice(-TABLE_ROWS).map((point) => ({
    time: formatLondonDateTimeStamp(parseUtcDateTime(point.time)),
    value: point.value == null ? formatAbsent(null) : formatFigure(point.value, spec.unit),
  }));
  return {
    metricId,
    label: spec.label,
    unit: spec.unit,
    sourceLine: spec.source_line,
    value: latest?.value == null ? formatAbsent(null) : formatFigure(latest.value, spec.unit),
    rows,
  };
}

function fuelRows(geography: "NI" | "ALL_ISLAND", byId: Map<string, NiSeries>): NiFuelRow[] {
  const specs = EIRGRID_SERIES.filter((series) => series.area === "fuelmix" && series.geography_id === geography);
  const points = specs.map((spec) => byId.get(spec.metric_id)?.points ?? []);
  const newest = newestFuelInstant(points);
  const latest = specs.map((spec, index) => {
    const point = newest ? points[index]?.find((row) => row.time === newest) : undefined;
    return { spec, value: point?.value ?? null };
  });
  const complete = latest.every((row) => row.value != null && row.value >= 0);
  const total = latest.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const shares =
    complete && total > 0 ? displayedPercents(latest.map((row) => ((row.value ?? 0) / total) * 100)) : null;
  return latest.map((row, index) => ({
    metricId: row.spec.metric_id,
    label: row.spec.label,
    mwh: row.value == null ? formatAbsent(null) : formatFigure(row.value, "MWh"),
    share: shares ? `${shares[index] ?? 0}%` : null,
  }));
}

function seriesMissing(series: NiSeries | undefined): boolean {
  if (!series || series.points.length === 0) {
    return true;
  }
  return series.points.some((point) => point.value == null);
}

function hasNorthernIrelandPoint(release: NiRelease): boolean {
  return release.series.some(
    (series) => series.geography_id === "NI" && series.source_line === SONI_SOURCE_LINE && series.points.some((point) => point.value != null),
  );
}

function newestFuelInstant(series: readonly (readonly { time: string }[])[]): string | null {
  let newest: string | null = null;
  for (const points of series) {
    for (const point of points) {
      if (!newest || point.time > newest) {
        newest = point.time;
      }
    }
  }
  return newest;
}

function latestSoniInstant(release: NiRelease): Date | null {
  let latest: Date | null = null;
  for (const series of release.series) {
    if (series.geography_id !== "NI" || series.source_line !== SONI_SOURCE_LINE) {
      continue;
    }
    if (series.metric_id.endsWith("_forecast")) {
      continue;
    }
    for (const point of series.points) {
      if (point.value == null) {
        continue;
      }
      const instant = parseUtcDateTime(point.time);
      if (!latest || instant.getTime() > latest.getTime()) {
        latest = instant;
      }
    }
  }
  return latest;
}

function specFor(metricId: string): EirgridSeriesSpec {
  const spec = EIRGRID_SERIES.find((series) => series.metric_id === metricId);
  if (!spec) {
    throw new Error(`unknown NI metric ${metricId}`);
  }
  return spec;
}

function formatFigure(value: number, unit: string): string {
  if (unit === "€/MWh") {
    return `€${value.toFixed(2)}`;
  }
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export function releaseContainsSterling(release: NiRelease): boolean {
  return JSON.stringify(release).includes("£") || JSON.stringify(release).includes("GBP");
}

export function releaseGeographies(release: NiRelease): string[] {
  return [...new Set(release.series.map((series) => series.geography_id))];
}

export { SEMO_SOURCE_LINE };
