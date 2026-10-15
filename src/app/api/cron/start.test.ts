import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(async () => ({ runId: "run_test" }));

vi.mock("workflow/api", () => ({
  start: () => start(),
}));

import { GET as cron } from "@/app/api/cron/route";
import { GET as gas } from "@/app/api/cron-gas/route";
import { GET as prices } from "@/app/api/cron-prices/route";
import { GET as warm } from "@/app/api/cron-warm/route";
import { GET as yesterday } from "@/app/api/cron-yesterday/route";
import { GET as tec } from "@/app/api/cron-tec/route";

const SECRET = "cron-test-secret";

describe("cron starters", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    start.mockClear();
    start.mockResolvedValue({ runId: "run_test" });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.restoreAllMocks();
  });

  it.each([
    ["cron", cron],
    ["cron-warm", warm],
    ["cron-prices", prices],
    ["cron-yesterday", yesterday],
    ["cron-gas", gas],
    ["cron-tec", tec],
  ] as const)("%s only authenticates and starts a run", async (name, handler) => {
    const denied = await handler(new Request(`http://localhost/api/${name}`));
    expect(denied.status).toBe(401);
    expect(start).not.toHaveBeenCalled();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await handler(
      new Request(`http://localhost/api/${name}`, {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ ok: true, runId: "run_test" });
    expect(start).toHaveBeenCalledTimes(1);
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => /tinybird|elexon|nationalgas/i.test(url))).toBe(false);
  });
});
