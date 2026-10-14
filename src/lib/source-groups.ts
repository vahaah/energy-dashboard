import {
  fuelColor,
  INTERCONNECTOR_COUNTRIES,
  INTERCONNECTOR_LABELS,
} from "@/lib/colors";
import {
  isBatteryFuel,
  isInterconnectorFuel,
  isPumpedStorageFuel,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { displayedPercents } from "@/lib/display-rounding";
import { formatHeadlineGw } from "@/lib/facts";
import { BATTERY_CHARGING_SENTENCE, buildSettlementBalance } from "@/lib/headline-balance";
import { formatSharePercent } from "@/lib/generation-share";
import { parseUtcDateTime } from "@/lib/london-time";
import type { Generation5min } from "@/lib/types";

export const SOURCE_GROUP_ORDER = [
  "fossil",
  "renewables",
  "other",
  "interconnectors",
  "storage",
] as const;

export type SourceGroupId = (typeof SOURCE_GROUP_ORDER)[number];

export type SourceRowView = {
  id: string;
  label: string;
  mw: number | null;
  gwLabel: string;
  sharePct: number | null;
  shareLabel: string;
  sparkline: number[];
  color: string;
  help: string;
  missingNote: string | null;
};

export type SourceGroupView = {
  id: SourceGroupId;
  label: string;
  color: string;
  help: string;
  mw: number | null;
  gwLabel: string;
  sharePct: number | null;
  shareLabel: string;
  rows: SourceRowView[];
};

export type GroupedSourceTable = {
  groups: SourceGroupView[];
  mix: Array<{ id: string; label: string; mw: number; pct: number; color: string; hatched: boolean }>;
};

const GROUP_LABELS: Record<SourceGroupId, string> = {
  fossil: "Fossil fuels",
  renewables: "Wind, solar and hydro",
  other: "Other sources",
  interconnectors: "Interconnectors",
  storage: "Storage",
};

const GROUP_COLORS: Record<SourceGroupId, string> = {
  fossil: fuelColor("gas"),
  renewables: fuelColor("wind"),
  other: fuelColor("nuclear"),
  interconnectors: fuelColor("imports"),
  storage: fuelColor("pumped_storage"),
};

export const GROUP_HELP: Record<SourceGroupId, string> = {
  fossil: "Gas, oil and coal-fired power stations. Gas is CCGT plus OCGT. Source: Elexon FUELINST.",
  renewables: "Wind, solar and conventional hydro. Pumped storage sits under Storage, not here. Source: Elexon FUELINST, NESO and Sheffield Solar PV Live.",
  other: "Nuclear, biomass and other generation that does not fit the named fuels. Source: Elexon FUELINST.",
  interconnectors: "High-voltage links to neighbouring grids. Positive is an import into Great Britain. Source: Elexon FUELINST.",
  storage: "Pumped hydro and batteries when they are generating. Charging is the storage term in the balance, not a share of generation. Source: Elexon FUELINST.",
};

const HELP: Record<string, string> = {
  gas: "Gas-fired power stations (CCGT and OCGT). Source: Elexon FUELINST.",
  coal: "Coal-fired generation. Britain’s last coal plant closed in 2024, so this is usually zero. Source: Elexon FUELINST.",
  oil: "Oil-fired generation, used rarely. Source: Elexon FUELINST.",
  wind: "Transmission-connected wind plus estimated embedded wind. Source: Elexon FUELINST and NESO.",
  solar: "GB solar, including estimated rooftop and other embedded panels. Source: Sheffield Solar PV Live.",
  hydro: "Conventional hydro, not pumped storage. Source: Elexon FUELINST.",
  nuclear: "Nuclear power stations. Source: Elexon FUELINST.",
  biomass: "Biomass generation. Source: Elexon FUELINST.",
  other: "Other generation that does not fit the named fuels. Source: Elexon FUELINST.",
  pumped_storage: "Pumped hydro when it is generating. Pumping is the storage-charging term in the balance. Source: Elexon FUELINST.",
  battery: `Battery discharge when Elexon publishes it. ${BATTERY_CHARGING_SENTENCE} Source: Elexon FUELINST.`,
};

export const MIX_BAR_HELP =
  "Each segment is that fuel’s share of GB generation. Imports and exports stay in the balance equation, so the bar adds up to 100%.";

const COUNTRY_HELP = "Metered flow on the interconnectors to this country. Positive is an import into Great Britain. Source: Elexon FUELINST.";

const SPARKLINE_BUCKET_MS = 30 * 60 * 1000;

type Accumulator = { mw: number; fuels: string[] };

export function buildGroupedSourceTable(
  generationRows: Generation5min[],
  _demandMw: number | null,
  sparklineRows: Generation5min[] = generationRows,
  periodStartUtc: string | null = null
): GroupedSourceTable {
  const split = splitLatestGenerationRows(periodRows(generationRows, periodStartUtc));
  const latest = latestByFuel(split.sources, split.interconnectors);
  const buckets = new Map<string, Accumulator>();

  addFuel(buckets, "gas", latest, ["ccgt", "ocgt", "gas"]);
  addFuel(buckets, "coal", latest, ["coal"]);
  addFuel(buckets, "oil", latest, ["oil"]);
  addFuel(buckets, "wind", latest, ["wind", "embedded_wind"]);
  addFuel(buckets, "solar", latest, ["solar", "embedded_solar"]);
  addFuel(buckets, "hydro", latest, ["hydro", "npshyd"]);
  addFuel(buckets, "nuclear", latest, ["nuclear"]);
  addFuel(buckets, "biomass", latest, ["biomass"]);
  addFuel(buckets, "other", latest, ["other"]);
  addFuel(buckets, "pumped_storage", latest, ["ps"]);
  addFuel(buckets, "battery", latest, ["bess", "battery"]);

  const countryMw = new Map<string, number>();
  for (const [fuel, row] of latest) {
    if (!isInterconnectorFuel(fuel)) {
      continue;
    }
    const country = INTERCONNECTOR_COUNTRIES[fuel] ?? INTERCONNECTOR_LABELS[fuel] ?? fuel;
    countryMw.set(country, (countryMw.get(country) ?? 0) + row.generation_mw);
  }

  const generationMw = domesticGenerationMw(buckets);
  const groups = SOURCE_GROUP_ORDER.map((id) => {
    const rows = rowsForGroup(id, buckets, countryMw, generationMw, sparklineRows);
    const present = rows.filter((row) => row.mw != null);
    const mw = present.length === 0 ? null : present.reduce((sum, row) => sum + (row.mw ?? 0), 0);
    const interconnector = id === "interconnectors";
    return {
      id,
      label: GROUP_LABELS[id],
      color: GROUP_COLORS[id],
      help: GROUP_HELP[id],
      mw,
      gwLabel: mw == null ? "—" : formatHeadlineGw(interconnector ? Math.abs(mw) : mw),
      sharePct: mw == null || interconnector ? null : sharePct(mw, generationMw),
      shareLabel: mw == null ? "—" : interconnector ? directionWord(mw) : shareLabel(mw, generationMw),
      rows,
    };
  });

  const mix =
    generationMw <= 0
      ? []
      : groups
          .flatMap((group) => group.rows)
          .filter((row) => row.mw != null && row.mw > 0 && !row.id.startsWith("int-"))
          .map((row) => {
            const mw = row.mw ?? 0;
            return {
              id: row.id,
              label: row.label,
              mw,
              pct: sharePct(mw, generationMw),
              color: row.color,
              hatched: false,
            };
          });

  return { groups: generationMw > 0 ? applyDisplayedShareLabels(groups) : groups, mix };
}

function applyDisplayedShareLabels(groups: SourceGroupView[]): SourceGroupView[] {
  const eligible = groups
    .filter((group) => group.id !== "interconnectors")
    .flatMap((group) => group.rows)
    .filter((row) => row.mw != null && row.sharePct != null);
  const percents = displayedPercents(eligible.map((row) => row.sharePct ?? 0));
  const labelById = new Map(eligible.map((row, index) => [row.id, `${percents[index] ?? 0}%`]));

  return groups.map((group) => {
    const rows = group.rows.map((row) => {
      const shareLabel = labelById.get(row.id);
      return shareLabel ? { ...row, shareLabel } : row;
    });
    if (group.id === "interconnectors" || group.mw == null) {
      return { ...group, rows };
    }
    const shown = rows.filter((row) => row.mw != null && row.shareLabel.endsWith("%"));
    if (shown.length === 0) {
      return { ...group, rows };
    }
    const sum = shown.reduce((total, row) => total + Number.parseInt(row.shareLabel, 10), 0);
    return { ...group, rows, shareLabel: `${sum}%` };
  });
}

function rowsForGroup(
  group: SourceGroupId,
  buckets: Map<string, Accumulator>,
  countryMw: Map<string, number>,
  generationMw: number,
  sparklineRows: Generation5min[]
): SourceRowView[] {
  switch (group) {
    case "fossil":
      return ["gas", "coal", "oil"].map((id) => sourceRow(id, buckets.get(id), generationMw, sparklineRows));
    case "renewables":
      return ["solar", "wind", "hydro"].map((id) => sourceRow(id, buckets.get(id), generationMw, sparklineRows));
    case "other":
      return ["nuclear", "biomass", "other"].map((id) =>
        sourceRow(id, buckets.get(id), generationMw, sparklineRows)
      );
    case "interconnectors":
      return Array.from(countryMw.entries())
        .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
        .map(([country, mw]) =>
          rowView({
            id: `int-${country.toLowerCase().replaceAll(" ", "-")}`,
            label: country,
            mw,
            color: fuelColor("imports"),
            help: COUNTRY_HELP,
            sparkline: sparklineForCountries(sparklineRows, country),
            generationMw,
            missingNote: null,
            interconnector: true,
          })
        );
    case "storage":
      return [
        sourceRow("pumped_storage", buckets.get("pumped_storage"), generationMw, sparklineRows),
        batteryRow(buckets.get("battery"), generationMw, sparklineRows),
      ];
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
}

function sourceRow(
  id: string,
  bucket: Accumulator | undefined,
  generationMw: number,
  sparklineRows: Generation5min[]
): SourceRowView {
  return rowView({
    id,
    label: labelFor(id),
    mw: bucket ? bucket.mw : null,
    color: fuelColor(id),
    help: HELP[id] ?? "",
    sparkline: sparklineForFuels(sparklineRows, bucket?.fuels ?? fuelsFor(id)),
    generationMw,
    missingNote: bucket ? null : "no data",
    interconnector: false,
  });
}

function batteryRow(
  bucket: Accumulator | undefined,
  generationMw: number,
  sparklineRows: Generation5min[]
): SourceRowView {
  const discharging = bucket != null && bucket.mw > 0;
  return rowView({
    id: "battery",
    label: "Battery",
    mw: discharging ? bucket.mw : null,
    color: fuelColor("battery"),
    help: HELP.battery ?? "",
    sparkline: discharging ? sparklineForFuels(sparklineRows, bucket.fuels) : [],
    generationMw,
    missingNote: "discharge only; charging is a balance term",
    interconnector: false,
  });
}

function rowView(input: {
  id: string;
  label: string;
  mw: number | null;
  color: string;
  help: string;
  sparkline: number[];
  generationMw: number;
  missingNote: string | null;
  interconnector: boolean;
}): SourceRowView {
  const interconnector = input.interconnector;
  return {
    id: input.id,
    label: input.label,
    mw: input.mw,
    gwLabel:
      input.mw == null ? "—" : formatHeadlineGw(interconnector ? Math.abs(input.mw) : input.mw),
    sharePct: input.mw == null || interconnector ? null : sharePct(input.mw, input.generationMw),
    shareLabel:
      input.mw == null
        ? "—"
        : interconnector
          ? directionWord(input.mw)
          : shareLabel(input.mw, input.generationMw),
    sparkline: input.sparkline,
    color: input.color,
    help: input.help,
    missingNote: input.missingNote,
  };
}

function periodRows(rows: Generation5min[], periodStartUtc: string | null): Generation5min[] {
  if (!periodStartUtc) {
    return rows;
  }
  const balance = buildSettlementBalance(rows, periodStartUtc);
  if (balance.fuels.length === 0) {
    return rows;
  }
  const timestamp = periodStartUtc.includes("T") ? periodStartUtc.replace("T", " ").slice(0, 19) : periodStartUtc;
  return balance.fuels.map((fuel) => ({
    timestamp,
    fuel_type: fuel.fuel,
    generation_mw: isInterconnectorFuel(fuel.fuel)
      ? fuel.positiveMw - fuel.negativeMw
      : isPumpedStorageFuel(fuel.fuel) || isBatteryFuel(fuel.fuel)
        ? fuel.positiveMw
        : fuel.mw,
    source: fuel.source,
  }));
}

function domesticGenerationMw(buckets: Map<string, Accumulator>): number {
  let total = 0;
  for (const bucket of buckets.values()) {
    if (bucket.mw > 0) {
      total += bucket.mw;
    }
  }
  return total;
}

function directionWord(mw: number): string {
  if (mw > 25) {
    return "net import";
  }
  if (mw < -25) {
    return "net export";
  }
  return "balanced";
}

function latestByFuel(
  sources: Generation5min[],
  interconnectors: Generation5min[]
): Map<string, Generation5min> {
  const latest = new Map<string, Generation5min>();
  for (const row of [...sources, ...interconnectors]) {
    latest.set(normalizeFuelType(row.fuel_type), row);
  }
  return latest;
}

function addFuel(
  buckets: Map<string, Accumulator>,
  id: string,
  latest: Map<string, Generation5min>,
  fuels: string[]
): void {
  let mw = 0;
  const present: string[] = [];
  for (const fuel of fuels) {
    const row = latest.get(fuel);
    if (!row) {
      continue;
    }
    if (isPumpedStorageFuel(fuel) && row.generation_mw < 0) {
      continue;
    }
    if (isBatteryFuel(fuel) && row.generation_mw <= 0) {
      continue;
    }
    mw += row.generation_mw;
    present.push(fuel);
  }
  if (present.length === 0) {
    return;
  }
  buckets.set(id, { mw, fuels: present });
}

function fuelsFor(id: string): string[] {
  switch (id) {
    case "gas":
      return ["ccgt", "ocgt", "gas"];
    case "wind":
      return ["wind", "embedded_wind"];
    case "solar":
      return ["solar", "embedded_solar"];
    case "hydro":
      return ["hydro", "npshyd"];
    case "pumped_storage":
      return ["ps"];
    case "battery":
      return ["bess", "battery"];
    default:
      return [id];
  }
}

function labelFor(id: string): string {
  switch (id) {
    case "gas":
      return "Gas";
    case "coal":
      return "Coal";
    case "oil":
      return "Oil";
    case "wind":
      return "Wind";
    case "solar":
      return "Solar";
    case "hydro":
      return "Hydro";
    case "nuclear":
      return "Nuclear";
    case "biomass":
      return "Biomass";
    case "other":
      return "Other";
    case "pumped_storage":
      return "Pumped storage";
    case "battery":
      return "Battery";
    default:
      return id;
  }
}

export function sparklineForFuels(rows: Generation5min[], fuels: string[]): number[] {
  const wanted = new Set(fuels.map((fuel) => normalizeFuelType(fuel)));
  return sparklineSeries(rows, (row) => wanted.has(normalizeFuelType(row.fuel_type)));
}

export function sparklineForCountries(rows: Generation5min[], country: string): number[] {
  return sparklineSeries(rows, (row) => {
    const fuel = normalizeFuelType(row.fuel_type);
    return isInterconnectorFuel(fuel) && INTERCONNECTOR_COUNTRIES[fuel] === country;
  });
}

function sparklineSeries(
  rows: Generation5min[],
  include: (row: Generation5min) => boolean
): number[] {
  const buckets = new Map<number, Map<string, { sum: number; count: number }>>();
  for (const row of rows) {
    if (!include(row)) {
      continue;
    }
    if (isPumpedStorageFuel(row.fuel_type) && row.generation_mw < 0) {
      continue;
    }
    if (isBatteryFuel(row.fuel_type) && row.generation_mw <= 0) {
      continue;
    }
    const bucket = Math.floor(parseUtcDateTime(row.timestamp).getTime() / SPARKLINE_BUCKET_MS) * SPARKLINE_BUCKET_MS;
    const fuels = buckets.get(bucket) ?? new Map<string, { sum: number; count: number }>();
    const fuel = normalizeFuelType(row.fuel_type);
    const reading = fuels.get(fuel) ?? { sum: 0, count: 0 };
    reading.sum += row.generation_mw;
    reading.count += 1;
    fuels.set(fuel, reading);
    buckets.set(bucket, fuels);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([, fuels]) =>
      Array.from(fuels.values()).reduce((sum, reading) => sum + reading.sum / reading.count, 0)
    );
}

function sharePct(mw: number, generationMw: number): number {
  if (generationMw <= 0) {
    return 0;
  }
  return (mw / generationMw) * 100;
}

function shareLabel(mw: number, generationMw: number): string {
  if (generationMw <= 0) {
    return "—";
  }
  return `${formatSharePercent((mw / generationMw) * 100)}%`;
}
