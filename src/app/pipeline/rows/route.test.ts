import { describe, expect, it } from "vitest";
import { GET } from "@/app/pipeline/rows/route";

describe("GET /pipeline/rows", () => {
  it("returns one page and a filtered CSV", async () => {
    const response = await GET(new Request("http://localhost/pipeline/rows"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    const body = (await response.json()) as { total: number; projects: { href: string | null; stage: string }[] };
    expect(body.projects.length).toBeLessThanOrEqual(40);
    expect(body.total).toBeGreaterThan(body.projects.length);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(80_000);

    const csv = await GET(new Request("http://localhost/pipeline/rows?format=csv&stage=in_planning"));
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text.split("\n")[0]).toBe("name,stage,technology,nation,capacity_mw,status_date,repd_ref,asset_path");
    expect(text).toContain("In planning");
    expect(text).not.toContain("Under construction");

    const rejected = await GET(new Request("http://localhost/pipeline/rows?scope=NI"));
    expect(rejected.status).toBe(400);
  });
});
