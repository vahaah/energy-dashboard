import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron-directory/route";

const SECRET = "cron-test-secret";

describe("GET /api/cron-directory", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.DIRECTORY_BLOB_STORE_ID;
    delete process.env.DIRECTORY_BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.DIRECTORY_BLOB_STORE_ID;
    delete process.env.DIRECTORY_BLOB_READ_WRITE_TOKEN;
  });

  it("fails closed and does not fetch ISD without the private directory store", async () => {
    const denied = await GET(new Request("http://localhost/api/cron-directory"));
    expect(denied.status).toBe(401);

    process.env.BLOB_READ_WRITE_TOKEN = "public-tiles-token";
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

  it("runs on a Monday minute that no other cron uses", () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const directory = vercel.crons.find((entry) => entry.path === "/api/cron-directory");
    expect(directory?.schedule).toBe("45 6 * * 1");
    const minute = directory?.schedule.split(" ")[0];
    const shared = vercel.crons.filter((entry) => entry.path !== "/api/cron-directory" && entry.schedule.split(" ")[0] === minute);
    expect(shared).toEqual([]);
  });
});
