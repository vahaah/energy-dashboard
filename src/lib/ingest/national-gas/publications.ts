import type { GasBasis, GasQuantityKind } from "@/lib/ingest/national-gas/quantity";

export type GasDaySource = "applicable_at" | "applicable_for";

export type GasPublication = {
  publication_id: string;
  metric_id: string;
  quantity_kind: GasQuantityKind;
  basis: GasBasis;
  gas_day_from: GasDaySource;
  /** False for rates, forecasts, stocks, and the deferred demand series. */
  counts: boolean;
  verified: boolean;
  /** Portal sign is the opposite of the metric. PUBOB4424 withdrawals are published negative. */
  negate_portal_value: boolean;
};

export type GasFamily = {
  parent: string;
  children: readonly string[];
};

const FLOW = {
  quantity_kind: "rate",
  basis: "flow",
  gas_day_from: "applicable_at",
  counts: false,
  verified: true,
  negate_portal_value: false,
} as const satisfies Omit<GasPublication, "publication_id" | "metric_id">;

const FORECAST = {
  quantity_kind: "forecast",
  basis: "flow",
  gas_day_from: "applicable_for",
  counts: false,
  verified: true,
  negate_portal_value: false,
} as const satisfies Omit<GasPublication, "publication_id" | "metric_id">;

const DAY = {
  quantity_kind: "day total",
  basis: "completed",
  gas_day_from: "applicable_for",
  counts: true,
  verified: true,
  negate_portal_value: false,
} as const satisfies Omit<GasPublication, "publication_id" | "metric_id">;

const STOCK = {
  quantity_kind: "stock",
  basis: "completed",
  gas_day_from: "applicable_for",
  counts: false,
  verified: true,
  negate_portal_value: false,
} as const satisfies Omit<GasPublication, "publication_id" | "metric_id">;

function publication(
  publicationId: string,
  metricId: string,
  shape: Omit<GasPublication, "publication_id" | "metric_id">,
): GasPublication {
  return {
    publication_id: publicationId,
    metric_id: metricId,
    ...shape,
  };
}

export const GAS_PUBLICATIONS = [
  publication("PUBOB2042", "gas.gb_nts.entry.physical.national", FLOW),
  publication("PUBOB2043", "gas.gb_nts.entry.physical.north", FLOW),
  publication("PUBOB2044", "gas.gb_nts.entry.physical.south", FLOW),
  publication("PUBOB19", "gas.gb_nts.entry.forecast", FORECAST),
  publication("PUBOB4422", "gas.gb_nts.demand.actual_energy", {
    ...DAY,
    counts: false,
    verified: false,
  }),
  publication("PUBOB29", "gas.gb_nts.linepack.opening_interim", STOCK),
  publication("PUBOB30", "gas.gb_nts.linepack.pclp1", STOCK),
  publication("PUBOB31", "gas.gb_nts.linepack.pclp2", STOCK),
  publication("PUBOB4423", "gas.gb_nts.storage.injection", DAY),
  publication("PUBOB4424", "gas.gb_nts.storage.withdrawal", { ...DAY, negate_portal_value: true }),
  publication("PUBOB637", "gas.gb_nts.demand.actual_volume", DAY),
  publication("PUBOBJ635", "gas.gb_nts.supply.physical_volume", DAY),
  publication("PUBOBJ636", "gas.gb_nts.supply.physical_energy", DAY),
  publication("PUBOB693", "gas.gb_nts.linepack.opening", STOCK),
  publication("PUBOB694", "gas.gb_nts.linepack.closing", STOCK),
  publication("PUBOBJ1015", "gas.gb_nts.offtake.ldz.volume", DAY),
  publication("PUBOBJ1023", "gas.gb_nts.offtake.ldz.energy", DAY),
  publication("PUBOBJ1017", "gas.gb_nts.offtake.power.volume", DAY),
  publication("PUBOBJ1025", "gas.gb_nts.offtake.power.energy", DAY),
  publication("PUBOBJ1016", "gas.gb_nts.offtake.storage_injection.volume", DAY),
  publication("PUBOBJ1024", "gas.gb_nts.offtake.storage_injection.energy", DAY),
  publication("PUBOBJ1018", "gas.gb_nts.offtake.industrial.volume", DAY),
  publication("PUBOBJ1020", "gas.gb_nts.offtake.interconnector.volume", DAY),
  publication("PUBOBJ630", "gas.gb_nts.supply.storage_withdrawal", DAY),
] as const satisfies readonly GasPublication[];

export const GAS_PUBLICATION_IDS = GAS_PUBLICATIONS.map((row) => row.publication_id);

const BY_ID = new Map(GAS_PUBLICATIONS.map((row) => [row.publication_id, row]));

export function gasPublication(id: string): GasPublication | undefined {
  return BY_ID.get(id);
}

/**
 * Validated families. A parent and its children never both count.
 * LDZ, power, storage, industrial and interconnector volumes sit under NTS demand.
 * Storage withdrawal volume sits under physical supply. LDZ volume is itself the
 * parent of site rows, which this spike does not download.
 */
export const GAS_FAMILIES = [
  { parent: "PUBOB2042", children: ["PUBOB2043", "PUBOB2044"] },
  {
    parent: "PUBOB637",
    children: ["PUBOBJ1015", "PUBOBJ1016", "PUBOBJ1017", "PUBOBJ1018", "PUBOBJ1020"],
  },
  { parent: "PUBOBJ635", children: ["PUBOBJ630"] },
  { parent: "PUBOBJ1015", children: [] },
  { parent: "PUBOBJ1023", children: [] },
  { parent: "PUBOBJ1017", children: [] },
  { parent: "PUBOBJ1025", children: [] },
  { parent: "PUBOBJ1016", children: [] },
  { parent: "PUBOBJ1024", children: [] },
  { parent: "PUBOBJ1018", children: [] },
  { parent: "PUBOBJ1020", children: [] },
] as const satisfies readonly GasFamily[];

export function parentPublicationId(publicationId: string): string | null {
  for (const family of GAS_FAMILIES) {
    if ((family.children as readonly string[]).includes(publicationId)) {
      return family.parent;
    }
  }
  return null;
}

export const DEFERRED_PUBLICATION_IDS = ["PUBOB4422"] as const;
