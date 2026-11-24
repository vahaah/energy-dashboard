import { describe, expect, it } from "vitest";
import { GET } from "@/app/projects/rows/route";

describe("GET /projects/rows", () => {
  it("returns one page and rejects an unknown filter", async () => {
    const response = await GET(new Request("http://localhost/projects/rows?page=2"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    const body = (await response.json()) as { total: number; page: number; pages: number; projects: { href: string }[] };
    expect(body.page).toBe(2);
    expect(body.projects.length).toBeLessThanOrEqual(40);
    expect(body.projects.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(body.projects.length);
    expect(body.projects[0]?.href.startsWith("/projects/")).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(80_000);
    const rejected = await GET(new Request("http://localhost/projects/rows?export=1"));
    expect(rejected.status).toBe(400);
  });

  it("filters by technology without returning the register", async () => {
    const response = await GET(new Request("http://localhost/projects/rows?technology=Solar%20PV&page=1"));
    const body = (await response.json()) as { total: number; projects: { technology: string }[] };
    expect(response.status).toBe(200);
    expect(body.projects.every((row) => row.technology === "Solar PV")).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });
});
