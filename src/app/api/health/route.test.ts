import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPipe = vi.fn();

vi.mock("@/lib/tinybird", () => ({
  queryPipe: (...args: unknown[]) => queryPipe(...args),
}));

import { GET } from "./route";

function tinybirdTimestamp(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().replace("T", " ").slice(0, 19);
}

describe("/api/health", () => {
  beforeEach(() => {
    queryPipe.mockReset();
    queryPipe.mockResolvedValue([{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }]);
  });

  it("probes only latest_snapshot and keeps the four-stream payload", async () => {
    const response = await GET();
    const body = await response.json();

    expect(queryPipe).toHaveBeenCalledTimes(1);
    expect(queryPipe).toHaveBeenCalledWith("latest_snapshot", undefined, {
      purpose: "health",
      now: expect.any(Date),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=900, stale-while-revalidate=86400"
    );
    expect(body.ok).toBe(true);
    expect(body.streams.map((stream: { stream: string }) => stream.stream)).toEqual([
      "snapshots",
      "generation",
      "embedded",
      "prices",
    ]);
    expect(body.streams[0].critical).toBe(true);
    expect(body.streams.slice(1).every((stream: { critical: boolean }) => !stream.critical)).toBe(
      true
    );
  });

  it("returns 503 when the snapshot is stale", async () => {
    queryPipe.mockResolvedValue([{ timestamp: tinybirdTimestamp(4 * 60 * 60 * 1000) }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.streams[0].stale).toBe(true);
  });
});
