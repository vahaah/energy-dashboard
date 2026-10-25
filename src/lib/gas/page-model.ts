import { ABSENT_FIGURE, cadenceDeadline, isBeyondCadence, type DataState } from "@/lib/data-state";
import { displayedPercents, formatDisplay } from "@/lib/display-rounding";
import {
  GAS_ATTRIBUTION,
  GAS_BASIS_LABEL,
  GAS_LDZ_HEADING,
  GAS_LDZ_NOTE,
  GAS_LDZ_PUBLICATION_ID,
  GAS_LINEPACK_DESCRIPTION,
  GAS_PAGE_BASES,
  GAS_STORAGE_NOTICE,
  GAS_UNIT_DAY,
  GAS_UNIT_STOCK,
  entryAtTerminal,
  gasDayLabelText,
  gasPartialText,
  gasStaleText,
  type GasPageBasis,
} from "@/lib/gas/copy";
import type {
  GasBridge,
  GasComparisonRow,
  GasDayState,
  GasDocument,
  GasLinepack,
  GasSeriesPoint,
  GasShareRow,
  GasSlice,
  GasStat,
  GasStorage,
} from "@/lib/gas/view";
import {
  DEMAND_PART_NAMES,
  NTS_ACTUAL_LINEPACK,
  NTS_DEMAND_FLOW,
  STORAGE_DEMAND_FLOW,
  STORAGE_WITHDRAWAL_SITES,
} from "@/lib/ingest/national-gas/instantaneous";
import type { GasQuantityKind } from "@/lib/ingest/national-gas/quantity";
import type { GasComponent, GasInstantaneousSample, GasRelease } from "@/lib/ingest/national-gas/release";
import {
  formatLondonClock,
  formatLondonDateTimeStamp,
  formatLondonDayMonthYear,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
  utcIsoFromTimestamp,
} from "@/lib/london-time";
import { GAS_METRICS, staleGrace } from "@/lib/metrics";
import type { Generation5min } from "@/lib/types";

const SUPPLY_RATE = "PUBOB2042";
const SUPPLY_NORTH = "PUBOB2043";
const SUPPLY_SOUTH = "PUBOB2044";
const SUPPLY_FORECAST = "PUBOB19";
const SUPPLY_VOLUME = "PUBOBJ635";
const DEMAND_VOLUME = "PUBOB637";
const LINEPACK_OPEN = "PUBOB693";
const LINEPACK_INTERIM = "PUBOB29";
const LINEPACK_PCLP1 = "PUBOB30";
const LINEPACK_PCLP2 = "PUBOB31";
const LINEPACK_CLOSE = "PUBOB694";
const STORAGE_INJECTION = "PUBOBJ1016";
const STORAGE_WITHDRAWAL = "PUBOBJ630";
const POWER_OFFTAKE = "PUBOBJ1017";

const DEMAND_PARTS = [GAS_LDZ_PUBLICATION_ID, POWER_OFFTAKE, "PUBOBJ1018", STORAGE_INJECTION, "PUBOBJ1020"] as const;

const FLOW_DEMAND_LABELS: Record<(typeof DEMAND_PART_NAMES)[number], { label: string; note: string | null }> = {
  "Industrial Demand Flow": { label: "Industrial", note: null },
  "Interconnector Export Demand Flow": { label: "Interconnector export", note: null },
  "LDZ Offtake Flow": { label: GAS_LDZ_HEADING, note: GAS_LDZ_NOTE },
  "Power Station Demand Flow": { label: "Power stations", note: null },
  [STORAGE_DEMAND_FLOW]: { label: "Storage injection", note: null },
};

const ENTRY_PARTS = [SUPPLY_NORTH, SUPPLY_SOUTH] as const;

/** FUELINST half-hour. A shorter fragment is not a gas day. */
const GENERATION_STEP_MS = 30 * 60 * 1000;

const GAS_METRIC_BY_PUBLICATION = new Map(Object.values(GAS_METRICS).map((metric) => [metric.dataset_id, metric]));

export type GasGenerationSample = {
  at: string;
  mw: number;
};

/** Bases the release validated, in control order. Anything else stays hidden. */
export function visibleGasBases(bases: readonly string[]): GasPageBasis[] {
  return GAS_PAGE_BASES.filter((basis) => bases.includes(basis));
}

export function sameBasisComparison<T extends { day: string; basis: GasPageBasis }>(
  selected: { day: string; basis: GasPageBasis },
  rows: readonly T[],
): T[] {
  return rows.filter((row) => row.day !== selected.day && row.basis === selected.basis);
}

