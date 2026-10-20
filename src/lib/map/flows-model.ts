import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assetPath } from "@/lib/assets/href";
import {
  GEONAMES_ATTRIBUTION,
  NATIONAL_GAS_ATTRIBUTION,
  NESO_OPEN_DATA_ATTRIBUTION,
  elexonBmrsAttribution,
} from "@/lib/attribution";
import {
  gasTerminalsFileSchema,
  interconnectorsFileSchema,
  type GasTerminalRecord,
  type InterconnectorRecord,
} from "@/lib/catalogue/links/schema";
import { layersFileSchema } from "@/lib/catalogue/layers";
import type { CapacityRelease } from "@/lib/map/capacity";
import type { ElectricityFlowsRelease } from "@/lib/map/electricity-release";
import {
  electricityDirectionWords,
  electricityWidthPx,
  formatFlowReading,
  gasDirectionWords,
  gasWidthPx,
  utilisationPercent,
} from "@/lib/map/flow-scale";
import { FLOWS_STANDFIRST, FLOWS_TITLE, GAS_FLOWS_UNAVAILABLE, STRAIGHT_LINE_LABEL } from "@/lib/map/flows-copy";
import type { FlowsFeature, FlowsPageModel } from "@/lib/map/flows-types";
import type { GasTerminalFlowsRelease } from "@/lib/map/gas-terminal-flows";

export type { FlowsCredit, FlowsFeature, FlowsPageModel } from "@/lib/map/flows-types";

export const FLOWS_HTML_BUDGET_BYTES = 20_000;

export type FlowsModelInput = {
  interconnectors: readonly InterconnectorRecord[];
  terminals: readonly GasTerminalRecord[];
  electricity: ElectricityFlowsRelease | null;
  gas: GasTerminalFlowsRelease | null;
  capacity: CapacityRelease | null;
  basemapAttribution: string;
  dnoAttribution: string;
  dnoWarning: string | null;
  dnoPath: string;
  elexonAttribution: string;
  nationalGasAttribution: string;
  geonamesAttribution: string;
  nesoAttribution: string;
};

function capacityFor(code: string, capacity: CapacityRelease | null) {
  return capacity?.rows.find((row) => row.code === code) ?? null;
}

function capacityLabel(code: string, capacity: CapacityRelease | null): string {
  const row = capacityFor(code, capacity);
  if (!row || (row.importMw === null && row.exportMw === null)) {
    return "Not yet available";
  }
  const parts: string[] = [];
  if (row.importMw !== null) {
    parts.push(`Import ${formatFlowReading(row.importMw, "MW")}`);
  }
  if (row.exportMw !== null) {
    parts.push(`Export ${formatFlowReading(row.exportMw, "MW")}`);
  }
  return parts.join(". ");
}

function utilisationLabel(mw: number | null, code: string, capacity: CapacityRelease | null): string | null {
  const row = capacityFor(code, capacity);
  if (!row || mw === null || mw === 0) {
    return null;
  }
  const cap = mw > 0 ? row.importMw : row.exportMw;
  const percent = utilisationPercent(Math.abs(mw), cap);
  if (percent === null || cap === null) {
    return null;
  }
  const side = mw > 0 ? "import" : "export";
  return `${percent}% of the ${formatFlowReading(cap, "MW")} ${side} capacity`;
}

