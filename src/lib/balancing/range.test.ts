import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/balancing/route";

describe("GET /api/v1/balancing?range=", () => {
  it("returns the requested range and keeps the full release on the unscoped route", async () => {
    const ranged = await GET(new Request("http://localhost/api/v1/balancing?range=90d"));
    expect(ranged.status).toBe(200);
    expect(ranged.headers.get("cache-control")).toContain("public");
    const series = (await ranged.json()) as { range: string; daily: unknown[]; monthly: unknown[]; trade_months: unknown[]; days?: unknown };
    expect(series.range).toBe("90d");
    expect(series.daily.length).toBeLessThanOrEqual(90);
    expect(series.days).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(series))).toBeLessThan(120_000);

    const full = await GET(new Request("http://localhost/api/v1/balancing"));
    const body = (await full.json()) as { days: unknown[] };
    expect(full.status).toBe(200);
    expect(body.days.length).toBeGreaterThan(series.daily.length);

    const rejected = await GET(new Request("http://localhost/api/v1/balancing?range=week"));
    expect(rejected.status).toBe(400);
  });
});