export function buildGasDocument(
  releases: readonly GasRelease[],
  now: Date,
  generation: readonly Generation5min[] | null,
): GasDocument {
  const ordered = [...releases].sort((left, right) => right.gas_day.label.localeCompare(left.gas_day.label));
  if (ordered.length === 0 || !ordered[0]) {
    return { available: false };
  }
  const samples = generationSamples(generation);
  const slices = ordered.flatMap((release) =>
    visibleGasBases(release.bases).map((basis) => buildSlice(release, basis, ordered, now, samples)),
  );
  const first = slices[0];
  if (!first) {
    return { available: false };
  }
  const newest = ordered[0];
  const newestFlow = slices.find((slice) => slice.day === newest.gas_day.label && slice.basis === "flow");
  const newestComplete = slices
    .filter((slice) => slice.basis === "completed" && slice.state === "complete")
    .sort((left, right) => right.day.localeCompare(left.day))[0];
  const chosen =
    newestFlow && !isThinSlice(newestFlow)
      ? newestFlow
      : newestFlow && isThinSlice(newestFlow) && newestComplete
        ? newestComplete
        : first;
  return {
    available: true,
    days: ordered.map((release) => ({
      label: release.gas_day.label,
      text: formatLondonDayMonthYear(release.gas_day.label),
    })),
    defaultDay: chosen.day,
    defaultBasis: chosen.basis,
    slices,
  };
}

function buildSlice(
  release: GasRelease,
  basis: GasPageBasis,
  history: readonly GasRelease[],
  now: Date,
  generation: readonly GasGenerationSample[],
): GasSlice {
  const bases = visibleGasBases(release.bases);
  const state = basisState(release, basis, now);
  const rows = componentsFor(release, basis);
  const stampSource = rows.length > 0 ? rows : release.components;
  const published = latestPublished(stampSource);
  const freshness = flowFreshness(release, basis, stampFrom(stampSource), published ? isStalePublication(published, now) : false, now);
  const stamp = freshness.stamp;
  const stale = freshness.stale;
  const coverage = coverageBounds(rows);
  const dayLabel = gasDayLabel(release);
  const partialText =
    state === "partial" && coverage
      ? gasPartialText(coverage.start, coverage.latest)
      : null;
  const demand = demandShareBlock(release, history, basis);

  return {
    day: release.gas_day.label,
    basis,
    bases,
    state,
    dayLabel,
    stamp,
    staleText: stale ? gasStaleText(stamp.dataTimeLabel) : null,
    partialText,
    stats: [
      supplyStat(release, now),
      demandStat(release, history, basis, now),
      linepackStat(release, history, basis, now),
      storageStat(release, history, basis, now),
    ],
    series: seriesFor(release, basis, now),
    now: nowInsideDay(release, now),
    entry: entryShares(release, basis),
    demand: demand.rows,
    demandAsOfLabel: demand.asOfLabel,
    linepack: linepackFigures(release, history),
    storage: storageFigures(release, history, basis),
    bridge: bridgeFor(release, generation),
    comparison: comparisonFor(release, basis, history, now),
    footer: `${dayLabel}. ${publicationFooter()}. ${GAS_ATTRIBUTION}`,
  };
}

export function basisState(release: GasRelease, basis: GasPageBasis, now: Date): GasDayState {
  const end = Date.parse(release.gas_day.end);
  switch (basis) {
    case "completed": {
      const supply = latestValue(release, SUPPLY_VOLUME, "completed");
      const demand = latestValue(release, DEMAND_VOLUME, "completed");
      if (supply?.value != null && demand?.value != null && now.getTime() >= end) {
        return "complete";
      }
      return "partial";
    }
    case "flow":
    case "to-date": {
      if (now.getTime() < end || !hourlySeriesCoversDay(release, basis)) {
        return "partial";
      }
      return "complete";
    }
    default: {
      const exhaustive: never = basis;
      return exhaustive;
    }
  }
}

function supplyStat(release: GasRelease, now: Date): GasStat {
  const completed = latestValue(release, SUPPLY_VOLUME, "completed");
  const flow = latestValue(release, SUPPLY_RATE, "flow");
  const chosen =
    basisState(release, "completed", now) === "complete" && completed?.value != null
      ? completed
      : (flow ?? completed);
  return stat("supply", "Supply (NTS entry)", chosen, unitFor(chosen), release, now, null);
}

function demandStat(
  release: GasRelease,
  history: readonly GasRelease[],
  basis: GasPageBasis,
  now: Date,
): GasStat {
  if (basis !== "completed") {
    const sample = latestInstantaneous(release, "demand");
    if (sample) {
      return flowStat("demand", "Demand (NTS exit)", sample.value, GAS_UNIT_DAY, basisState(release, basis, now));
    }
  }
  const own = latestValue(release, DEMAND_VOLUME, "completed");
  if (own?.value != null) {
    return stat("demand", "Demand (NTS exit)", own, GAS_UNIT_STOCK, release, now, null);
  }
  const borrowed = borrowedRelease(release, history, (item) => latestValue(item, DEMAND_VOLUME, "completed")?.value != null);
  const component = borrowed ? latestValue(borrowed, DEMAND_VOLUME, "completed") : null;
  return stat(
    "demand",
    "Demand (NTS exit)",
    component,
    GAS_UNIT_STOCK,
    borrowed ?? release,
    now,
    borrowed ? formatLondonDayMonthYear(borrowed.gas_day.label) : null,
  );
}

