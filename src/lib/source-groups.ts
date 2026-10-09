import {
  fuelColor,
  INTERCONNECTOR_COUNTRIES,
  INTERCONNECTOR_LABELS,
} from "@/lib/colors";
import {
  isInterconnectorFuel,
  isPumpedStorageFuel,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { formatHeadlineGw } from "@/lib/facts";
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
  renewables: "Renewables",
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
  pumped_storage: "Pumped hydro when it is generating. Charging is not counted as demand here. Source: Elexon FUELINST.",
  battery: "Battery discharge is not published as a national series yet.",
};

const COUNTRY_HELP = "Metered flow on the interconnectors to this country. Positive is an import into Great Britain. Source: Elexon FUELINST.";

const SPARKLINE_BUCKET_MS = 30 * 60 * 1000;

type Accumulator = { mw: number; fuels: string[] };

export function buildGroupedSourceTable(
  generationRows: Generation5min[],
  demandMw: number | null,
  sparklineRows: Generation5min[] = generationRows
): GroupedSourceTable {
  const split = splitLatestGenerationRows(generationRows);
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

  const countryMw = new Map<string, number>();
  for (const [fuel, row] of latest) {
    if (!isInterconnectorFuel(fuel)) {
      continue;
    }
    const country = INTERCONNECTOR_COUNTRIES[fuel] ?? INTERCONNECTOR_LABELS[fuel] ?? fuel;
    countryMw.set(country, (countryMw.get(country) ?? 0) + row.generation_mw);
  }

  const groups = SOURCE_GROUP_ORDER.map((id) => {
    const rows = rowsForGroup(id, buckets, countryMw, demandMw, sparklineRows);
    const present = rows.filter((row) => row.mw != null);
    const mw = present.length === 0 ? null : present.reduce((sum, row) => sum + (row.mw ?? 0), 0);
    return {
      id,
      label: GROUP_LABELS[id],
      color: GROUP_COLORS[id],
      mw,
      gwLabel: formatHeadlineGw(mw),
      sharePct: mw == null ? null : sharePct(mw, demandMw),
      shareLabel: mw == null ? "—" : shareLabel(mw, demandMw),
      rows,
    };
  });

  const mix =
    demandMw == null || demandMw <= 0
      ? []
      : groups
          .flatMap((group) => group.rows)
          .filter((row) => row.mw != null && row.mw > 0)
          .map((row) => {
            const mw = row.mw ?? 0;
            return {
              id: row.id,
              label: row.label,
              mw,
              pct: sharePct(mw, demandMw),
              color: row.color,
              hatched: groupOf(row.id) === "interconnectors",
            };
          });

  return { groups, mix };
}

function rowsForGroup(
  group: SourceGroupId,
  buckets: Map<string, Accumulator>,
  countryMw: Map<string, number>,
  demandMw: number | null,
  sparklineRows: Generation5min[]
): SourceRowView[] {
  switch (group) {
    case "fossil":
      return ["gas", "coal", "oil"].map((id) => sourceRow(id, buckets.get(id), demandMw, sparklineRows));
    case "renewables":
      return ["solar", "wind", "hydro"].map((id) => sourceRow(id, buckets.get(id), demandMw, sparklineRows));
    case "other":
      return ["nuclear", "biomass", "other"].map((id) =>
        sourceRow(id, buckets.get(id), demandMw, sparklineRows)
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
            demandMw,
            missingNote: null,
          })
        );
    case "storage":
      return [
        sourceRow("pumped_storage", buckets.get("pumped_storage"), demandMw, sparklineRows),
        rowView({
          id: "battery",
          label: "Battery",
          mw: null,
          color: fuelColor("battery"),
          help: HELP.battery ?? "",
          sparkline: [],
          demandMw,
          missingNote: "not published",
        }),
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
  demandMw: number | null,
  sparklineRows: Generation5min[]
): SourceRowView {
  return rowView({
    id,
    label: labelFor(id),
    mw: bucket ? bucket.mw : null,
    color: fuelColor(id),
    help: HELP[id] ?? "",
    sparkline: sparklineForFuels(sparklineRows, bucket?.fuels ?? fuelsFor(id)),
    demandMw,
    missingNote: bucket ? null : "no data",
  });
}

function rowView(input: {
  id: string;
  label: string;
  mw: number | null;
  color: string;
  help: string;
  sparkline: number[];
  demandMw: number | null;
  missingNote: string | null;
}): SourceRowView {
  return {
    id: input.id,
    label: input.label,
    mw: input.mw,
    gwLabel: formatHeadlineGw(input.mw),
    sharePct: input.mw == null ? null : sharePct(input.mw, input.demandMw),
    shareLabel: input.mw == null ? "—" : shareLabel(input.mw, input.demandMw),
    sparkline: input.sparkline,
    color: input.color,
    help: input.help,
    missingNote: input.missingNote,
  };
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

function groupOf(id: string): SourceGroupId {
  if (id.startsWith("int-")) {
    return "interconnectors";
  }
  switch (id) {
    case "gas":
    case "coal":
    case "oil":
      return "fossil";
    case "solar":
    case "wind":
    case "hydro":
      return "renewables";
    case "pumped_storage":
    case "battery":
      return "storage";
    case "nuclear":
    case "biomass":
    case "other":
      return "other";
    default:
      return "other";
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

function sharePct(mw: number, demandMw: number | null): number {
  if (demandMw == null || demandMw <= 0) {
    return 0;
  }
  return (mw / demandMw) * 100;
}

function shareLabel(mw: number, demandMw: number | null): string {
  if (demandMw == null || demandMw <= 0) {
    return "—";
  }
  return `${((mw / demandMw) * 100).toFixed(1)}%`;
}
