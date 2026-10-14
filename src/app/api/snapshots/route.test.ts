import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { elexonBmrsAttributionBlock } from "@/lib/attribution";

const queryPipe = vi.fn();

vi.mock("@/lib/tinybird", () => ({
  queryPipe: (...args: unknown[]) => queryPipe(...args),
}));

import { GET } from "./route";

describe("/api/snapshots", () => {
  beforeEach(() => {
    queryPipe.mockReset();
    queryPipe.mockResolvedValue([
      {
        timestamp: "2026-10-08 09:30:00",
        price_gbp_mwh: 42.5,
        price_mid_gbp_mwh: 68.4,
        mid_volume_mwh: 1840.5,
      },
    ]);
  });

  it("returns MID fields and the exact BMRS attribution block", async () => {
    const response = await GET(new NextRequest("http://localhost/api/snapshots?range=24h"));
    const body = await response.json();

    expect(queryPipe).toHaveBeenCalledWith(
      "snapshots_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h" })
    );
    expect(body.data[0]?.price_mid_gbp_mwh).toBe(68.4);
    expect(body.data[0]?.price_gbp_mwh).toBe(42.5);
    expect(body.attribution).toEqual(elexonBmrsAttributionBlock());
    expect(queryPipe.mock.calls[0]?.[2]).not.toHaveProperty("date");
  });

  it("asks for a past London day instead of rejecting it", async () => {
    queryPipe.mockResolvedValue([
      { timestamp: "2020-01-01 12:00:00", price_gbp_mwh: 10 },
      { timestamp: "2020-01-02 00:00:00", price_gbp_mwh: 11 },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/snapshots?range=24h&date=2020-01-01")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(queryPipe).toHaveBeenCalledWith(
      "snapshots_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h", date: "2020-01-01" })
    );
    expect(body.data).toEqual([{ timestamp: "2020-01-01 12:00:00", price_gbp_mwh: 10 }]);
    expect(body.count).toBe(1);
  });

  it("returns 400 for a future date and does not query", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/snapshots?range=24h&date=2099-01-01")
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "range_not_warmed" });
    expect(queryPipe).not.toHaveBeenCalled();
  });
});