function linepackStat(
  release: GasRelease,
  history: readonly GasRelease[],
  basis: GasPageBasis,
  now: Date,
): GasStat {
  const current = basis === "completed" ? null : resolveNumber(release, history, currentLinepack);
  const opening = resolveNumber(release, history, openingLinepack);
  const chosen = current ?? opening;
  if (!chosen) {
    return stat("linepack", "Linepack", null, GAS_UNIT_STOCK, release, now, null);
  }
  if (current && chosen === current && current.asOfLabel == null) {
    return flowStat("linepack", "Linepack", chosen.value, GAS_UNIT_STOCK, basisState(release, basis, now));
  }
  if (chosen.asOfLabel) {
    return datedStat("linepack", "Linepack", chosen.value, GAS_UNIT_STOCK, GAS_BASIS_LABEL.completed, chosen.asOfLabel);
  }
  return stat(
    "linepack",
    "Linepack",
    firstFinite(release, [LINEPACK_OPEN, LINEPACK_INTERIM]),
    GAS_UNIT_STOCK,
    release,
    now,
    null,
  );
}

function storageStat(
  release: GasRelease,
  history: readonly GasRelease[],
  basis: GasPageBasis,
  now: Date,
): GasStat {
  const pair = storagePair(release, history, basis);
  if (!pair) {
    return stat("storage", "Storage net flow", null, GAS_UNIT_STOCK, release, now, null);
  }
  const net = pair.withdrawal - pair.injection;
  if (pair.flow && pair.asOfLabel == null) {
    return flowStat("storage", "Storage net flow", net, pair.unit, basisState(release, basis, now));
  }
  if (pair.asOfLabel || pair.flow) {
    return datedStat(
      "storage",
      "Storage net flow",
      net,
      pair.unit,
      pair.flow ? GAS_BASIS_LABEL.flow : GAS_BASIS_LABEL.completed,
      pair.asOfLabel,
    );
  }
  const withdrawal = latestAny(release, STORAGE_WITHDRAWAL);
  return stat(
    "storage",
    "Storage net flow",
    withdrawal ? { ...withdrawal, value: net } : null,
    pair.unit,
    release,
    now,
    null,
  );
}

function datedStat(
  id: GasStat["id"],
  title: string,
  value: number,
  unit: string,
  basisLabel: string,
  asOfLabel: string | null,
): GasStat {
  return {
    id,
    title,
    valueLabel: formatQuantity(value),
    unit,
    basisLabel,
    asOfLabel,
    state: null,
  };
}

function flowStat(
  id: GasStat["id"],
  title: string,
  value: number,
  unit: string,
  day: GasDayState,
): GasStat {
  return {
    id,
    title,
    valueLabel: formatQuantity(value),
    unit,
    basisLabel: GAS_BASIS_LABEL.flow,
    asOfLabel: null,
    state: day === "partial" ? "partial" : null,
  };
}

function stat(
  id: GasStat["id"],
  title: string,
  component: GasComponent | null,
  unit: string,
  release: GasRelease,
  now: Date,
  asOfLabel: string | null,
): GasStat {
  if (!component || component.value == null) {
    return {
      id,
      title,
      valueLabel: ABSENT_FIGURE,
      unit,
      basisLabel: GAS_BASIS_LABEL[component?.basis ?? "completed"],
      asOfLabel: null,
      state: "not_yet_available",
    };
  }
  const basis = isPageBasis(component.basis) ? component.basis : "completed";
  const state = asOfLabel ? null : componentState(component, basisState(release, basis, now), now);
  return {
    id,
    title,
    valueLabel: formatQuantity(component.value),
    unit,
    basisLabel: asOfLabel ? GAS_BASIS_LABEL.completed : GAS_BASIS_LABEL[basis],
    asOfLabel,
    state,
  };
}

function seriesFor(release: GasRelease, basis: GasPageBasis, now: Date): GasSeriesPoint[] {
  if (basis === "completed") {
    return completedPoint(release, now);
  }
  const nowMs = now.getTime();
  const supplyId = supplySeriesId(basis);
  const points = new Map<string, GasSeriesPoint>();
  const touch = (at: string): GasSeriesPoint => {
    const existing = points.get(at);
    if (existing) {
      return existing;
    }
    const created: GasSeriesPoint = {
      at,
      label: formatLondonClock(parseUtcDateTime(at)),
      supply: null,
      demand: null,
      supplyForecast: null,
      demandForecast: null,
    };
    points.set(at, created);
    return created;
  };

  for (const row of release.components) {
    if (row.value == null || !isPageBasis(row.basis) || row.basis !== basis) {
      continue;
    }
    if (row.quantity_kind === "forecast") {
      if (row.publication_id === SUPPLY_FORECAST) {
        touch(row.applicable_at).supplyForecast = row.value;
      }
      continue;
    }
    if (Date.parse(row.applicable_at) > nowMs) {
      continue;
    }
    if (supplyId && row.publication_id === supplyId && row.quantity_kind !== "stock") {
      touch(row.applicable_at).supply = row.value;
    }
  }

  if (basis === "flow") {
    for (const sample of release.instantaneous) {
      if (sample.role !== "demand" || sample.name !== NTS_DEMAND_FLOW || Date.parse(sample.applicable_at) > nowMs) {
        continue;
      }
      touch(sample.applicable_at).demand = sample.value;
    }
  }

  return [...points.values()].sort((left, right) => left.at.localeCompare(right.at));
}

