import { displayedPercents, formatDisplay, reconcileSignedDisplay, roundDisplay } from "@/lib/display-rounding";
import {
  FINAL_CONSUMPTION_BASE,
  PRIMARY_SUPPLY_BASE,
  WHOLE_ENERGY_SECTORS,
  WHOLE_ENERGY_SECTOR_LABEL,
  WHOLE_ENERGY_SECTOR_NOTE,
  shareOf,
  type ShareBase,
  type WholeEnergySectorId,
} from "@/lib/whole-energy/copy";
import { DISPLAY_QUANTUM_TWH, ktoeTextToTwh } from "@/lib/whole-energy/convert";
import type { WholeEnergyEdition, WholeEnergyRow } from "@/lib/whole-energy/schema";
import {
  BALANCE_COLUMNS,
  COLUMN_LABEL,
  FUEL_COLUMNS,
  includedInLabel,
  rowDepth,
  rowEmphasis,
  showsInTable,
  sumParent,
  type BalanceColumnId,
} from "@/lib/whole-energy/spec";

export type DisplayedBalanceCell = {
  column: BalanceColumnId;
  label: string;
  text: string;
  value: number;
  exact: number;
};

export type DisplayedBalanceRow = {
  id: string;
  label: string;
  role: WholeEnergyRow["role"];
  depth: 0 | 1;
  emphasis: boolean;
  includedIn: string | null;
  cells: DisplayedBalanceCell[];
};

export type WholeEnergyPathNode = {
  id: "gas" | "power" | "electricity";
  label: string;
  detail: string;
  text: string;
  value: number;
  exact: number;
  shareText: string;
  shareBase: ShareBase;
  sharePercent: number;
};

export type WholeEnergySector = {
  id: WholeEnergySectorId;
  label: string;
  note: string;
  totalText: string;
  total: number;
  shareText: string;
  shareBase: typeof FINAL_CONSUMPTION_BASE;
  sharePercent: number;
  fuels: { column: BalanceColumnId; label: string; text: string; value: number }[];
};

export type WholeEnergyPageModel = {
  year: number;
  geography: "UK";
  rows: DisplayedBalanceRow[];
  path: readonly [WholeEnergyPathNode, WholeEnergyPathNode, WholeEnergyPathNode];
  sectors: WholeEnergySector[];
};

const SECTOR_ROW: Record<WholeEnergySectorId, string> = {
  homes: "domestic",
  transport: "transport",
  industry: "industry",
};

function quanta(value: number): number {
  return Math.round(value / DISPLAY_QUANTUM_TWH);
}

function displaySigned(values: readonly number[], total: number): { parts: number[]; total: number } {
  const shown = reconcileSignedDisplay(
    values.map((value) => ({
      value: Math.abs(value),
      sign: value < 0 ? -1 : 1,
    })),
    total,
    DISPLAY_QUANTUM_TWH,
  );
  const parts = shown.parts.map((magnitude, index) => ((values[index] ?? 0) < 0 ? -magnitude : magnitude));
  const partQuanta = parts.reduce((sum, value) => sum + quanta(value), 0);
  if (partQuanta !== quanta(shown.total)) {
    throw new Error("displayed balance parts do not sum to the displayed total");
  }
  return { parts, total: shown.total };
}

function onePercent(part: number, whole: number): number {
  if (!(whole > 0) || !Number.isFinite(part)) {
    throw new Error("percent base is not positive");
  }
  const [percent] = displayedPercents([(part / whole) * 100]);
  if (percent == null) {
    throw new Error("percent was not rounded");
  }
  return percent;
}

function rowById(edition: WholeEnergyEdition, id: string): WholeEnergyRow {
  const row = edition.rows.find((item) => item.id === id);
  if (!row) {
    throw new Error(`balance is missing ${id}`);
  }
  return row;
}

function exact(row: WholeEnergyRow, column: BalanceColumnId): number {
  return ktoeTextToTwh(row.ktoe[column]);
}

function text(value: number): string {
  return formatDisplay(value, DISPLAY_QUANTUM_TWH);
}

