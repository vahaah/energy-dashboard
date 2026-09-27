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

const withdrawn = [
  {
    date: "2026-09-27",
    commodity: "eu_ttf",
    price: 81.89,
    currency: "EUR",
    unit: "EUR/MWh",
  },
  {
    date: "2026-09-01",
    commodity: "eu_natural_gas",
    price: 11.4,
    currency: "USD",
    unit: "$/MMBTU",
  },
  {
    date: "2026-09-01",
    commodity: "lng_asia",
    price: 10.84,
    currency: "USD",
    unit: "$/MMBTU",
  },
] as const;

describe("/api/prices public commodities", () => {
  beforeEach(() => {
    queryPipe.mockReset();
    queryPipe.mockResolvedValue([...withdrawn, brent]);
  });

  it("returns 400 unknown commodity for withdrawn TTF", async () => {
    const response = await GET(new NextRequest("http://localhost/api/prices?commodity=eu_ttf"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "unknown commodity" });
    expect(queryPipe).not.toHaveBeenCalled();
  });

  it("returns World Bank monthly series and hides leftover TTF", async () => {
    const response = await GET(new NextRequest("http://localhost/api/prices"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.data.some((row: { commodity: string }) => row.commodity === "eu_ttf")
    ).toBe(false);
    expect(body.data).toEqual([
      withdrawn[1],
      withdrawn[2],
      brent,
    ]);
    expect(body.count).toBe(3);
  });
});