function completedPoint(release: GasRelease, now: Date): GasSeriesPoint[] {
  const supply = latestValue(release, SUPPLY_VOLUME, "completed");
  const demand = latestValue(release, DEMAND_VOLUME, "completed");
  if ((supply?.value == null && demand?.value == null) || Date.parse(release.gas_day.start) > now.getTime()) {
    return [];
  }
  return [
    {
      at: release.gas_day.start,
      label: formatLondonClock(parseUtcDateTime(release.gas_day.start)),
      supply: supply?.value ?? null,
      demand: demand?.value ?? null,
      supplyForecast: null,
      demandForecast: null,
    },
  ];
}

function supplySeriesId(basis: GasPageBasis): string | null {
  switch (basis) {
    case "flow":
      return SUPPLY_RATE;
    case "completed":
      return SUPPLY_VOLUME;
    case "to-date":
      return null;
    default: {
      const exhaustive: never = basis;
      return exhaustive;
    }
  }
}

function entryShares(release: GasRelease, basis: GasPageBasis): GasShareRow[] {
  if (basis !== "flow") {
    return [];
  }
  const parts = ENTRY_PARTS.flatMap((id) => {
    const row = latestValue(release, id, "flow");
    if (!row || row.value == null) {
      return [];
    }
    return [{ id, label: entryLabel(row), value: row.value, note: null }];
  });
  if (parts.length !== ENTRY_PARTS.length) {
    return [];
  }
  return shareRows(parts, GAS_UNIT_DAY);
}

function demandShareBlock(
  release: GasRelease,
  history: readonly GasRelease[],
  basis: GasPageBasis,
): { rows: GasShareRow[]; asOfLabel: string | null } {
  if (basis !== "completed") {
    const flow = flowDemandShares(release);
    if (flow.length > 0) {
      return { rows: flow, asOfLabel: null };
    }
  }
  const own = completedDemandShares(release);
  if (own.length > 0) {
    return { rows: own, asOfLabel: null };
  }
  for (const other of newestFirst(history)) {
    if (other.gas_day.label === release.gas_day.label) {
      continue;
    }
    const rows = completedDemandShares(other);
    if (rows.length > 0) {
      return { rows, asOfLabel: formatLondonDayMonthYear(other.gas_day.label) };
    }
  }
  return { rows: [], asOfLabel: null };
}

function flowDemandShares(release: GasRelease): GasShareRow[] {
  const parts = DEMAND_PART_NAMES.flatMap((name) => {
    const sample = latestInstantaneous(release, "demand_part", name);
    if (!sample) {
      return [];
    }
    const copy = FLOW_DEMAND_LABELS[name];
    return [{ id: name, label: copy.label, value: sample.value, note: copy.note }];
  });
  if (parts.length !== DEMAND_PART_NAMES.length) {
    return [];
  }
  return shareRows(parts, GAS_UNIT_DAY);
}

function completedDemandShares(release: GasRelease): GasShareRow[] {
  const parts = DEMAND_PARTS.flatMap((id) => {
    const row = latestValue(release, id, "completed");
    if (!row || row.value == null) {
      return [];
    }
    return [
      {
        id,
        label: id === GAS_LDZ_PUBLICATION_ID ? GAS_LDZ_HEADING : row.name,
        value: row.value,
        note: id === GAS_LDZ_PUBLICATION_ID ? GAS_LDZ_NOTE : null,
      },
    ];
  });
  if (parts.length !== DEMAND_PARTS.length) {
    return [];
  }
  return shareRows(parts, GAS_UNIT_STOCK);
}

function shareRows(
  parts: readonly { id: string; label: string; value: number; note: string | null }[],
  unit: string,
): GasShareRow[] {
  const usable = parts.filter((part) => part.value > 0);
  if (usable.length === 0) {
    return [];
  }
  const sum = usable.reduce((total, part) => total + part.value, 0);
  const percents = displayedPercents(usable.map((part) => (part.value / sum) * 100));
  return usable.map((part, index) => ({
    publicationId: part.id,
    label: part.label,
    valueLabel: formatQuantity(part.value),
    unit,
    percent: percents[index] ?? 0,
    note: part.note,
  }));
}

function entryLabel(row: GasComponent): string {
  const terminal = terminalName(row.name);
  return terminal ? entryAtTerminal(terminal) : row.name;
}

function terminalName(name: string): string | null {
  const match = /^Entry at (.+)$/.exec(name);
  return match?.[1] ?? null;
}