export function buildFlowsPageModel(input: FlowsModelInput): FlowsPageModel {
  const electricityByCode = new Map((input.electricity?.series ?? []).map((series) => [series.code, series]));
  const gasByKey = new Map((input.gas?.samples ?? []).map((sample) => [sample.key, sample]));
  const features: FlowsFeature[] = [];

  for (const record of input.interconnectors) {
    const series = electricityByCode.get(record.fuelinst_code) ?? null;
    const mw = series?.latestMw ?? null;
    features.push({
      id: record.interconnector_id,
      kind: "interconnector",
      name: record.name,
      href: assetPath(record.interconnector_id, record.name),
      latitude: record.gb_latitude,
      counterparty: record.remote_outside_gb ? `${record.remote_country}, outside GB` : record.remote_country,
      counterpartyOutsideGb: record.remote_outside_gb,
      landing: record.gb_label,
      remoteLanding: record.remote_label,
      credit: `${input.elexonAttribution} ${record.gb_coordinate_citation} ${record.remote_coordinate_citation} ${input.nesoAttribution}.`,
      capacityLabel: capacityLabel(record.fuelinst_code, input.capacity),
      utilisation: utilisationLabel(mw, record.fuelinst_code, input.capacity),
      reading: formatFlowReading(mw, "MW"),
      readingAt: series?.latestAt ?? null,
      value: mw,
      direction: electricityDirectionWords(mw),
      width: mw === null ? null : electricityWidthPx(Math.abs(mw)),
      unit: "MW",
      spark: series?.spark?.values ?? null,
      gbLongitude: record.gb_longitude,
      gbLatitude: record.gb_latitude,
      remoteLongitude: record.remote_longitude,
      remoteLatitude: record.remote_latitude,
    });
  }

  for (const record of input.terminals) {
    if (record.latitude === null || record.longitude === null) {
      continue;
    }
    const sample = gasByKey.get(record.key) ?? null;
    const rate = sample?.mcmPerDay ?? null;
    const history = input.gas?.history[record.key] ?? [];
    features.push({
      id: record.asset_id,
      kind: "gas_terminal",
      name: record.name,
      href: assetPath(record.asset_id, record.name),
      latitude: record.latitude,
      counterparty: null,
      counterpartyOutsideGb: false,
      landing: record.name,
      remoteLanding: null,
      credit: `${input.nationalGasAttribution} ${record.coordinate_citation ?? ""}`.trim(),
      capacityLabel: "Not yet available",
      utilisation: null,
      reading: formatFlowReading(rate, "mcm/d"),
      readingAt: sample?.at ?? null,
      value: rate,
      direction: gasDirectionWords(record.role, rate),
      width: rate === null ? null : gasWidthPx(rate),
      unit: "mcm/d",
      spark: history.length > 0 ? history.map((item) => item.mcmPerDay) : sample ? [sample.mcmPerDay] : null,
      gbLongitude: record.longitude,
      gbLatitude: record.latitude,
      remoteLongitude: null,
      remoteLatitude: null,
    });
  }

  features.sort((left, right) => right.latitude - left.latitude || left.name.localeCompare(right.name));

  const electricityValues = features.filter((feature) => feature.kind === "interconnector");
  const present = electricityValues.filter((feature) => feature.value !== null);
  const netElectricityMw = present.length
    ? present.reduce((sum, feature) => sum + (feature.value ?? 0), 0)
    : null;

  let netGasMcm: number | null = null;
  if (input.gas && input.gas.samples.length > 0) {
    netGasMcm = 0;
    for (const sample of input.gas.samples) {
      netGasMcm += sample.role === "exit" ? -sample.mcmPerDay : sample.mcmPerDay;
    }
  }

  const electricityTimes = present.map((feature) => feature.readingAt).filter((at): at is string => Boolean(at));
  const gasTimes = (input.gas?.samples ?? []).map((sample) => sample.at);

  return {
    title: FLOWS_TITLE,
    standfirst: FLOWS_STANDFIRST,
    straightLine: STRAIGHT_LINE_LABEL,
    gasUnavailable: GAS_FLOWS_UNAVAILABLE,
    feed: input.electricity ? "ok" : "unavailable",
    gasFlows: input.gas && input.gas.samples.length > 0 ? "published" : "unavailable",
    features,
    electricityLatestAt: electricityTimes.sort().at(-1) ?? null,
    gasLatestAt: gasTimes.sort().at(-1) ?? null,
    netElectricityMw,
    electricityIncluded: present.length,
    electricityMissing: electricityValues.length - present.length,
    netGasMcm,
    credits: [
      { id: "basemap", text: input.basemapAttribution, layer: "basemap" },
      { id: "dno", text: input.dnoAttribution, layer: "dno" },
      { id: "electricity", text: input.elexonAttribution, layer: "electricity" },
      { id: "gas", text: input.nationalGasAttribution, layer: "gas" },
      { id: "places", text: input.geonamesAttribution, layer: "places" },
      { id: "capacity", text: `${input.nesoAttribution}.`, layer: "electricity" },
    ],
    dnoPath: input.dnoPath,
    dnoWarning: input.dnoWarning,
  };
}

export function flowsModelBytes(model: FlowsPageModel): number {
  return Buffer.byteLength(JSON.stringify(model));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function catalogueFlowsInput(root = process.cwd()): Omit<
  FlowsModelInput,
  "electricity" | "gas" | "capacity"
> {
  const catalogue = join(root, "data", "catalogue");
  const layers = layersFileSchema.parse(readJson(join(catalogue, "layers.json")));
  const basemap = layers.find((layer) => layer.id === "basemap");
  const dno = layers.find((layer) => layer.id === "dno");
  if (!basemap || !dno) {
    throw new Error("map layers are missing");
  }
  return {
    interconnectors: interconnectorsFileSchema.parse(readJson(join(catalogue, "interconnectors.json"))),
    terminals: gasTerminalsFileSchema.parse(readJson(join(catalogue, "gas_terminals.json"))),
    basemapAttribution: basemap.attribution,
    dnoAttribution: dno.attribution,
    dnoWarning: dno.accuracy_warning,
    dnoPath: new URL(dno.url).pathname,
    elexonAttribution: elexonBmrsAttribution(2026),
    nationalGasAttribution: NATIONAL_GAS_ATTRIBUTION,
    geonamesAttribution: GEONAMES_ATTRIBUTION,
    nesoAttribution: NESO_OPEN_DATA_ATTRIBUTION,
  };
}
