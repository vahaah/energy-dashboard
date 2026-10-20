import { describe, expect, it } from "vitest";
import { buildNiRelease } from "@/lib/eirgrid/release";
import { EIRGRID_GROUP_LICENCE_READ_ON, EIRGRID_GROUP_LICENCE_URL } from "@/lib/attribution";
import { parseChartDocument, parseMarketPricingDocument } from "@/lib/eirgrid/parse";
import { releaseContainsSterling } from "@/lib/eirgrid/page-model";

const CHART = JSON.stringify({
  Rows: [
    { EffectiveTime: "15-Oct-2026 00:00:00", FieldName: "SYSTEM_DEMAND", Region: "NI", Value: 636 },
    { EffectiveTime: "15-Oct-2026 00:15:00", FieldName: "SYSTEM_DEMAND", Region: "GB", Value: 30000 },
    { EffectiveTime: "15-Oct-2026 00:15:00", FieldName: "SYSTEM_DEMAND", Region: "UK", Value: 1 },
    { EffectiveTime: "15-Oct-2026 00:15:00", FieldName: "INTER_MOYLE", Region: "NI", Value: -120.5 },
  ],
});

const MARKET = String.raw`{"rows":[{\"date\":\"15-Oct-2026 00:30:00\",\"NET_IMBALANCE_VOLUME\":38.738,\"IMBALANCE_SETTLEMENT_PRICE\":266.7,\"IMBALANCE_SETTLEMENT_PRICE_GBP\":237.82}]}`;

describe("EirGrid parsers", () => {
  it("keeps NI, drops GB and UK, and does not store sterling", () => {
    const chart = parseChartDocument(CHART);
    expect(chart.quarantined).toBeGreaterThan(0);
    expect(chart.series.map((series) => series.metric_id).sort()).toEqual([
      "elec.ni.demand.system",
      "elec.ni.transfers.moyle",
    ]);
    expect(chart.series.every((series) => series.geography_id === "NI")).toBe(true);
    const market = parseMarketPricingDocument(MARKET);
    const price = market.series.find((series) => series.metric_id === "elec.all_island.price.imbalance");
    expect(price?.points[0]?.value).toBe(266.7);
    expect(price?.unit).toBe("€/MWh");
    const release = buildNiRelease(
      {
        published_at: "2026-10-15T00:30:00.000Z",
        licence_url: EIRGRID_GROUP_LICENCE_URL,
        licence_read_on: EIRGRID_GROUP_LICENCE_READ_ON,
        series: [...chart.series, ...market.series],
      },
      "2026-10-15T00:40:00.000Z",
    );
    expect(releaseContainsSterling(release)).toBe(false);
    expect(JSON.stringify(release)).not.toContain("237.82");
  });
});