function linepackFigures(release: GasRelease, history: readonly GasRelease[]): GasLinepack {
  const opening = resolveNumber(release, history, openingLinepack);
  const current = resolveNumber(release, history, currentLinepack);
  const predicted = resolveNumber(release, history, predictedLinepack);
  const close = resolveNumber(release, history, closeLinepack);
  return {
    description: GAS_LINEPACK_DESCRIPTION,
    opening: formatQuantity(opening?.value ?? null),
    current: formatQuantity(current?.value ?? null),
    predictedClose: formatQuantity(predicted?.value ?? null),
    close: close ? formatQuantity(close.value) : null,
    openingAsOf: opening?.asOfLabel ?? null,
    currentAsOf: current?.asOfLabel ?? null,
    predictedCloseAsOf: predicted?.asOfLabel ?? null,
    closeAsOf: close?.asOfLabel ?? null,
    unit: GAS_UNIT_STOCK,
  };
}

function storageFigures(release: GasRelease, history: readonly GasRelease[], basis: GasPageBasis): GasStorage {
  const pair = storagePair(release, history, basis);
  return {
    injection: formatQuantity(pair?.injection ?? null),
    withdrawal: formatQuantity(pair?.withdrawal ?? null),
    unit: pair?.unit ?? GAS_UNIT_STOCK,
    notice: GAS_STORAGE_NOTICE,
    injectionAsOf: pair?.asOfLabel ?? null,
    withdrawalAsOf: pair?.asOfLabel ?? null,
  };
}

function bridgeFor(release: GasRelease, generation: readonly GasGenerationSample[]): GasBridge | null {
  const offtake = latestAny(release, POWER_OFFTAKE);
  if (!offtake || offtake.value == null) {
    return null;
  }
  const start = Date.parse(release.gas_day.start);
  const end = Date.parse(release.gas_day.end);
  const inside = generation.filter((sample) => {
    const at = Date.parse(sample.at);
    return at >= start && at < end;
  });
  if (!coversHalfOpenRange(inside.map((sample) => Date.parse(sample.at)), start, end, GENERATION_STEP_MS)) {
    return null;
  }
  const latest = [...inside].sort((left, right) => left.at.localeCompare(right.at)).at(-1);
  if (!latest) {
    return null;
  }
  const meanMw = inside.reduce((total, sample) => total + sample.mw, 0) / inside.length;
  return {
    period: gasDayLabel(release),
    offtake: {
      valueLabel: formatQuantity(offtake.value),
      unit: GAS_UNIT_STOCK,
      at: offtake.applicable_at,
      atLabel: formatLondonDateTimeStamp(parseUtcDateTime(offtake.applicable_at)),
    },
    generation: {
      valueLabel: formatQuantity(meanMw / 1000),
      unit: "GW",
      at: latest.at,
      atLabel: formatLondonDateTimeStamp(parseUtcDateTime(latest.at)),
    },
  };
}

export function generationSamples(rows: readonly Generation5min[] | null): GasGenerationSample[] {
  if (!rows) {
    return [];
  }
  const byTime = new Map<string, number>();
  for (const row of rows) {
    const fuel = row.fuel_type.trim().toLowerCase();
    if (fuel !== "ccgt" && fuel !== "ocgt") {
      continue;
    }
    const at = utcIsoFromTimestamp(row.timestamp);
    if (!at || !Number.isFinite(row.generation_mw)) {
      continue;
    }
    byTime.set(at, (byTime.get(at) ?? 0) + row.generation_mw);
  }
  return [...byTime.entries()].map(([at, mw]) => ({ at, mw }));
}

function comparisonFor(
  release: GasRelease,
  basis: GasPageBasis,
  history: readonly GasRelease[],
  now: Date,
): GasComparisonRow[] {
  const rows = history.flatMap((other) => {
    if (!visibleGasBases(other.bases).includes(basis)) {
      return [];
    }
    const supply = headlineNumber(other, basis, "supply");
    const demand = headlineNumber(other, basis, "demand");
    return [
      {
        day: other.gas_day.label,
        dayLabel: gasDayLabel(other),
        basis,
        state: basisState(other, basis, now),
        supply: formatQuantity(supply),
        demand: formatQuantity(demand),
      } satisfies GasComparisonRow,
    ];
  });
  return sameBasisComparison({ day: release.gas_day.label, basis }, rows);
}

function headlineNumber(release: GasRelease, basis: GasPageBasis, kind: "supply" | "demand"): number | null {
  if (kind === "supply") {
    const id = supplySeriesId(basis);
    return id ? (latestValue(release, id, basis)?.value ?? null) : null;
  }
  switch (basis) {
    case "completed":
      return latestValue(release, DEMAND_VOLUME, "completed")?.value ?? null;
    case "flow":
      return latestInstantaneous(release, "demand", NTS_DEMAND_FLOW)?.value ?? null;
    case "to-date":
      return null;
    default: {
      const exhaustive: never = basis;
      return exhaustive;
    }
  }
}

function componentsFor(release: GasRelease, basis: GasPageBasis): GasComponent[] {
  return release.components.filter((row) => row.basis === basis);
}

function latestValue(release: GasRelease, publicationId: string, basis: GasPageBasis): GasComponent | null {
  return latestOf(release.components.filter((row) => row.publication_id === publicationId && row.basis === basis));
}

function latestAny(release: GasRelease, publicationId: string): GasComponent | null {
  return latestOf(release.components.filter((row) => row.publication_id === publicationId));
}

