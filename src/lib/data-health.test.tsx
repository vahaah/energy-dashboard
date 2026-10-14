import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataHealthPage from "@/app/data-health/page";
import { DataHealthReading } from "@/components/data-health-reading";
import { DataStateNotice } from "@/components/ui/data-state";
import { buildReading, loadDataHealth } from "@/lib/data-health";
import { ABSENT_FIGURE, assessPublication, DATA_STATE_LABEL, DATA_STATES } from "@/lib/data-state";

vi.mock("next/navigation", () => ({
  usePathname: () => "/data-health",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const peekWarmedEnvelope = vi.fn();

vi.mock("@/lib/warm-envelope", () => ({
  peekWarmedEnvelope: (...args: unknown[]) => peekWarmedEnvelope(...args),
}));

const PUBLISHED = "2026-10-14T08:00:00.000Z";
const RETRIEVED = "2026-10-14T11:00:00.000Z";
const NOW = new Date(RETRIEVED);

describe("data health clocks", () => {
  it("renders the source published clock 09:00 with a stale flag when Grid retrieved it at 12:00", () => {
    const reading = buildReading({
      metricId: "elec.gb.demand.itsdo",
      value: 28000,
      publishedAt: PUBLISHED,
      retrievedAt: RETRIEVED,
      now: NOW,
    });
    const html = renderToStaticMarkup(<DataHealthReading reading={reading} featured />);

    expect(reading.stale).toBe(true);
    expect(reading.state).toBe("stale");
    expect(reading.published_label).toBe("09:00");
    expect(reading.retrieved_label).toBe("12:00");
    expect(html).toMatch(/data-clock="published"[^>]*>09:00<\/time>/);
    expect(html).toMatch(/data-clock="retrieved"[^>]*>12:00<\/time>/);
    expect(html).toContain('data-state="stale"');
    expect(html).toContain("Stale");
    expect(html).toContain("Elexon BMRS");
  });

  it("does not mark an annual cadence stale at 48 hours", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const publishedAt = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const assessed = assessPublication({
      value: 70,
      publishedAt,
      retrievedAt: now.toISOString(),
      expectedCadence: "P1Y",
      now,
    });

    expect(assessed.stale).toBe(false);
    expect(assessed.state).not.toBe("stale");
  });

  it("keeps a fresh settlement period open until the period end plus grace", () => {
    const reading = buildReading({
      metricId: "elec.gb.demand.itsdo",
      value: 28000,
      publishedAt: "2026-10-14T11:00:00.000Z",
      retrievedAt: "2026-10-14T11:31:00.000Z",
      now: new Date("2026-10-14T11:31:00.000Z"),
    });

    expect(reading.published_label).toBe("12:00");
    expect(reading.stale).toBe(false);
    expect(reading.state).toBeNull();
  });

  it("does not mark a Friday EIA print stale over the weekend", () => {
    const reading = buildReading({
      metricId: "commodity.brent.spot",
      value: 66.4,
      publishedAt: "2026-10-09T00:00:00.000Z",
      retrievedAt: "2026-10-11T12:00:00.000Z",
      now: new Date("2026-10-11T12:00:00.000Z"),
    });
    const monday = buildReading({
      metricId: "commodity.brent.spot",
      value: 66.4,
      publishedAt: "2026-10-09T00:00:00.000Z",
      retrievedAt: "2026-10-12T00:00:01.000Z",
      now: new Date("2026-10-12T00:00:01.000Z"),
    });

    expect(reading.stale).toBe(false);
    expect(reading.state).toBeNull();
    expect(monday.stale).toBe(true);
    expect(monday.state).toBe("stale");
  });

  it("renders a missing value as an em dash", () => {
    const reading = buildReading({
      metricId: "commodity.gb_gas_sap.price",
      value: null,
      publishedAt: null,
      retrievedAt: null,
      now: NOW,
    });
    const html = renderToStaticMarkup(<DataHealthReading reading={reading} />);

    expect(reading.value_label).toBe(ABSENT_FIGURE);
    expect(html).toContain(`>${ABSENT_FIGURE}<`);
    expect(html).not.toMatch(/data-value(?:="true")?>0</);
    expect(html).toContain("Not yet available");
  });
});

describe("data state notice", () => {
  it("names every state in text and with an icon", () => {
    for (const state of DATA_STATES) {
      const html = renderToStaticMarkup(<DataStateNotice state={state} />);
      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain(DATA_STATE_LABEL[state]);
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe("loadDataHealth", () => {
  beforeEach(() => {
    peekWarmedEnvelope.mockReset();
  });

  it("reads warmed envelopes for an Elexon field and GB gas SAP and does not query Tinybird", async () => {
    peekWarmedEnvelope.mockImplementation(async (pipe: string) => {
      if (pipe === "snapshots_range") {
        return {
          data: [{ timestamp: "2026-10-14 08:00:00", demand_mw: 28000 }],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      if (pipe === "prices_range") {
        return {
          data: [
            {
              date: "2026-10-13",
              commodity: "gb_gas_sap",
              price: 2.8,
              currency: "GBP",
              unit: "p/kWh",
            },
          ],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      return null;
    });

    const readings = await loadDataHealth(NOW);
    const demand = readings.find((reading) => reading.metric_id === "elec.gb.demand.itsdo");
    const sap = readings.find((reading) => reading.metric_id === "commodity.gb_gas_sap.price");
    const source = readFileSync(resolve(import.meta.dirname, "./data-health.ts"), "utf8");
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/v1/data-health/route.ts"),
      "utf8"
    );

    expect(peekWarmedEnvelope).toHaveBeenCalledWith(
      "snapshots_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h" })
    );
    expect(peekWarmedEnvelope).toHaveBeenCalledWith(
      "prices_range",
      expect.any(Object),
      expect.objectContaining({ range: "30d" })
    );
    expect(peekWarmedEnvelope).toHaveBeenCalledWith(
      "prices_range",
      expect.any(Object),
      expect.objectContaining({ range: "1y" })
    );
    expect(demand).toMatchObject({
      published_label: "09:00",
      retrieved_label: "12:00",
      stale: true,
      state: "stale",
      source: "Elexon BMRS",
    });
    expect(sap?.published_at).toBe("2026-10-13T00:00:00.000Z");
    expect(sap?.retrieved_at).toBe(RETRIEVED);
    expect(sap?.value_label).toBe("2.8");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("fetchPipeRows");
    expect(route).not.toContain("queryPipe");
    expect(route).toContain("loadDataHealth");
  });

  it("sums every matching generation row at the latest timestamp", async () => {
    peekWarmedEnvelope.mockImplementation(async (pipe: string) => {
      if (pipe !== "generation_5min_range") {
        return null;
      }
      return {
        data: [
          { timestamp: "2026-10-14 08:25:00", fuel_type: "ccgt", generation_mw: 7000, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "ocgt", generation_mw: 300, source: "fuelinst" },
          { timestamp: "2026-10-14 08:00:00", fuel_type: "ocgt", generation_mw: 9000, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "intfr", generation_mw: 400, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "intned", generation_mw: 600, source: "fuelinst" },
          { timestamp: "2026-10-14 08:00:00", fuel_type: "intifa", generation_mw: 100, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "intned", generation_mw: -50, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "intfr", generation_mw: -200, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "ps", generation_mw: -80, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "bess", generation_mw: -20, source: "fuelinst" },
        ],
        cachedAt: Date.parse(RETRIEVED),
        freshFor: 300,
      };
    });

    const readings = await loadDataHealth(NOW);
    expect(readings.find((reading) => reading.metric_id === "elec.gb.generation.gas")).toMatchObject({
      value: 7300,
      value_label: "7,300",
    });
    expect(readings.find((reading) => reading.metric_id === "elec.gb.imports.fuelinst")?.value).toBe(1000);
    expect(readings.find((reading) => reading.metric_id === "elec.gb.exports.fuelinst")?.value).toBe(250);
    expect(readings.find((reading) => reading.metric_id === "elec.gb.storage.charging")?.value).toBe(100);
  });

  it("reads World Bank month-start rows from the warmed 1y price envelope", async () => {
    peekWarmedEnvelope.mockImplementation(async (pipe: string, _params: unknown, options?: { range?: string }) => {
      if (pipe !== "prices_range") {
        return null;
      }
      if (options?.range === "1y") {
        return {
          data: [
            {
              date: "2026-09-01",
              commodity: "eu_natural_gas",
              price: 11.2,
              currency: "USD",
              unit: "$/MMBtu",
            },
          ],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      return {
        data: [
          {
            date: "2026-10-13",
            commodity: "gb_gas_sap",
            price: 2.8,
            currency: "GBP",
            unit: "p/kWh",
          },
        ],
        cachedAt: Date.parse(RETRIEVED),
        freshFor: 300,
      };
    });

    const readings = await loadDataHealth(NOW);
    const europe = readings.find((reading) => reading.metric_id === "commodity.eu_natural_gas.spot");
    const sap = readings.find((reading) => reading.metric_id === "commodity.gb_gas_sap.price");

    expect(europe).toMatchObject({
      value: 11.2,
      value_label: "11.2",
      published_at: "2026-09-01T00:00:00.000Z",
      retrieved_at: RETRIEVED,
      stale: true,
    });
    expect(sap?.value_label).toBe("2.8");
    expect(sap?.published_at).toBe("2026-10-13T00:00:00.000Z");
  });

  it("derives balance and wind, solar and hydro share from the aligned observations", async () => {
    peekWarmedEnvelope.mockImplementation(async (pipe: string) => {
      if (pipe !== "generation_5min_range") {
        return null;
      }
      return {
        data: [
          { timestamp: "2026-10-14 08:25:00", fuel_type: "ccgt", generation_mw: 7000, source: "fuelinst" },
          { timestamp: "2026-10-14 08:25:00", fuel_type: "wind", generation_mw: 2000, source: "fuelinst" },
          { timestamp: "2026-10-14 08:00:00", fuel_type: "embedded_wind", generation_mw: 1000, source: "neso" },
          { timestamp: "2026-10-14 07:00:00", fuel_type: "wind", generation_mw: 9000, source: "fuelinst" },
        ],
        cachedAt: Date.parse(RETRIEVED),
        freshFor: 300,
      };
    });

    const readings = await loadDataHealth(NOW);
    const balance = readings.find((reading) => reading.metric_id === "elec.gb.generation.balance");
    const share = readings.find((reading) => reading.metric_id === "elec.gb.share.wind_solar_hydro");

    expect(balance).toMatchObject({
      value: 10000,
      value_label: "10,000",
      published_at: "2026-10-14T08:00:00.000Z",
      state: "stale",
    });
    expect(share).toMatchObject({
      value: 30,
      value_label: "30",
      published_at: "2026-10-14T08:00:00.000Z",
    });
    expect(share?.state).not.toBe("not_yet_available");
  });

  it("renders primed envelope values on the data health page", async () => {
    peekWarmedEnvelope.mockImplementation(async (pipe: string, _params: unknown, options?: { range?: string }) => {
      if (pipe === "snapshots_range") {
        return {
          data: [{ timestamp: "2026-10-14 08:00:00", demand_mw: 28000 }],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      if (pipe === "generation_5min_range") {
        return {
          data: [
            { timestamp: "2026-10-14 08:25:00", fuel_type: "ccgt", generation_mw: 7000, source: "fuelinst" },
            { timestamp: "2026-10-14 08:25:00", fuel_type: "ocgt", generation_mw: 300, source: "fuelinst" },
          ],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      if (pipe === "prices_range" && options?.range === "30d") {
        return {
          data: [
            {
              date: "2026-10-13",
              commodity: "gb_gas_sap",
              price: 2.8,
              currency: "GBP",
              unit: "p/kWh",
            },
          ],
          cachedAt: Date.parse(RETRIEVED),
          freshFor: 300,
        };
      }
      return null;
    });

    const html = renderToStaticMarkup(await DataHealthPage());

    expect(html).toContain("28,000");
    expect(html).toContain("2.8");
    expect(html).toContain("7,300");
    expect(html).toContain("Demand");
    expect(html).toContain("GB gas SAP");
    expect(html).toContain("Gas generation");
    const demandCard = html.slice(html.indexOf(">Demand<"), html.indexOf(">GB gas SAP<"));
    expect(demandCard).toContain("28,000");
    expect(demandCard).not.toContain("Not yet available");
    const sapCard = html.slice(html.indexOf(">GB gas SAP<"), html.indexOf(">Every series<"));
    expect(sapCard).toContain("2.8");
    expect(sapCard).not.toContain("Not yet available");
  });
});
