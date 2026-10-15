import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron-directory/route";

const SECRET = "cron-test-secret";

describe("GET /api/cron-directory", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("fails closed and does not fetch ISD without a blob token", async () => {
    const denied = await GET(new Request("http://localhost/api/cron-directory"));
    expect(denied.status).toBe(401);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const missing = await GET(
      new Request("http://localhost/api/cron-directory", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(missing.status).toBe(503);
    const body = (await missing.json()) as { error?: string };
    expect(body.error).toBe("blob store is not set");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
