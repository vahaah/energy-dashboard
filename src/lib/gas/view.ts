import type { DataState } from "@/lib/data-state";
import type { GasPageBasis } from "@/lib/gas/copy";

export type GasDayState = "partial" | "complete";

export type GasStamp = {
  dataTime: string;
  dataTimeLabel: string;
  publishedAt: string;
  publishedLabel: string;
  retrievedAt: string;
  retrievedLabel: string;
};

export type GasShareRow = {
  publicationId: string;
  label: string;
  valueLabel: string;
  unit: string;
  percent: number;
  note: string | null;
};

export type GasSeriesPoint = {
  at: string;
  label: string;
  supply: number | null;
  demand: number | null;
  supplyForecast: number | null;
  demandForecast: number | null;
};

export type GasStat = {
  id: "supply" | "demand" | "linepack" | "storage";
  title: string;
  valueLabel: string;
  unit: string;
  basisLabel: string;
  /** Set when the figure is taken from another gas day. */
  asOfLabel: string | null;
  state: DataState | null;
};

export type GasLinepack = {
  description: string;
  opening: string;
  current: string;
  predictedClose: string;
  close: string | null;
  openingAsOf: string | null;
  currentAsOf: string | null;
  predictedCloseAsOf: string | null;
  closeAsOf: string | null;
  unit: string;
};

export type GasStorage = {
  injection: string;
  withdrawal: string;
  unit: string;
  notice: string;
  injectionAsOf: string | null;
  withdrawalAsOf: string | null;
};

export type GasBridge = {
  period: string;
  offtake: { valueLabel: string; unit: string; at: string; atLabel: string };
  generation: { valueLabel: string; unit: string; at: string; atLabel: string };
};

export type GasComparisonRow = {
  day: string;
  dayLabel: string;
  basis: GasPageBasis;
  state: GasDayState;
  supply: string;
  demand: string;
};

export type GasSlice = {
  day: string;
  basis: GasPageBasis;
  bases: GasPageBasis[];
  state: GasDayState;
  dayLabel: string;
  stamp: GasStamp;
  staleText: string | null;
  partialText: string | null;
  stats: GasStat[];
  series: GasSeriesPoint[];
  /** Draw the Now line only when this instant sits inside the gas day. */
  now: string | null;
  entry: GasShareRow[];
  demand: GasShareRow[];
  /** Set when the demand breakdown is taken from another gas day. */
  demandAsOfLabel: string | null;
  linepack: GasLinepack;
  storage: GasStorage;
  bridge: GasBridge | null;
  comparison: GasComparisonRow[];
  footer: string;
};

export type GasDayOption = {
  label: string;
  text: string;
};

export type GasDocument =
  | { available: false }
  | {
      available: true;
      days: GasDayOption[];
      defaultDay: string;
      defaultBasis: GasPageBasis;
      slices: GasSlice[];
    };

export function selectGasSlice(
  document: Extract<GasDocument, { available: true }>,
  day: string | null,
  basis: string | null,
): GasSlice {
  const dayLabel = document.days.some((option) => option.label === day) ? day : document.defaultDay;
  const onDay = document.slices.filter((slice) => slice.day === dayLabel);
  const matched = onDay.find((slice) => slice.basis === basis);
  const slice = matched ?? onDay.find((item) => item.basis === document.defaultBasis) ?? onDay[0] ?? document.slices[0];
  if (!slice) {
    throw new Error("gas document has no slice");
  }
  return slice;
}
