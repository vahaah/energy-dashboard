import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataHealthReading } from "@/components/data-health-reading";
import { DataStateNotice } from "@/components/ui/data-state";
import { buildReading, loadDataHealth } from "@/lib/data-health";
import { ABSENT_FIGURE, assessPublication, DATA_STATE_LABEL, DATA_STATES } from "@/lib/data-state";

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
});
