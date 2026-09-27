import { fetchBytes, fetchText } from "@/lib/http";
import { formatIsoDate } from "@/lib/london-time";
import type { CommodityPrice } from "@/lib/types";
import { unzipEntries } from "@/lib/xlsx-zip";

export const WORLD_BANK_COMMODITY_MARKETS_URL =
  "https://www.worldbank.org/en/research/commodity-markets";
export const WORLD_BANK_SOURCE_CREDIT =
  "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0";
export const WORLD_BANK_CRON_LOOKBACK_MONTHS = 3;
export const WORLD_BANK_USER_AGENT = "GridEnergyDashboard/1.0 (+https://grid.vahaah.com)";
export const MONTHLY_PRICES_SHEET_NAME = "Monthly Prices";

const MONTHLY_XLSX_HREF =
  /https:\/\/thedocs\.worldbank\.org\/[^"'<\s]+CMO-Historical-Data-Monthly\.xlsx/i;
const MONTH_KEY = /^(\d{4})M(\d{2})$/;
const MISSING_VALUES = new Set(["", "…", "...", ".", "n/a", "NA"]);

export const WORLD_BANK_PINK_SHEET_SERIES = [
  {
    header: "Natural gas, Europe",
    commodity: "eu_natural_gas",
    unit: "$/MMBTU",
    currency: "USD",
  },
  {
    header: "Liquefied natural gas, Japan",
    commodity: "lng_asia",
    unit: "$/MMBTU",
    currency: "USD",
  },
] as const;

export function discoverPinkSheetMonthlyXlsxUrl(html: string): string {
  const match = MONTHLY_XLSX_HREF.exec(html);
  if (!match) {
    throw new Error("World Bank commodity page has no CMO-Historical-Data-Monthly.xlsx link");
  }
  return match[0];
}

export function parsePinkSheetMonthKey(value: string): string | null {
  const match = MONTH_KEY.exec(value.trim());
  if (!match) {
    return null;
  }
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    return null;
  }
  return `${match[1]}-${match[2]}-01`;
}

export function worldBankCronWindow(now: Date): { from: string; to: string } {
  const to = formatIsoDate(now);
  const year = Number.parseInt(to.slice(0, 4), 10);
  const month = Number.parseInt(to.slice(5, 7), 10);
  const absolute = year * 12 + (month - 1) - WORLD_BANK_CRON_LOOKBACK_MONTHS;
  const fromYear = Math.floor(absolute / 12);
  const fromMonth = (absolute % 12) + 1;
  return {
    from: `${String(fromYear).padStart(4, "0")}-${String(fromMonth).padStart(2, "0")}-01`,
    to,
  };
}

export function filterPriceRowsByDate(
  rows: CommodityPrice[],
  range?: { from?: string; to?: string }
): CommodityPrice[] {
  if (!range?.from && !range?.to) {
    return rows;
  }
  return rows.filter((row) => {
    if (range.from && row.date < range.from) {
      return false;
    }
    if (range.to && row.date > range.to) {
      return false;
    }
    return true;
  });
}

export function parsePinkSheetSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siPattern = /<(?:[\w.]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?si>/g;
  for (const match of xml.matchAll(siPattern)) {
    const parts: string[] = [];
    const textPattern = /<(?:[\w.]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?t>/g;
    for (const text of match[1].matchAll(textPattern)) {
      parts.push(decodeXml(text[1]));
    }
    strings.push(parts.join(""));
  }
  return strings;
}

export function parsePinkSheetSheetRows(
  sheetXml: string,
  sharedStrings: string[]
): Map<number, Map<number, string>> {
  const rows = new Map<number, Map<number, string>>();
  const cellPattern = /<(?:[\w.]+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:[\w.]+:)?c>)/g;

  for (const match of sheetXml.matchAll(cellPattern)) {
    const ref = attributeValue(match[1], "r");
    if (!ref) {
      continue;
    }
    const parsed = parseCellRef(ref);
    if (!parsed) {
      continue;
    }
    const type = attributeValue(match[1], "t");
    const raw = match[2] ? innerValueText(match[2]) : "";
    const value = cellValue(type, raw, sharedStrings);
    if (value == null) {
      continue;
    }
    const row = rows.get(parsed.row) ?? new Map<number, string>();
    row.set(parsed.column, value);
    rows.set(parsed.row, row);
  }

  return rows;
}

export function parsePinkSheetMonthlySheet(
  sheetXml: string,
  sharedStrings: string[]
): CommodityPrice[] {
  const rows = parsePinkSheetSheetRows(sheetXml, sharedStrings);
  const columns = findPinkSheetSeriesColumns(rows);
  if (!columns) {
    throw new Error("Pink Sheet Monthly Prices sheet is missing the Europe gas or Japan LNG columns");
  }

  const prices: CommodityPrice[] = [];
  for (const [rowNumber, cells] of rows) {
    if (rowNumber <= columns.headerRow) {
      continue;
    }
    const date = parsePinkSheetMonthKey(cells.get(0) ?? "");
    if (!date) {
      continue;
    }
    for (const series of WORLD_BANK_PINK_SHEET_SERIES) {
      const price = parsePinkSheetNumber(cells.get(columns.byCommodity[series.commodity]) ?? "");
      if (price == null) {
        continue;
      }
      prices.push({
        date,
        commodity: series.commodity,
        price,
        currency: series.currency,
        unit: series.unit,
      });
    }
  }

  return prices;
}

