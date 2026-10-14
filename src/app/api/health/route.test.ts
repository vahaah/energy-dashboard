import { beforeEach, describe, expect, it, vi } from "vitest";

const peekWarmedPipe = vi.fn();

vi.mock("@/lib/warm-envelope", () => ({
  peekWarmedPipe: (...args: unknown[]) => peekWarmedPipe(...args),
}));

import { GET } from "./route";

function tinybirdTimestamp(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().replace("T", " ").slice(0, 19);
}

describe("/api/health", () => {
  beforeEach(() => {
    peekWarmedPipe.mockReset();
    peekWarmedPipe.mockResolvedValue([{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }]);
  });

  it("reads the warmed 24h envelope and keeps the four-stream payload", async () => {
    const response = await GET();
    const body = await response.json();

    expect(peekWarmedPipe).toHaveBeenCalledTimes(1);
    expect(peekWarmedPipe).toHaveBeenCalledWith(
      "snapshots_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h" })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=86400"
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

  it("returns 503 when the snapshot envelope is stale", async () => {
    peekWarmedPipe.mockResolvedValue([{ timestamp: tinybirdTimestamp(4 * 60 * 60 * 1000) }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.streams[0].stale).toBe(true);
  });

  it("returns 503 when the envelope is missing and does not query Tinybird", async () => {
    peekWarmedPipe.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.streams[0].stale).toBe(true);
    expect(body.streams[0].latest).toBeNull();
  });
});
