import { describe, expect, it } from "vitest";
import {
  columnIndexFromLetters,
  discoverPinkSheetMonthlyXlsxUrl,
  filterPriceRowsByDate,
  parsePinkSheetMonthKey,
  parsePinkSheetMonthlyPrices,
  parsePinkSheetMonthlySheet,
  parsePinkSheetSharedStrings,
  WORLD_BANK_PINK_SHEET_SERIES,
  WORLD_BANK_SOURCE_CREDIT,
  worldBankCronWindow,
} from "@/lib/world-bank-pink-sheet";
import { zipStoredEntries } from "@/lib/xlsx-zip";

const SHARED_STRINGS_XML = [
  "<sst>",
  "<si><t>Natural gas, Europe</t></si>",
  "<si><t>Liquefied natural gas, Japan</t></si>",
  "<si><t>2025M10</t></si>",
  "<si><t>2025M11</t></si>",
  "<si><t>…</t></si>",
  "</sst>",
].join("");

const SHEET_XML = [
  "<worksheet><sheetData>",
  '<c r="I1" t="s"><v>0</v></c>',
  '<c r="J1" t="s"><v>1</v></c>',
  '<c r="A2" t="s"><v>2</v></c>',
  '<c r="I2"><v>11.4</v></c>',
  '<c r="J2"><v>10.84</v></c>',
  '<c r="A3" t="s"><v>3</v></c>',
  '<c r="I3"><v>12.1</v></c>',
  '<c r="J3" t="s"><v>4</v></c>',
  "</sheetData></worksheet>",
].join("");

function pinkSheetFixtureXlsx(): Uint8Array {
  const workbook = [
    '<?xml version="1.0"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<sheets>",
    '<sheet name="Monthly Prices" sheetId="1" r:id="rId1"/>',
    "</sheets>",
    "</workbook>",
  ].join("");
  const rels = [
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    "</Relationships>",
  ].join("");
  const encode = (text: string) => new TextEncoder().encode(text);
  return zipStoredEntries([
    { name: "xl/workbook.xml", data: encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encode(rels) },
    { name: "xl/sharedStrings.xml", data: encode(SHARED_STRINGS_XML) },
    { name: "xl/worksheets/sheet1.xml", data: encode(SHEET_XML) },
  ]);
}

describe("World Bank Pink Sheet", () => {
  it("scrapes the monthly xlsx href and ignores the annual file", () => {
    const html = [
      '<a href="https://thedocs.worldbank.org/en/doc/aaa/related/CMO-Historical-Data-Annual.xlsx">Annual</a>',
      '<a href="https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx">Monthly</a>',
    ].join("\n");

    expect(discoverPinkSheetMonthlyXlsxUrl(html)).toBe(
      "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx"
    );
  });

  it("maps Pink Sheet month keys to month-start dates", () => {
    expect(parsePinkSheetMonthKey("2025M10")).toBe("2025-10-01");
    expect(parsePinkSheetMonthKey("2026M08")).toBe("2026-08-01");
    expect(parsePinkSheetMonthKey("2026M13")).toBeNull();
    expect(columnIndexFromLetters("I")).toBe(8);
    expect(columnIndexFromLetters("J")).toBe(9);
  });

  it("parses Europe gas and Japan LNG from a fixture sheet and skips ellipsis", () => {
    const shared = parsePinkSheetSharedStrings(SHARED_STRINGS_XML);
    const rows = parsePinkSheetMonthlySheet(SHEET_XML, shared);

    expect(WORLD_BANK_PINK_SHEET_SERIES.map((series) => series.header)).toEqual([
      "Natural gas, Europe",
      "Liquefied natural gas, Japan",
    ]);
    expect(rows).toEqual([
      {
        date: "2025-10-01",
        commodity: "eu_natural_gas",
        price: 11.4,
        currency: "USD",
        unit: "$/MMBTU",
      },
      {
        date: "2025-10-01",
        commodity: "lng_asia",
        price: 10.84,
        currency: "USD",
        unit: "$/MMBTU",
      },
      {
        date: "2025-11-01",
        commodity: "eu_natural_gas",
        price: 12.1,
        currency: "USD",
        unit: "$/MMBTU",
      },
    ]);
  });

  it("reads the same fixture after a round-trip through a stored xlsx zip", () => {
    expect(parsePinkSheetMonthlyPrices(pinkSheetFixtureXlsx())).toHaveLength(3);
  });

  it("filters the trailing World Bank window", () => {
    expect(worldBankCronWindow(new Date("2026-09-27T12:00:00.000Z"))).toEqual({
      from: "2026-06-01",
      to: "2026-09-27",
    });
    expect(
      filterPriceRowsByDate(
        [
          {
            date: "2026-05-01",
            commodity: "lng_asia",
            price: 1,
            currency: "USD",
            unit: "$/MMBTU",
          },
          {
            date: "2026-06-01",
            commodity: "lng_asia",
            price: 2,
            currency: "USD",
            unit: "$/MMBTU",
          },
        ],
        { from: "2026-06-01", to: "2026-09-27" }
      )
    ).toEqual([
      {
        date: "2026-06-01",
        commodity: "lng_asia",
        price: 2,
        currency: "USD",
        unit: "$/MMBTU",
      },
    ]);
    expect(WORLD_BANK_SOURCE_CREDIT).toContain("CC BY 4.0");
  });
});
