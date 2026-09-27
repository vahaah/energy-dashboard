import { fetchText } from "@/lib/http";
import { addUtcDays, getLondonDate } from "@/lib/london-time";
import type { CommodityPrice } from "@/lib/types";

export const GB_GAS_SAP_COMMODITY = "gb_gas_sap";
export const GB_GAS_SAP_CURRENCY = "GBP";
export const GB_GAS_SAP_UNIT = "p/kWh";
export const GB_GAS_SAP_ITEM_ID = "PUBOB603";
export const NATIONAL_GAS_DATA_PORTAL_URL = "https://data.nationalgas.com";
export const NATIONAL_GAS_SOURCE_LABEL = "National Gas";

/** 1 therm = 29.3071 kWh. GB traders quote SAP in p/therm. */
export const PENCE_PER_KWH_TO_PENCE_PER_THERM = 29.3071;

/** 1 MWh = 1000 kWh, so p/kWh × 10 = £/MWh. */
export const PENCE_PER_KWH_TO_GBP_PER_MWH = 10;

export const SAP_CRON_LOOKBACK_DAYS = 7;
export const SAP_BACKFILL_CHUNK_DAYS = 90;

export function buildNationalGasSapCsvUrl(dateFrom: string, dateTo: string): string {
  const url = new URL("https://data.nationalgas.com/api/find-gas-data-download");
  url.searchParams.set("applicableFor", "Y");
  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("dateTo", dateTo);
  url.searchParams.set("dateType", "GASDAY");
  url.searchParams.set("latestFlag", "Y");
  url.searchParams.set("ids", GB_GAS_SAP_ITEM_ID);
  url.searchParams.set("type", "CSV");
  return url.toString();
}

export function sapCronWindow(now: Date): { from: string; to: string } {
  const to = getLondonDate(now);
  return { from: addUtcDays(to, -SAP_CRON_LOOKBACK_DAYS), to };
}

export function inclusiveDateChunks(
  from: string,
  to: string,
  daysPerChunk = SAP_BACKFILL_CHUNK_DAYS
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const chunkEnd = addUtcDays(cursor, daysPerChunk - 1);
    const end = chunkEnd < to ? chunkEnd : to;
    chunks.push({ from: cursor, to: end });
    cursor = addUtcDays(end, 1);
  }
  return chunks;
}

export function parseUkGasDay(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value.trim());
  if (!match) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function parseNationalGasSapCsv(csv: string): CommodityPrice[] {
  const trimmed = csv.replace(/^\uFEFF/, "").trim();
  if (trimmed.startsWith("<")) {
    throw new Error("National Gas returned HTML instead of CSV");
  }

  const rows = parseCsvRows(trimmed);
  const header = rows[0];
  if (!header) {
    throw new Error("National Gas SAP CSV is empty");
  }

  const dateIndex = header.indexOf("Applicable For");
  const valueIndex = header.indexOf("Value");
  if (dateIndex < 0 || valueIndex < 0) {
    throw new Error("National Gas SAP CSV is missing Applicable For or Value columns");
  }

  const byDate = new Map<string, CommodityPrice>();
  for (const row of rows.slice(1)) {
    const date = parseUkGasDay(row[dateIndex] ?? "");
    const price = Number.parseFloat(row[valueIndex] ?? "");
    if (!date || !Number.isFinite(price)) {
      continue;
    }
    byDate.set(date, {
      date,
      commodity: GB_GAS_SAP_COMMODITY,
      price,
      currency: GB_GAS_SAP_CURRENCY,
      unit: GB_GAS_SAP_UNIT,
    });
  }

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export async function fetchGbGasSapRange(
  dateFrom: string,
  dateTo: string,
  timeoutMs = 20_000
): Promise<CommodityPrice[]> {
  const csv = await fetchText(buildNationalGasSapCsvUrl(dateFrom, dateTo), { timeoutMs });
  return parseNationalGasSapCsv(csv);
}

export function rejectStoredSapDates(
  rows: CommodityPrice[],
  storedDates: Iterable<string>
): CommodityPrice[] {
  const stored = new Set(Array.from(storedDates, (date) => date.slice(0, 10)));
  return rows.filter((row) => !stored.has(row.date));
}

export function sapPencePerTherm(pencePerKwh: number): number {
  return pencePerKwh * PENCE_PER_KWH_TO_PENCE_PER_THERM;
}

export function sapGbpPerMwh(pencePerKwh: number): number {
  return pencePerKwh * PENCE_PER_KWH_TO_GBP_PER_MWH;
}

export function commodityChartValue(row: CommodityPrice): number {
  if (row.commodity === GB_GAS_SAP_COMMODITY) {
    return sapPencePerTherm(row.price);
  }
  return row.price;
}

export function formatSapPencePerTherm(pencePerKwh: number): string {
  return `${sapPencePerTherm(pencePerKwh).toFixed(1)} p/therm`;
}

export function formatSapGbpPerMwh(pencePerKwh: number): string {
  return `£${sapGbpPerMwh(pencePerKwh).toFixed(2)}/MWh`;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n") {
      pushRow();
      continue;
    }
    if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}
