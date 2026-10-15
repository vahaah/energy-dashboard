import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(async () => ({ runId: "run_constraints" }));

vi.mock("workflow/api", () => ({
  start: () => start(),
}));

import { GET } from "@/app/api/cron-constraints/route";

const SECRET = "cron-test-secret";

describe("GET /api/cron-constraints", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    start.mockClear();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed, rejects an unknown bundle, and does not fetch NESO", async () => {
    const denied = await GET(new Request("http://localhost/api/cron-constraints?bundle=breakdown"));
    expect(denied.status).toBe(401);
    expect(start).not.toHaveBeenCalled();

    const bad = await GET(
      new Request("http://localhost/api/cron-constraints?bundle=ttf", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(bad.status).toBe(400);
    expect(start).not.toHaveBeenCalled();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ok = await GET(
      new Request("http://localhost/api/cron-constraints?bundle=breakdown", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(ok.status).toBe(202);
    const body = await ok.json();
    expect(body).toMatchObject({ ok: true, runId: "run_constraints", bundle: "breakdown" });
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => /neso|tinybird/i.test(url))).toBe(false);
    fetchSpy.mockRestore();
  });
});
