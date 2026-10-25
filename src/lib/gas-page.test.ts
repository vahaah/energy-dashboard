import { describe, expect, it } from "vitest";
import { GB_GAS_SAP_COMMODITY } from "@/lib/gb-gas-sap";
import { buildGasPageModel, gasCitePlainText, gasFaqs, meanCommodityInWindow } from "@/lib/gas-page";

describe("gas page model", () => {
  const rows = [
    { date: "2026-10-08", commodity: GB_GAS_SAP_COMMODITY, price: 2.4, currency: "GBP", unit: "p/kWh" },
    { date: "2026-10-09", commodity: GB_GAS_SAP_COMMODITY, price: 2.5, currency: "GBP", unit: "p/kWh" },
    { date: "2026-10-09", commodity: "henry_hub_gas", price: 3.12, currency: "USD", unit: "$/MMBTU" },
    { date: "2026-09-01", commodity: "eu_natural_gas", price: 10.2, currency: "USD", unit: "$/MMBTU" },
    { date: "2026-09-01", commodity: "lng_asia", price: 11.4, currency: "USD", unit: "$/MMBTU" },
  ];

  it("opens with SAP in p/kWh and p/therm", () => {
    const model = buildGasPageModel(rows);
    expect(model.kind).toBe("numbers");
    expect(model.sapPencePerKwh).toBe("2.50");
    expect(gasCitePlainText(model)).toContain("2.50p/kWh");
    expect(gasCitePlainText(model)).toContain("p/therm");
    expect(gasCitePlainText(model)).toContain("National Gas");
    expect(gasCitePlainText(model)).not.toMatch(/\bTTF\b/);
    expect(model.series.map((row) => row.commodity)).toEqual([
      GB_GAS_SAP_COMMODITY,
      "henry_hub_gas",
      "eu_natural_gas",
      "lng_asia",
    ]);
    expect(model.series.find((row) => row.commodity === "henry_hub_gas")?.unit).toBe("$/MMBtu");
    expect(model.series.find((row) => row.commodity === "eu_natural_gas")?.monthly).toBe(true);
    expect(model.series.find((row) => row.commodity === GB_GAS_SAP_COMMODITY)?.change).toContain("vs prior");
  });

  it("averages SAP inside the observation window", () => {
    const window = meanCommodityInWindow(rows, GB_GAS_SAP_COMMODITY, "2026-10-01", "2026-10-31");
    expect(window?.count).toBe(2);
    expect(window?.average).toBeCloseTo(2.45);
  });

  it("explains SAP versus NBP without inventing an NBP series", () => {
    const answers = gasFaqs(buildGasPageModel(rows)).map((faq) => faq.answer).join(" ");
    expect(answers).toContain("does not republish a separate NBP series");
    expect(answers).not.toMatch(/\bTTF\b/);
  });
});
