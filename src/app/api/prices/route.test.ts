import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const queryPipe = vi.fn();

vi.mock("@/lib/tinybird", () => ({
  queryPipe: (...args: unknown[]) => queryPipe(...args),
}));

import { GET } from "./route";

const brent = {
  date: "2026-09-26",
  commodity: "brent_crude",
  price: 70.12,
  currency: "USD",
  unit: "$/BBL",
};

const ttf = {
  date: "2026-09-27",
  commodity: "eu_ttf",
  price: 81.89,
  currency: "EUR",
  unit: "EUR/MWh",
};

describe("/api/prices public commodities", () => {
  beforeEach(() => {
    queryPipe.mockReset();
    queryPipe.mockResolvedValue([ttf, brent]);
  });

  it("returns 400 unknown commodity for eu_ttf", async () => {
    const response = await GET(new NextRequest("http://localhost/api/prices?commodity=eu_ttf"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown commodity" });
    expect(queryPipe).not.toHaveBeenCalled();
  });

  it("returns zero eu_ttf rows on the default response", async () => {
    const response = await GET(new NextRequest("http://localhost/api/prices"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.some((row: { commodity: string }) => row.commodity === "eu_ttf")).toBe(false);
    expect(body.data).toEqual([brent]);
    expect(body.count).toBe(1);
  });
});
