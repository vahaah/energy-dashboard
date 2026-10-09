import { describe, expect, it } from "vitest";
import {
  computeRecords,
  historicRecordsSql,
  historicRowToGeneration,
  historicWeeklySql,
  isSaneHistoricRow,
  NESO_HISTORIC_SQL_URL,
  parseNesoHistoricRow,
  periodAverages,
  transitionSentences,
  yearlyAverages,
  type NesoHistoricRow,
} from "@/lib/historic-mix";

function row(overrides: Partial<NesoHistoricRow> & Pick<NesoHistoricRow, "DATETIME">): NesoHistoricRow {
  return {
    GAS: 8000,
    COAL: 0,
    NUCLEAR: 4000,
    WIND: 6000,
    WIND_EMB: 1500,
    HYDRO: 400,
    IMPORTS: 2000,
    BIOMASS: 1200,
    OTHER: 300,
    SOLAR: 2000,
    STORAGE: 0,
    GENERATION: 25400,
    CARBON_INTENSITY: 140,
    LOW_CARBON: 15100,
    ZERO_CARBON: 13900,
    RENEWABLE: 9900,
    FOSSIL: 8000,
    GAS_perc: 31.5,
    COAL_perc: 0,
    NUCLEAR_perc: 15.7,
    WIND_perc: 23.6,
    WIND_EMB_perc: 5.9,
    HYDRO_perc: 1.6,
    IMPORTS_perc: 7.9,
    BIOMASS_perc: 4.7,
    OTHER_perc: 1.2,
    SOLAR_perc: 7.9,
    STORAGE_perc: 0,
    LOW_CARBON_perc: 59.4,
    ZERO_CARBON_perc: 54.7,
    RENEWABLE_perc: 39,
    FOSSIL_perc: 31.5,
    ...overrides,
  };
}

const badJulyRow = row({
  DATETIME: "2026-07-07T10:00:00",
  GAS: 0,
  GAS_perc: 0,
  GENERATION: 32760,
  ZERO_CARBON_perc: 104.1,
  RENEWABLE_perc: 61.8,
  CARBON_INTENSITY: 69,
  WIND: 6434,
  WIND_EMB: 1826,
  SOLAR: 11971,
});