export function buildWholeEnergyPage(edition: WholeEnergyEdition): WholeEnergyPageModel {
  if (edition.geography !== "UK") {
    throw new Error("whole energy geography must be UK");
  }
  const targets = new Map<string, number>();
  for (const parentId of ["primary_supply", "transformation", "final_consumption"] as const) {
    const parent = rowById(edition, parentId);
    const children = edition.rows.filter((row) => sumParent(row.role) === parentId);
    const shown = displaySigned(
      children.map((row) => exact(row, "total")),
      exact(parent, "total"),
    );
    targets.set(parentId, shown.total);
    children.forEach((row, index) => {
      targets.set(row.id, shown.parts[index] ?? 0);
    });
  }
  for (const row of edition.rows) {
    if (!targets.has(row.id)) {
      targets.set(row.id, roundDisplay(exact(row, "total"), DISPLAY_QUANTUM_TWH));
    }
  }

  const supplyShown = targets.get("primary_supply");
  const differenceShown = targets.get("statistical_difference");
  const demandRounded = targets.get("primary_demand");
  if (supplyShown == null || differenceShown == null || demandRounded == null) {
    throw new Error("primary supply rows are missing");
  }
  const demandIdentity = (quanta(supplyShown) - quanta(differenceShown)) * DISPLAY_QUANTUM_TWH;
  if (quanta(demandIdentity) === quanta(demandRounded)) {
    targets.set("primary_demand", demandIdentity);
  }

  const displayed = new Map<string, DisplayedBalanceRow>();
  for (const row of edition.rows) {
    const target = targets.get(row.id);
    if (target == null) {
      throw new Error(`no display total for ${row.id}`);
    }
    const fuelExact = FUEL_COLUMNS.map((column) => exact(row, column));
    const shown = displaySigned(fuelExact, target);
    const cells: DisplayedBalanceCell[] = BALANCE_COLUMNS.map((column, index) => {
      const value = column === "total" ? shown.total : (shown.parts[index] ?? 0);
      const exactValue = exact(row, column);
      return {
        column,
        label: COLUMN_LABEL[column],
        text: text(value),
        value,
        exact: exactValue,
      };
    });
    displayed.set(row.id, {
      id: row.id,
      label: row.label,
      role: row.role,
      depth: rowDepth(row.role),
      emphasis: rowEmphasis(row.role),
      includedIn: includedInLabel(row.role),
      cells,
    });
  }

  const rows = edition.rows.filter((row) => showsInTable(row.role)).map((row) => {
    const shown = displayed.get(row.id);
    if (!shown) {
      throw new Error(`missing displayed row ${row.id}`);
    }
    return shown;
  });

  const cell = (id: string, column: BalanceColumnId): DisplayedBalanceCell => {
    const row = displayed.get(id);
    const found = row?.cells.find((item) => item.column === column);
    if (!found) {
      throw new Error(`missing ${id} ${column}`);
    }
    return found;
  };

  const supplyTotal = cell("primary_supply", "total").exact;
  const finalTotal = cell("final_consumption", "total").exact;
  const gas = cell("primary_supply", "natural_gas");
  const powerInput = cell("electricity_generation", "natural_gas");
  const finalElectricity = cell("final_consumption", "electricity");
  const gasShare = onePercent(gas.exact, supplyTotal);
  const powerShare = onePercent(Math.abs(powerInput.exact), supplyTotal);
  const electricityShare = onePercent(finalElectricity.exact, finalTotal);

  const path: WholeEnergyPageModel["path"] = [
    {
      id: "gas",
      label: "Natural gas",
      detail: "Primary supply.",
      text: gas.text,
      value: gas.value,
      exact: gas.exact,
      shareText: shareOf(gasShare, PRIMARY_SUPPLY_BASE),
      shareBase: PRIMARY_SUPPLY_BASE,
      sharePercent: gasShare,
    },
    {
      id: "power",
      label: "Power generation",
      detail: "Transformation input, already inside primary supply.",
      text: text(Math.abs(powerInput.value)),
      value: Math.abs(powerInput.value),
      exact: Math.abs(powerInput.exact),
      shareText: shareOf(powerShare, PRIMARY_SUPPLY_BASE),
      shareBase: PRIMARY_SUPPLY_BASE,
      sharePercent: powerShare,
    },
    {
      id: "electricity",
      label: "Final electricity",
      detail: "Final consumption.",
      text: finalElectricity.text,
      value: finalElectricity.value,
      exact: finalElectricity.exact,
      shareText: shareOf(electricityShare, FINAL_CONSUMPTION_BASE),
      shareBase: FINAL_CONSUMPTION_BASE,
      sharePercent: electricityShare,
    },
  ];

  const sectors: WholeEnergySector[] = WHOLE_ENERGY_SECTORS.map((id): WholeEnergySector => {
    const source = displayed.get(SECTOR_ROW[id]);
    if (!source) {
      throw new Error(`missing sector ${id}`);
    }
    const totalCell = source.cells.find((item) => item.column === "total");
    if (!totalCell) {
      throw new Error(`missing ${id} total`);
    }
    const percent = onePercent(totalCell.exact, finalTotal);
    return {
      id,
      label: WHOLE_ENERGY_SECTOR_LABEL[id],
      note: WHOLE_ENERGY_SECTOR_NOTE[id],
      totalText: totalCell.text,
      total: totalCell.value,
      shareText: shareOf(percent, FINAL_CONSUMPTION_BASE),
      shareBase: FINAL_CONSUMPTION_BASE,
      sharePercent: percent,
      fuels: source.cells
        .filter((item) => item.column !== "total")
        .map((item) => ({
          column: item.column,
          label: item.label,
          text: item.text,
          value: item.value,
        })),
    };
  });

  return {
    year: edition.year,
    geography: edition.geography,
    rows,
    path,
    sectors,
  };
}
