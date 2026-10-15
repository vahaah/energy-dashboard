import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/constraints/route";
import { CONSTRAINTS_ALLOCATION, CONSTRAINTS_API_DESCRIPTION } from "@/lib/constraints/copy";

describe("GET /api/v1/constraints", () => {
  it("rejects an unsupported filter and does not allocate national cost to a boundary", async () => {
    const impossible = await GET(
      new Request("http://localhost/api/v1/constraints?from=2026-02-31&to=2026-03-01"),
    );
    expect(impossible.status).toBe(400);
    expect(await impossible.json()).toEqual({ error: "invalid date" });

    const missing = await GET(new Request("http://localhost/api/v1/constraints"));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "invalid date" });

    const extra = await GET(
      new Request("http://localhost/api/v1/constraints?from=2026-10-01&to=2026-10-08&fuel=wind"),
    );
    expect(extra.status).toBe(400);
    expect(await extra.json()).toEqual({ error: "unsupported filter" });

    const unknown = await GET(
      new Request("http://localhost/api/v1/constraints?from=2026-10-15&to=2026-10-15&boundary=NEWGROUP"),
    );
    expect(unknown.status).toBe(400);

    const bounded = await GET(
      new Request("http://localhost/api/v1/constraints?from=2026-10-15&to=2026-10-15&boundary=ESTEX"),
    );
    expect(bounded.status).toBe(200);
    const body = await bounded.json();
    expect(body.description).toBe(CONSTRAINTS_API_DESCRIPTION);
    expect(body.allocation).toBe(CONSTRAINTS_ALLOCATION);
    expect(body.boundary_cost).toBeNull();
    expect(body.breakdown).toEqual([]);
    expect(body.day_ahead.length).toBeGreaterThan(0);
    expect(body.day_ahead.every((row: { boundary: string; kind: string }) => row.boundary === "ESTEX" && row.kind === "forecast")).toBe(true);
  });
});