describe("NESO historic sanity", () => {
  it("rejects the known bad 2026-07-07 10:00 row", () => {
    expect(isSaneHistoricRow(badJulyRow)).toBe(false);
    const parsed = parseNesoHistoricRow({
      DATETIME: "2026-07-07T10:00:00",
      GAS: "0.0",
      GAS_perc: "0.0",
      ZERO_CARBON_perc: "104.1",
      RENEWABLE_perc: "61.8",
      GENERATION: "32760.0",
      WIND: "6434.0",
      WIND_EMB: "1826.0",
      SOLAR: "11971.0",
      CARBON_INTENSITY: "69.0",
    });
    expect(parsed).not.toBeNull();
    expect(isSaneHistoricRow(parsed as NesoHistoricRow)).toBe(false);
  });

  it("rejects shares outside 0-100 and wind/solar above GB maxima", () => {
    expect(isSaneHistoricRow(row({ DATETIME: "2026-01-01T00:00:00", WIND: 25000, WIND_EMB: 6000 }))).toBe(
      false
    );
    expect(isSaneHistoricRow(row({ DATETIME: "2026-01-01T00:00:00", SOLAR: 21000 }))).toBe(false);
    expect(isSaneHistoricRow(row({ DATETIME: "2026-01-01T00:00:00", GAS_perc: -1 }))).toBe(false);
    expect(
      isSaneHistoricRow(
        row({
          DATETIME: "2026-01-01T00:00:00",
          GAS_perc: 80,
          COAL_perc: 80,
          NUCLEAR_perc: 80,
          WIND_perc: 80,
          WIND_EMB_perc: 0,
          HYDRO_perc: 0,
          IMPORTS_perc: 0,
          BIOMASS_perc: 0,
          OTHER_perc: 0,
          SOLAR_perc: 0,
          STORAGE_perc: 0,
        })
      )
    ).toBe(false);
  });

  it("keeps a normal half-hour", () => {
    expect(isSaneHistoricRow(row({ DATETIME: "2026-05-23T09:00:00" }))).toBe(true);
  });

  it("avoids COALESCE in NESO SQL and still excludes zero-carbon above 100% on carbon extrema", () => {
    expect(historicWeeklySql()).not.toMatch(/COALESCE|ABS\s*\(/);
    expect(historicRecordsSql()).not.toMatch(/COALESCE|ABS\s*\(/);
    expect(historicRecordsSql()).toContain('"ZERO_CARBON_perc" <= 100');
    expect(historicRecordsSql()).toContain('ORDER BY "ZERO_CARBON_perc" DESC');
    expect(historicRecordsSql()).toContain('("WIND" + "WIND_EMB" + "SOLAR" + "HYDRO" + "NUCLEAR")');
    expect(historicRecordsSql()).toContain("WITH sane AS");
    const weeklyUrl = `${NESO_HISTORIC_SQL_URL}?sql=${encodeURIComponent(historicWeeklySql())}`;
    expect(weeklyUrl.length).toBeLessThan(2500);
  });
});

describe("historic generation rows", () => {
  it("folds embedded wind into wind so demand is not counted twice", () => {
    const rows = historicRowToGeneration(
      row({
        DATETIME: "2026-03-25T13:30:00",
        WIND: 20000,
        WIND_EMB: 3880,
      })
    );
    expect(rows.find((entry) => entry.fuel_type === "embedded_wind")).toBeUndefined();
    expect(rows.find((entry) => entry.fuel_type === "wind")?.generation_mw).toBe(23880);
  });
});

describe("computeRecords", () => {
  it("excludes the bad July row from extrema", () => {
    const records = computeRecords(
      [
        row({
          DATETIME: "2024-04-15T12:00:00",
          CARBON_INTENSITY: 19,
          WIND: 8000,
          WIND_EMB: 2000,
          SOLAR: 4000,
        }),
        row({
          DATETIME: "2026-03-25T13:30:00",
          WIND: 20000,
          WIND_EMB: 3880,
          SOLAR: 1000,
          CARBON_INTENSITY: 80,
        }),
        row({
          DATETIME: "2026-04-23T12:00:00",
          SOLAR: 16290,
          WIND: 4000,
          WIND_EMB: 800,
          CARBON_INTENSITY: 90,
        }),
        badJulyRow,
        row({
          DATETIME: "2024-09-30T11:30:00",
          COAL: 12,
          COAL_perc: 0.1,
          GAS_perc: 31.4,
          CARBON_INTENSITY: 200,
        }),
      ],
      new Date("2026-10-09T12:00:00.000Z")
    );

    expect(records.lowestCarbon?.value).toBe(19);
    expect(records.lowestCarbon?.timestampUtc).toBe("2024-04-15T12:00:00");
    expect(records.maxWind?.value).toBe(23880);
    expect(records.maxSolar?.value).toBe(16290);
    expect(records.lastCoal?.timestampUtc).toBe("2024-09-30T11:30:00");
    expect(records.daysSinceCoal).toBe(
      Math.floor(
        (Date.parse("2026-10-09T12:00:00.000Z") - Date.parse("2024-09-30T11:30:00.000Z")) /
          86_400_000
      )
    );
    expect(records.windMilestones.some((milestone) => milestone.gw === 10)).toBe(true);
    expect(records.windMilestones.find((milestone) => milestone.gw === 23)?.timestampUtc).toBe(
      "2026-03-25T13:30:00"
    );
    expect(records.lowestCarbon?.timestampUtc).not.toBe("2026-07-07T10:00:00");
  });
});

describe("yearly averages and copy", () => {
  it("builds sentences from the computed yearly averages", () => {
    const years = yearlyAverages([
      row({
        DATETIME: "2008-12-29T00:00:00",
        COAL_perc: 45,
        GAS_perc: 35,
        NUCLEAR_perc: 16,
        WIND_perc: 0,
        WIND_EMB_perc: 0,
        HYDRO_perc: 1,
        IMPORTS_perc: 2,
        BIOMASS_perc: 0,
        OTHER_perc: 1,
        SOLAR_perc: 0,
        STORAGE_perc: 0,
        CARBON_INTENSITY: 561,
        RENEWABLE_perc: 1,
      }),
      row({
        DATETIME: "2009-06-01T12:00:00",
        COAL_perc: 28,
        GAS_perc: 45,
        NUCLEAR_perc: 18,
        WIND_perc: 2,
        WIND_EMB_perc: 0,
        HYDRO_perc: 1,
        IMPORTS_perc: 2,
        BIOMASS_perc: 2,
        OTHER_perc: 2,
        SOLAR_perc: 0,
        STORAGE_perc: 0,
        CARBON_INTENSITY: 445,
        RENEWABLE_perc: 3,
      }),
      row({
        DATETIME: "2026-03-01T12:00:00",
        COAL_perc: 0,
        GAS_perc: 25,
        NUCLEAR_perc: 12,
        WIND_perc: 30,
        WIND_EMB_perc: 8,
        HYDRO_perc: 2,
        IMPORTS_perc: 10,
        BIOMASS_perc: 5,
        OTHER_perc: 3,
        SOLAR_perc: 5,
        STORAGE_perc: 0,
        CARBON_INTENSITY: 142,
        RENEWABLE_perc: 40,
      }),
    ]);
    expect(years[0]?.year).toBe(2009);
    expect(years[0]?.carbon).toBe(445);
    expect(years[1]?.windPct).toBe(38);
    const sentences = transitionSentences(years);
    expect(sentences?.[0]).not.toContain("2008");
    expect(sentences?.[0]).toContain("2009");
    expect(sentences?.[0]).toContain("28%");
    expect(sentences?.[0]).toContain("445");
    expect(sentences?.[1]).toContain("2026");
    expect(sentences?.[1]).toContain("142");
    expect(sentences?.[2]).toContain("2%");
    expect(sentences?.[2]).toContain("38%");
  });

  it("averages a period without inventing a price", () => {
    const averages = periodAverages([
      row({ DATETIME: "2026-01-01T00:00:00", GENERATION: 20000, IMPORTS: 2000, CARBON_INTENSITY: 100 }),
      row({ DATETIME: "2026-01-08T00:00:00", GENERATION: 30000, IMPORTS: 4000, CARBON_INTENSITY: 200 }),
    ]);
    expect(averages.carbon).toBe(150);
    expect(averages.demandMw).toBe(25000);
    expect(averages.generationMw).toBe(22000);
    expect(averages.transfersMw).toBe(3000);
    expect(averages.priceGbpMwh).toBeNull();
  });
});
