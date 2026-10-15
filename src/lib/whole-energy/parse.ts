import { formatKtoeCenti, ktoeCentiFromNumber } from "@/lib/whole-energy/convert";
import {
  BALANCE_COLUMNS,
  ROW_SPEC,
  columnIdForHeader,
  normalizeBalanceLabel,
  type BalanceColumnId,
  type RowRole,
} from "@/lib/whole-energy/spec";

export type ParsedBalanceRow = {
  id: string;
  label: string;
  sourceLabel: string;
  role: RowRole;
  ktoe: Record<BalanceColumnId, string>;
};

export type ParsedBalance = {
  year: number;
  rows: ParsedBalanceRow[];
};

function cellText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function parseKtoeCell(value: unknown, where: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatKtoeCenti(ktoeCentiFromNumber(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed)) {
      throw new Error(`${where} is not a number`);
    }
    return formatKtoeCenti(ktoeCentiFromNumber(parsed));
  }
  throw new Error(`${where} is missing`);
}

/**
 * Parse one DUKES 1.1 year sheet. The sheet unit must be ktoe.
 * Row order is the published order. Duplicate labels stay in that order.
 */
export function parseBalanceSheet(rows: readonly (readonly unknown[])[], year: number): ParsedBalance {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error(`balance year is not usable: ${year}`);
  }
  let headerIndex = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.some((cell) => columnIdForHeader(cellText(cell)) === "coal")) {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error("DUKES 1.1 sheet has no fuel header");
  }

  const preamble = rows
    .slice(0, headerIndex)
    .flatMap((row) => row.map((cell) => cellText(cell)))
    .join(" ");
  if (!/\bktoe\b/i.test(preamble)) {
    throw new Error("DUKES 1.1 sheet is not in ktoe, so it was not converted");
  }
  if (!preamble.includes(String(year))) {
    throw new Error(`DUKES 1.1 sheet title does not name ${year}`);
  }

  const header = rows[headerIndex] ?? [];
  const columnIndex = new Map<BalanceColumnId, number>();
  header.forEach((cell, index) => {
    const id = columnIdForHeader(cellText(cell));
    if (id) {
      columnIndex.set(id, index);
    }
  });
  for (const id of BALANCE_COLUMNS) {
    if (!columnIndex.has(id)) {
      throw new Error(`DUKES 1.1 sheet is missing the ${id} column`);
    }
  }

  const body: { sourceLabel: string; cells: readonly unknown[] }[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const sourceLabel = cellText(row[0]);
    if (!sourceLabel) {
      continue;
    }
    body.push({ sourceLabel, cells: row });
  }
  if (body.length !== ROW_SPEC.length) {
    throw new Error(`DUKES 1.1 sheet has ${body.length} balance rows, expected ${ROW_SPEC.length}`);
  }

  const parsed: ParsedBalanceRow[] = body.map((row, index) => {
    const spec = ROW_SPEC[index];
    if (!spec) {
      throw new Error(`missing row spec ${index}`);
    }
    const normalized = normalizeBalanceLabel(row.sourceLabel);
    if (normalized !== spec.match) {
      throw new Error(`row ${index + 1} is "${row.sourceLabel}", expected "${spec.match}"`);
    }
    const ktoe = {} as Record<BalanceColumnId, string>;
    for (const id of BALANCE_COLUMNS) {
      const column = columnIndex.get(id);
      if (column == null) {
        throw new Error(`missing ${id}`);
      }
      ktoe[id] = parseKtoeCell(row.cells[column], `${spec.id} ${id}`);
    }
    return {
      id: spec.id,
      label: spec.label,
      sourceLabel: row.sourceLabel,
      role: spec.role,
      ktoe,
    };
  });

  return { year, rows: parsed };
}
