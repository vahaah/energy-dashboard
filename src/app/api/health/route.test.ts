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
    peekWarmedPipe.mockImplementation(async (pipe: string) => {
      if (pipe === "snapshots_range") {
        return [{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }];
      }
      if (pipe === "generation_5min_range") {
        return [
          {
            timestamp: tinybirdTimestamp(20 * 60 * 1000),
            source: "fuelinst",
            fuel_type: "ccgt",
            generation_mw: 1000,
          },
          {
            timestamp: tinybirdTimestamp(25 * 60 * 1000),
            source: "neso",
            fuel_type: "embedded_wind",
            generation_mw: 400,
          },
          {
            timestamp: tinybirdTimestamp(40 * 60 * 1000),
            source: "pvlive",
            fuel_type: "embedded_solar",
            generation_mw: 200,
          },
        ];
      }
      if (pipe === "prices_range") {
        const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return [
          {
            date: day,
            commodity: "brent_crude",
            price: 70,
            currency: "USD",
            unit: "$/BBL",
          },
        ];
      }
      return null;
    });
  });

  it("reads warmed envelopes and keeps the four-stream payload", async () => {
    const response = await GET();
    const body = await response.json();

    expect(peekWarmedPipe).toHaveBeenCalledTimes(3);
    expect(peekWarmedPipe).toHaveBeenCalledWith(
      "snapshots_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h" })
    );
    expect(peekWarmedPipe).toHaveBeenCalledWith(
      "generation_5min_range",
      expect.any(Object),
      expect.objectContaining({ range: "24h" })
    );
    expect(peekWarmedPipe).toHaveBeenCalledWith(
      "prices_range",
      expect.any(Object),
      expect.objectContaining({ range: "30d" })
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
    expect(body.streams.every((stream: { latest: string | null }) => stream.latest != null)).toBe(
      true
    );
    expect(body.streams[2].stale).toBe(false);
    expect(body.streams[2].critical).toBe(false);
  });

  it("flags embedded from the older feed and from a missing feed", async () => {
    const wind = tinybirdTimestamp(20 * 60 * 1000);
    const solar = tinybirdTimestamp(3 * 60 * 60 * 1000);
    peekWarmedPipe.mockImplementation(async (pipe: string) => {
      if (pipe === "snapshots_range") {
        return [{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }];
      }
      if (pipe === "generation_5min_range") {
        return [
          { timestamp: wind, source: "neso", fuel_type: "embedded_wind", generation_mw: 400 },
          { timestamp: solar, source: "pvlive", fuel_type: "embedded_solar", generation_mw: 200 },
        ];
      }
      return [];
    });

    const older = await GET();
    const olderBody = await older.json();

    expect(older.status).toBe(200);
    expect(olderBody.streams[2]).toMatchObject({
      stream: "embedded",
      latest: solar,
      stale: true,
      critical: false,
    });

    peekWarmedPipe.mockImplementation(async (pipe: string) => {
      if (pipe === "snapshots_range") {
        return [{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }];
      }
      if (pipe === "generation_5min_range") {
        return [{ timestamp: wind, source: "neso", fuel_type: "embedded_wind", generation_mw: 400 }];
      }
      return [];
    });

    const missing = await GET();
    const missingBody = await missing.json();

    expect(missing.status).toBe(200);
    expect(missingBody.streams[2]).toMatchObject({
      stream: "embedded",
      latest: null,
      stale: true,
      critical: false,
    });
  });

  it("returns 503 when the snapshot envelope is stale", async () => {
    peekWarmedPipe.mockResolvedValue([{ timestamp: tinybirdTimestamp(4 * 60 * 60 * 1000) }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.streams[0].stale).toBe(true);
  });

  it("reports null latest for a missing generation envelope without failing the snapshot", async () => {
    peekWarmedPipe.mockImplementation(async (pipe: string) => {
      if (pipe === "snapshots_range") {
        return [{ timestamp: tinybirdTimestamp(30 * 60 * 1000) }];
      }
      return null;
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.streams[1]).toMatchObject({ stream: "generation", latest: null, critical: false });
    expect(body.streams[2]).toMatchObject({ stream: "embedded", latest: null, critical: false });
    expect(body.streams[3]).toMatchObject({ stream: "prices", latest: null, critical: false });
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