function latestOf(rows: readonly GasComponent[]): GasComponent | null {
  let best: GasComponent | null = null;
  for (const row of rows) {
    if (
      !best ||
      row.applicable_at > best.applicable_at ||
      (row.applicable_at === best.applicable_at && row.published_at > best.published_at)
    ) {
      best = row;
    }
  }
  return best;
}

function finiteValue(release: GasRelease, publicationId: string): GasComponent | null {
  const row = latestAny(release, publicationId);
  if (!row || row.value == null || !Number.isFinite(row.value)) {
    return null;
  }
  return row;
}

function firstFinite(release: GasRelease, publicationIds: readonly string[]): GasComponent | null {
  for (const publicationId of publicationIds) {
    const row = finiteValue(release, publicationId);
    if (row) {
      return row;
    }
  }
  return null;
}

function latestPublished(rows: readonly GasComponent[]): GasComponent | null {
  let best: GasComponent | null = null;
  for (const row of rows) {
    if (!best || row.published_at > best.published_at) {
      best = row;
    }
  }
  return best;
}

function isStalePublication(component: GasComponent, now: Date): boolean {
  const metric = GAS_METRIC_BY_PUBLICATION.get(component.publication_id);
  if (!metric) {
    return false;
  }
  return isBeyondCadence(component.published_at, now, metric.expected_cadence, "calendar", staleGrace(metric));
}

function hourlySeriesCoversDay(release: GasRelease, basis: GasPageBasis): boolean {
  const start = Date.parse(release.gas_day.start);
  const end = Date.parse(release.gas_day.end);
  const headline = supplySeriesId(basis);
  const groups = new Map<string, number[]>();
  for (const row of componentsFor(release, basis)) {
    if (row.value == null || !Number.isFinite(row.value)) {
      continue;
    }
    if (row.quantity_kind !== "rate" && row.quantity_kind !== "cumulative") {
      continue;
    }
    if (headline && row.publication_id !== headline) {
      continue;
    }
    const times = groups.get(row.publication_id) ?? [];
    times.push(Date.parse(row.applicable_at));
    groups.set(row.publication_id, times);
  }
  for (const [publicationId, times] of groups) {
    const step = cadenceMs(GAS_METRIC_BY_PUBLICATION.get(publicationId)?.expected_cadence ?? "");
    if (step != null && coversHalfOpenRange(times, start, end, step)) {
      return true;
    }
  }
  return false;
}

function coversHalfOpenRange(times: readonly number[], start: number, end: number, step: number): boolean {
  if (!(step > 0) || end <= start || (end - start) % step !== 0) {
    return false;
  }
  const slots = (end - start) / step;
  const present = new Set<number>();
  for (const time of times) {
    if (time < start || time >= end) {
      continue;
    }
    present.add(Math.floor((time - start) / step));
  }
  for (let slot = 0; slot < slots; slot += 1) {
    if (!present.has(slot)) {
      return false;
    }
  }
  return true;
}

function cadenceMs(cadence: string): number | null {
  const origin = new Date(Date.UTC(2026, 0, 1));
  const next = cadenceDeadline(origin, cadence);
  return next ? next.getTime() - origin.getTime() : null;
}

function unitFor(component: GasComponent | null): string {
  return component ? displayUnit(component.quantity_kind) : GAS_UNIT_DAY;
}

