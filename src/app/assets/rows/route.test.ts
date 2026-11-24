import { describe, expect, it } from "vitest";
import { GET } from "@/app/assets/rows/route";

describe("GET /assets/rows", () => {
  it("returns one page and a nuclear filter", async () => {
    const response = await GET(new Request("http://localhost/assets/rows"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    const body = (await response.json()) as {
      total: number;
      assets: { id: string; latitude?: number }[];
    };
    expect(body.assets.length).toBeLessThanOrEqual(25);
    expect(body.total).toBeGreaterThan(body.assets.length);
    expect(body.assets[0]?.latitude).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(40_000);

    const nuclear = await GET(new Request("http://localhost/assets/rows?technology=nuclear"));
    const filtered = (await nuclear.json()) as { total: number; assets: { name: string; technology: string }[] };
    expect(nuclear.status).toBe(200);
    expect(filtered.total).toBeGreaterThan(0);
    expect(filtered.assets.every((row) => row.technology === "nuclear")).toBe(true);
    expect(filtered.assets.some((row) => /Sizewell|Hinkley|Heysham|Hartlepool|Torness/.test(row.name))).toBe(true);

    const rejected = await GET(new Request("http://localhost/assets/rows?format=csv"));
    expect(rejected.status).toBe(400);
  });
});