export function parsePinkSheetMonthlyPrices(xlsxBytes: Uint8Array): CommodityPrice[] {
  const entries = unzipEntries(xlsxBytes);
  const workbook = readZipText(entries, "xl/workbook.xml");
  const rels = readZipText(entries, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parsePinkSheetSharedStrings(readZipText(entries, "xl/sharedStrings.xml"));
  const sheetPath = monthlyPricesSheetPath(workbook, rels);
  return parsePinkSheetMonthlySheet(readZipText(entries, sheetPath), sharedStrings);
}

export async function fetchWorldBankMonthly(range?: {
  from?: string;
  to?: string;
}): Promise<CommodityPrice[]> {
  const html = await fetchText(WORLD_BANK_COMMODITY_MARKETS_URL, {
    timeoutMs: 20_000,
    headers: { "User-Agent": WORLD_BANK_USER_AGENT },
  });
  const xlsxUrl = discoverPinkSheetMonthlyXlsxUrl(html);
  const bytes = await fetchBytes(xlsxUrl, {
    timeoutMs: 30_000,
    headers: { "User-Agent": WORLD_BANK_USER_AGENT },
  });
  return filterPriceRowsByDate(parsePinkSheetMonthlyPrices(bytes), range);
}

function findPinkSheetSeriesColumns(
  rows: Map<number, Map<number, string>>
): { headerRow: number; byCommodity: Record<string, number> } | null {
  for (const [rowNumber, cells] of rows) {
    const byCommodity: Record<string, number> = {};
    for (const [column, value] of cells) {
      for (const series of WORLD_BANK_PINK_SHEET_SERIES) {
        if (value === series.header) {
          byCommodity[series.commodity] = column;
        }
      }
    }
    if (WORLD_BANK_PINK_SHEET_SERIES.every((series) => series.commodity in byCommodity)) {
      return { headerRow: rowNumber, byCommodity };
    }
  }
  return null;
}

function monthlyPricesSheetPath(workbookXml: string, relsXml: string): string {
  const sheetPattern = /<(?:[\w.]+:)?sheet\b([^>]*)\/?>/g;
  let relationshipId: string | null = null;
  for (const match of workbookXml.matchAll(sheetPattern)) {
    if (attributeValue(match[1], "name") === MONTHLY_PRICES_SHEET_NAME) {
      relationshipId =
        attributeValue(match[1], "r:id") ?? attributeValue(match[1], "id");
      break;
    }
  }
  if (!relationshipId) {
    throw new Error("Pink Sheet workbook has no Monthly Prices sheet");
  }

  const relPattern = /<(?:[\w.]+:)?Relationship\b([^>]*)\/?>/g;
  for (const match of relsXml.matchAll(relPattern)) {
    if (attributeValue(match[1], "Id") === relationshipId) {
      const target = attributeValue(match[1], "Target");
      if (!target) {
        break;
      }
      return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    }
  }
  throw new Error("Pink Sheet workbook is missing the Monthly Prices relationship");
}

function readZipText(entries: Map<string, Uint8Array>, path: string): string {
  const data = entries.get(path);
  if (!data) {
    throw new Error(`Pink Sheet xlsx is missing ${path}`);
  }
  return new TextDecoder().decode(data);
}

function parseCellRef(ref: string): { column: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) {
    return null;
  }
  return {
    column: columnIndexFromLetters(match[1]),
    row: Number.parseInt(match[2], 10),
  };
}

export function columnIndexFromLetters(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function attributeValue(attributes: string, name: string): string | null {
  const needle = `${name}="`;
  const start = attributes.indexOf(needle);
  if (start === -1) {
    return null;
  }
  const from = start + needle.length;
  const end = attributes.indexOf('"', from);
  return end === -1 ? null : attributes.slice(from, end);
}

const VALUE_TAG = /<(?:[\w.]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?v>/;

function innerValueText(xml: string): string {
  return VALUE_TAG.exec(xml)?.[1] ?? "";
}

function cellValue(type: string | null, raw: string, sharedStrings: string[]): string | null {
  if (type === "s") {
    const index = Number.parseInt(raw, 10);
    return Number.isFinite(index) ? (sharedStrings[index] ?? null) : null;
  }
  if (type === "inlineStr") {
    return decodeXml(raw);
  }
  return decodeXml(raw);
}

function parsePinkSheetNumber(value: string): number | null {
  const trimmed = value.trim();
  if (MISSING_VALUES.has(trimmed)) {
    return null;
  }
  const price = Number.parseFloat(trimmed);
  return Number.isFinite(price) ? price : null;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
