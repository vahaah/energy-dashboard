import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const getLookAhead = vi.fn();

vi.mock("@/lib/forecasts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/forecasts")>("@/lib/forecasts");
  return {
    ...actual,
    getLookAhead: (...args: unknown[]) => getLookAhead(...args),
  };
});

import { GET } from "./route";

describe("/api/look-ahead", () => {
  beforeEach(() => {
    getLookAhead.mockReset();
    getLookAhead.mockResolvedValue({
      fetchedAt: "2026-10-10T12:00:00.000Z",
      greenest: {
        startUtc: "2026-10-10T13:00Z",
        endUtc: "2026-10-10T15:00Z",
        grams: 43,
        sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
      },
      carbonSeries: [
        { time: "2026-10-10 13:00:00", value: 40 },
        { time: "2026-10-10 13:30:00", value: 42 },
      ],
      wind: {
        tonightGw: 11,
        tomorrowEveningGw: 8.4,
        sparkline: [11, 8.4],
        sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
        basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
      },
      demandSeries: [{ time: "2026-10-10 13:00:00", value: 19_500 }],
    });
  });

  it("returns only derived answers and never the raw carbon forecast series", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=1800, stale-while-revalidate=86400"
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, s-maxage=1800, stale-while-revalidate=86400"
    );
    expect(body.greenestWindow.grams).toBe(43);
    expect(body.wind.sentence).toContain("fall to 8.4 GW");
    expect(body).not.toHaveProperty("carbonSeries");
    expect(body).not.toHaveProperty("demandSeries");
    expect(body).not.toHaveProperty("data");
    expect(JSON.stringify(body)).not.toContain("13:30:00");
    expect(JSON.stringify(body)).not.toContain("19500");
    expect(body.attribution.carbonNote).toContain("not republished");
  });

  it("does not query Tinybird", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./route.ts"), "utf8");
    expect(source).not.toContain("tinybird");
    expect(source).not.toContain("queryPipe");
    expect(source).toContain("publicLookAhead");
  });
});