function displayUnit(kind: GasQuantityKind): string {
  switch (kind) {
    case "rate":
    case "forecast":
      return GAS_UNIT_DAY;
    case "cumulative":
    case "day total":
    case "stock":
      return GAS_UNIT_STOCK;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function stampFrom(rows: readonly GasComponent[]): GasSlice["stamp"] {
  const data = latestOf([...rows].filter((row) => row.quantity_kind !== "forecast"));
  const published = [...rows].sort((left, right) => right.published_at.localeCompare(left.published_at))[0];
  const retrieved = [...rows].sort((left, right) => right.retrieved_at.localeCompare(left.retrieved_at))[0];
  const dataTime = data?.applicable_at ?? published?.published_at ?? "";
  const publishedAt = published?.published_at ?? "";
  const retrievedAt = retrieved?.retrieved_at ?? "";
  return {
    dataTime,
    dataTimeLabel: dataTime ? formatLondonDateTimeStamp(parseUtcDateTime(dataTime)) : ABSENT_FIGURE,
    publishedAt,
    publishedLabel: publishedAt ? formatLondonDateTimeStamp(parseUtcDateTime(publishedAt)) : ABSENT_FIGURE,
    retrievedAt,
    retrievedLabel: retrievedAt ? formatLondonDateTimeStamp(parseUtcDateTime(retrievedAt)) : ABSENT_FIGURE,
  };
}

function coverageBounds(rows: readonly GasComponent[]): { start: string; latest: string } | null {
  const measured = rows.filter((row) => row.quantity_kind !== "forecast" && row.value != null);
  if (measured.length === 0) {
    return null;
  }
  const sorted = [...measured].sort((left, right) => left.applicable_at.localeCompare(right.applicable_at));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    return null;
  }
  return {
    start: formatLondonDateTimeStamp(parseUtcDateTime(first.applicable_at)),
    latest: formatLondonDateTimeStamp(parseUtcDateTime(last.applicable_at)),
  };
}

function gasDayLabel(release: GasRelease): string {
  return gasDayLabelText(
    formatLondonDayMonthYear(release.gas_day.label),
    clock(release.gas_day.start),
    clock(release.gas_day.end),
    zoneLabel(release.gas_day.start),
    zoneLabel(release.gas_day.end),
  );
}

function clock(iso: string): string {
  const parts = getLondonDateTimeParts(parseUtcDateTime(iso));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function zoneLabel(iso: string): string {
  const zone = getLondonOffsetLabel(parseUtcDateTime(iso));
  if (zone === "BST" || zone === "GMT") {
    return zone;
  }
  return "GMT";
}

function nowInsideDay(release: GasRelease, now: Date): string | null {
  const start = Date.parse(release.gas_day.start);
  const end = Date.parse(release.gas_day.end);
  if (now.getTime() < start || now.getTime() >= end) {
    return null;
  }
  return now.toISOString();
}

function componentState(component: GasComponent, day: GasDayState, now: Date): DataState | null {
  if (component.quantity_kind === "forecast") {
    return "forecast";
  }
  if (isStalePublication(component, now)) {
    return "stale";
  }
  if (day === "partial") {
    return "partial";
  }
  return null;
}

function isPageBasis(value: string): value is GasPageBasis {
  return (GAS_PAGE_BASES as readonly string[]).includes(value);
}

function publicationFooter(): string {
  return "National Gas";
}

function isThinSlice(slice: GasSlice): boolean {
  const demand = slice.stats.find((item) => item.id === "demand");
  let owned = demand && isOwnedStat(demand) ? 1 : 0;
  if (
    isOwnedText(slice.linepack.opening, slice.linepack.openingAsOf) ||
    isOwnedText(slice.linepack.current, slice.linepack.currentAsOf) ||
    isOwnedText(slice.linepack.predictedClose, slice.linepack.predictedCloseAsOf)
  ) {
    owned += 1;
  }
  if (
    isOwnedText(slice.storage.injection, slice.storage.injectionAsOf) ||
    isOwnedText(slice.storage.withdrawal, slice.storage.withdrawalAsOf)
  ) {
    owned += 1;
  }
  return owned < 2;
}

function isOwnedStat(stat: GasStat): boolean {
  return stat.valueLabel !== ABSENT_FIGURE && stat.asOfLabel == null && stat.state !== "not_yet_available";
}

function isOwnedText(value: string, asOf: string | null): boolean {
  return value !== ABSENT_FIGURE && asOf == null;
}

type DatedValue = { value: number; asOfLabel: string | null };

function resolveNumber(
  release: GasRelease,
  history: readonly GasRelease[],
  read: (item: GasRelease) => number | null,
): DatedValue | null {
  const own = read(release);
  if (own != null) {
    return { value: own, asOfLabel: null };
  }
  const other = borrowedRelease(release, history, (item) => read(item) != null);
  if (!other) {
    return null;
  }
  const value = read(other);
  return value == null ? null : { value, asOfLabel: formatLondonDayMonthYear(other.gas_day.label) };
}

function borrowedRelease(
  release: GasRelease,
  history: readonly GasRelease[],
  has: (item: GasRelease) => boolean,
): GasRelease | null {
  for (const other of newestFirst(history)) {
    if (other.gas_day.label === release.gas_day.label) {
      continue;
    }
    if (has(other)) {
      return other;
    }
  }
  return null;
}

function newestFirst(history: readonly GasRelease[]): GasRelease[] {
  return [...history].sort((left, right) => right.gas_day.label.localeCompare(left.gas_day.label));
}

function openingLinepack(release: GasRelease): number | null {
  return firstFinite(release, [LINEPACK_OPEN, LINEPACK_INTERIM])?.value ?? null;
}

function currentLinepack(release: GasRelease): number | null {
  const sample = latestInstantaneous(release, "linepack", NTS_ACTUAL_LINEPACK);
  if (sample) {
    return sample.value;
  }
  const opening = firstFinite(release, [LINEPACK_OPEN, LINEPACK_INTERIM]);
  const interim = finiteValue(release, LINEPACK_INTERIM);
  if (interim && opening && interim.applicable_at > opening.applicable_at) {
    return interim.value;
  }
  return null;
}

function predictedLinepack(release: GasRelease): number | null {
  return firstFinite(release, [LINEPACK_PCLP1, LINEPACK_PCLP2])?.value ?? null;
}

function closeLinepack(release: GasRelease): number | null {
  return finiteValue(release, LINEPACK_CLOSE)?.value ?? null;
}

type StoragePair = {
  injection: number;
  withdrawal: number;
  unit: string;
  asOfLabel: string | null;
  flow: boolean;
};

function storagePair(release: GasRelease, history: readonly GasRelease[], basis: GasPageBasis): StoragePair | null {
  if (basis !== "completed") {
    const flow = flowStorage(release);
    if (flow) {
      return { ...flow, unit: GAS_UNIT_DAY, asOfLabel: null, flow: true };
    }
  }
  const own = completedStorage(release);
  if (own) {
    return { ...own, unit: GAS_UNIT_STOCK, asOfLabel: null, flow: false };
  }
  for (const other of newestFirst(history)) {
    if (other.gas_day.label === release.gas_day.label) {
      continue;
    }
    const completed = completedStorage(other);
    if (completed) {
      return {
        ...completed,
        unit: GAS_UNIT_STOCK,
        asOfLabel: formatLondonDayMonthYear(other.gas_day.label),
        flow: false,
      };
    }
  }
  return null;
}

function flowStorage(release: GasRelease): { injection: number; withdrawal: number } | null {
  const injection = latestInstantaneous(release, "demand_part", STORAGE_DEMAND_FLOW);
  const withdrawal = withdrawalSum(release);
  if (!injection || withdrawal == null) {
    return null;
  }
  return { injection: injection.value, withdrawal };
}

function completedStorage(release: GasRelease): { injection: number; withdrawal: number } | null {
  const injection = latestAny(release, STORAGE_INJECTION);
  const withdrawal = latestAny(release, STORAGE_WITHDRAWAL);
  if (injection?.value == null || withdrawal?.value == null) {
    return null;
  }
  return { injection: injection.value, withdrawal: withdrawal.value };
}

function withdrawalSum(release: GasRelease): number | null {
  const latest = new Map<string, GasInstantaneousSample>();
  for (const sample of release.instantaneous) {
    if (sample.role !== "storage_withdrawal") {
      continue;
    }
    const previous = latest.get(sample.name);
    if (!previous || prefersSample(sample, previous)) {
      latest.set(sample.name, sample);
    }
  }
  let sum = 0;
  for (const name of STORAGE_WITHDRAWAL_SITES) {
    const sample = latest.get(name);
    if (!sample) {
      return null;
    }
    sum += sample.value;
  }
  return sum;
}

function latestInstantaneous(
  release: GasRelease,
  role: GasInstantaneousSample["role"],
  name?: string,
): GasInstantaneousSample | null {
  let best: GasInstantaneousSample | null = null;
  for (const sample of release.instantaneous) {
    if (sample.role !== role || (name != null && sample.name !== name)) {
      continue;
    }
    if (!best || prefersSample(sample, best)) {
      best = sample;
    }
  }
  return best;
}

function prefersSample(candidate: GasInstantaneousSample, current: GasInstantaneousSample): boolean {
  return (
    candidate.applicable_at > current.applicable_at ||
    (candidate.applicable_at === current.applicable_at && candidate.published_at > current.published_at)
  );
}

const FLOW_FRESHNESS = GAS_METRICS["gas.gb_nts.entry.physical.national"];

function flowFreshness(
  release: GasRelease,
  basis: GasPageBasis,
  stamp: GasSlice["stamp"],
  csvStale: boolean,
  now: Date,
): { stamp: GasSlice["stamp"]; stale: boolean } {
  if (basis !== "flow") {
    return { stamp, stale: csvStale };
  }
  const oldest = oldestDisplayedFlowSample(release);
  if (!oldest || !isInstantaneousStale(oldest.published_at, now)) {
    return { stamp, stale: csvStale };
  }
  return {
    stale: true,
    stamp: {
      ...stamp,
      dataTime: oldest.applicable_at,
      dataTimeLabel: formatLondonDateTimeStamp(parseUtcDateTime(oldest.applicable_at)),
      publishedAt: oldest.published_at,
      publishedLabel: formatLondonDateTimeStamp(parseUtcDateTime(oldest.published_at)),
    },
  };
}

function oldestDisplayedFlowSample(release: GasRelease): GasInstantaneousSample | null {
  const samples: GasInstantaneousSample[] = [];
  const demand = latestInstantaneous(release, "demand");
  if (demand) {
    samples.push(demand);
  }
  const linepack = latestInstantaneous(release, "linepack", NTS_ACTUAL_LINEPACK);
  if (linepack) {
    samples.push(linepack);
  }
  if (flowStorage(release)) {
    const injection = latestInstantaneous(release, "demand_part", STORAGE_DEMAND_FLOW);
    if (injection) {
      samples.push(injection);
    }
    for (const name of STORAGE_WITHDRAWAL_SITES) {
      const site = latestInstantaneous(release, "storage_withdrawal", name);
      if (site) {
        samples.push(site);
      }
    }
  }
  let oldest: GasInstantaneousSample | null = null;
  for (const sample of samples) {
    if (!oldest || sample.published_at < oldest.published_at) {
      oldest = sample;
    }
  }
  return oldest;
}

function isInstantaneousStale(publishedAt: string, now: Date): boolean {
  return isBeyondCadence(publishedAt, now, FLOW_FRESHNESS.expected_cadence, "calendar", staleGrace(FLOW_FRESHNESS));
}

function formatQuantity(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return ABSENT_FIGURE;
  }
  return formatDisplay(value, 0.1);
}
