import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(async () => ({ runId: "run_balancing" }));

vi.mock("workflow/api", () => ({
  start: () => start(),
}));

import { GET } from "@/app/api/cron-balancing/route";

const SECRET = "cron-test-secret";

describe("GET /api/cron-balancing", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    start.mockClear();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed and does not fetch NESO or Elexon", async () => {
    const denied = await GET(new Request("http://localhost/api/cron-balancing"));
    expect(denied.status).toBe(401);
    expect(start).not.toHaveBeenCalled();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ok = await GET(
      new Request("http://localhost/api/cron-balancing", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(ok.status).toBe(202);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
