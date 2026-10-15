import { ABSENT_FIGURE, isBeyondCadence, type DataState } from "@/lib/data-state";
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
import type { GasComponent, GasRelease } from "@/lib/ingest/national-gas/release";
import {
  formatLondonClock,
  formatLondonDateTimeStamp,
  formatLondonDayMonthYear,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
  utcIsoFromTimestamp,
} from "@/lib/london-time";
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

const ENTRY_PARTS = [SUPPLY_NORTH, SUPPLY_SOUTH] as const;

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
  return {
    available: true,
    days: ordered.map((release) => ({
      label: release.gas_day.label,
      text: formatLondonDayMonthYear(release.gas_day.label),
    })),
    defaultDay: first.day,
    defaultBasis: first.basis,
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
  const stamp = stampFrom(stampSource);
  const stale = stamp.publishedAt ? isBeyondCadence(stamp.publishedAt, now, "PT1H") : false;
  const coverage = coverageBounds(rows);
  const dayLabel = gasDayLabel(release);
  const partialText =
    state === "partial" && coverage
      ? gasPartialText(coverage.start, coverage.latest)
      : null;

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
      demandStat(release, now),
      linepackStat(release, now),
      storageStat(release, now),
    ],
    series: seriesFor(release, basis, now),
    now: nowInsideDay(release, now),
    entry: entryShares(release, basis),
    demand: demandShares(release, basis),
    linepack: linepackFigures(release),
    storage: storageFigures(release),
    bridge: bridgeFor(release, generation),
    comparison: comparisonFor(release, basis, history, now),
    footer: `${dayLabel}. ${publicationFooter(rows)}. ${GAS_ATTRIBUTION}`,
  };
}

export function basisState(release: GasRelease, basis: GasPageBasis, now: Date): GasDayState {
  const end = Date.parse(release.gas_day.end);
  const rows = componentsFor(release, basis).filter((row) => row.quantity_kind !== "forecast");
  switch (basis) {
    case "completed": {
      const totals = rows.filter((row) => row.quantity_kind === "day total" && row.value != null);
      if (totals.length > 0 && now.getTime() >= end) {
        return "complete";
      }
      return "partial";
    }
    case "flow":
    case "to-date": {
      const measured = rows.filter(
        (row) => (row.quantity_kind === "rate" || row.quantity_kind === "cumulative") && row.value != null,
      );
      const latest = latestInstant(measured);
      if (latest != null && latest >= end - 60_000 && now.getTime() >= end) {
        return "complete";
      }
      return "partial";
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
    basisState(release, "completed", now) === "complete" && completed
      ? completed
      : (flow ?? completed);
  return stat("supply", "Supply (NTS entry)", chosen, GAS_UNIT_DAY, release, now);
}

function demandStat(release: GasRelease, now: Date): GasStat {
  const completed = latestValue(release, DEMAND_VOLUME, "completed");
  return stat("demand", "Demand (NTS exit)", completed, GAS_UNIT_DAY, release, now);
}

function linepackStat(release: GasRelease, now: Date): GasStat {
  const opening = latestAny(release, LINEPACK_OPEN) ?? latestAny(release, LINEPACK_INTERIM);
  return stat("linepack", "Linepack", opening, GAS_UNIT_STOCK, release, now);
}

function storageStat(release: GasRelease, now: Date): GasStat {
  const injection = latestValue(release, STORAGE_INJECTION, "completed");
  const withdrawal = latestValue(release, STORAGE_WITHDRAWAL, "completed");
  const net =
    injection?.value != null && withdrawal?.value != null
      ? { ...withdrawal, value: withdrawal.value - injection.value, basis: "completed" as const }
      : null;
  return stat("storage", "Storage net flow", net, GAS_UNIT_DAY, release, now);
}

function stat(
  id: GasStat["id"],
  title: string,
  component: GasComponent | null,
  unit: string,
  release: GasRelease,
  now: Date,
): GasStat {
  if (!component || component.value == null) {
    return {
      id,
      title,
      valueLabel: ABSENT_FIGURE,
      unit,
      basisLabel: GAS_BASIS_LABEL[component?.basis ?? "completed"],
      state: "not_yet_available",
    };
  }
  const basis = isPageBasis(component.basis) ? component.basis : "completed";
  const state = componentState(component, basisState(release, basis, now), now);
  return {
    id,
    title,
    valueLabel: formatQuantity(component.value),
    unit,
    basisLabel: GAS_BASIS_LABEL[basis],
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
  return shareRows(parts);
}

function demandShares(release: GasRelease, basis: GasPageBasis): GasShareRow[] {
  if (basis !== "completed") {
    return [];
  }
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
  return shareRows(parts);
}

function shareRows(
  parts: readonly { id: string; label: string; value: number; note: string | null }[],
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
    unit: GAS_UNIT_DAY,
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

function linepackFigures(release: GasRelease): GasLinepack {
  const opening = latestAny(release, LINEPACK_OPEN) ?? latestAny(release, LINEPACK_INTERIM);
  const interim = latestAny(release, LINEPACK_INTERIM);
  const current =
    interim && opening && interim.applicable_at > opening.applicable_at ? interim : null;
  const predicted = latestAny(release, LINEPACK_PCLP1) ?? latestAny(release, LINEPACK_PCLP2);
  const close = latestAny(release, LINEPACK_CLOSE);
  return {
    description: GAS_LINEPACK_DESCRIPTION,
    opening: formatQuantity(opening?.value ?? null),
    current: formatQuantity(current?.value ?? null),
    predictedClose: formatQuantity(predicted?.value ?? null),
    close: close?.value != null ? formatQuantity(close.value) : null,
    unit: GAS_UNIT_STOCK,
  };
}

function storageFigures(release: GasRelease): GasStorage {
  return {
    injection: formatQuantity(latestAny(release, STORAGE_INJECTION)?.value ?? null),
    withdrawal: formatQuantity(latestAny(release, STORAGE_WITHDRAWAL)?.value ?? null),
    unit: GAS_UNIT_DAY,
    notice: GAS_STORAGE_NOTICE,
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
  if (inside.length === 0) {
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
      unit: GAS_UNIT_DAY,
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
  const id = kind === "supply" ? supplySeriesId(basis) : basis === "completed" ? DEMAND_VOLUME : null;
  if (!id) {
    return null;
  }
  return latestValue(release, id, basis)?.value ?? null;
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
    if (!best || row.applicable_at > best.applicable_at) {
      best = row;
    }
  }
  return best;
}

function latestInstant(rows: readonly GasComponent[]): number | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const at = Date.parse(row.applicable_at);
    if (at > latest) {
      latest = at;
    }
  }
  return Number.isFinite(latest) ? latest : null;
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
  const zone = zoneLabel(release.gas_day.start);
  return gasDayLabelText(
    formatLondonDayMonthYear(release.gas_day.label),
    clock(release.gas_day.start),
    clock(release.gas_day.end),
    zone,
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
  if (isBeyondCadence(component.published_at, now, "PT1H")) {
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

function publicationFooter(rows: readonly GasComponent[]): string {
  const ids = [...new Set(rows.map((row) => row.publication_id))].sort();
  if (ids.length === 0) {
    return "National Gas";
  }
  return `National Gas ${ids.join(", ")}`;
}

function formatQuantity(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return ABSENT_FIGURE;
  }
  return formatDisplay(value, 0.1);
}
