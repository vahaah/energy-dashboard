import { afterEach, describe, expect, it } from "vitest";
import {
  TINYBIRD_CACHE_SECONDS,
  TINYBIRD_LIMIT_RETRY_AFTER_SECONDS,
  TinybirdLimitError,
  clearTinybirdLastGood,
  getTinybirdCachePolicy,
  getTinybirdLastGood,
  isTinybirdLimitError,
  resolveTinybirdPipeFailure,
  serializePipeParams,
  setTinybirdLastGood,
  tinybirdCacheControl,
  tinybirdLogicalCacheKey,
} from "@/lib/tinybird-cache";

const now = new Date("2026-10-02T12:00:00.000Z");

describe("getTinybirdCachePolicy", () => {
  it("treats latest_* pipes as live 5-minute data", () => {
    for (const pipeName of ["latest_snapshot", "latest_generation", "latest_prices"]) {
      expect(getTinybirdCachePolicy({ pipeName, now })).toMatchObject({
        tier: "live",
        revalidateSeconds: TINYBIRD_CACHE_SECONDS.live,
        sMaxAge: TINYBIRD_CACHE_SECONDS.live,
      });
    }
  });

  it("uses live cache for rolling 24h and 7d windows", () => {
    expect(
      getTinybirdCachePolicy({
        pipeName: "snapshots_range",
        range: "24h",
        now,
        params: { start: "2026-10-01 12:00:00", end: "2026-10-02 12:00:00" },
      }).tier
    ).toBe("live");
    expect(
      getTinybirdCachePolicy({
        pipeName: "generation_5min_range",
        range: "7d",
        now,
        params: {
          start: "2026-09-25 12:00:00",
          end: "2026-10-02 12:00:00",
          granularity: "hour",
        },
      }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.live);
  });

  it("uses live cache when today's date is selected", () => {
    expect(
      getTinybirdCachePolicy({
        pipeName: "snapshots_range",
        range: "24h",
        date: "2026-10-02",
        now,
      }).tier
    ).toBe("live");
  });

  it("treats a past settlement date as immutable historical data", () => {
    const policy = getTinybirdCachePolicy({
      pipeName: "snapshots_range",
      range: "24h",
      date: "2026-05-19",
      now,
    });

    expect(policy).toMatchObject({
      tier: "historical",
      revalidateSeconds: TINYBIRD_CACHE_SECONDS.historical,
      sMaxAge: TINYBIRD_CACHE_SECONDS.historical,
      staleWhileRevalidate: 604_800,
    });
  });

  it("infers historical from a completed UK calendar-day window", () => {
    expect(
      getTinybirdCachePolicy({
        pipeName: "generation_5min_range",
        now,
        params: { start: "2026-05-18 23:00:00", end: "2026-05-19 22:59:59" },
      }).tier
    ).toBe("historical");
    expect(
      getTinybirdCachePolicy({
        pipeName: "snapshots_range",
        now,
        params: { start: "2026-03-10 00:00:00", end: "2026-03-10 23:59:59" },
      }).tier
    ).toBe("historical");
  });

  it("caches 30d for 30 minutes and 90d/1y for 60 minutes", () => {
    expect(
      getTinybirdCachePolicy({ pipeName: "snapshots_range", range: "30d", now }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.long);
    expect(
      getTinybirdCachePolicy({ pipeName: "prices_range", range: "90d", now }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.longYear);
    expect(
      getTinybirdCachePolicy({ pipeName: "prices_range", range: "1y", now }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.longYear);
  });

  it("infers long-range cache from daily granularity or date-only price windows", () => {
    expect(
      getTinybirdCachePolicy({
        pipeName: "snapshots_range",
        now,
        params: {
          start: "2026-09-02 12:00:00",
          end: "2026-10-02 12:00:00",
          granularity: "day",
        },
      }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.long);
    expect(
      getTinybirdCachePolicy({
        pipeName: "prices_range",
        now,
        params: { start: "2026-07-04", end: "2026-10-02" },
      }).revalidateSeconds
    ).toBe(TINYBIRD_CACHE_SECONDS.longYear);
  });

  it("does not treat a leftover historical date as immutable when the window is 30d", () => {
    expect(
      getTinybirdCachePolicy({
        pipeName: "snapshots_range",
        range: "30d",
        date: "2026-05-19",
        now,
      }).tier
    ).toBe("long");
  });
});

describe("tinybird cache helpers", () => {
  it("emits CDN Cache-Control matching the chosen tier", () => {
    const historical = getTinybirdCachePolicy({
      pipeName: "snapshots_range",
      range: "24h",
      date: "2026-05-19",
      now,
    });
    const live = getTinybirdCachePolicy({ pipeName: "latest_snapshot", now });

    expect(tinybirdCacheControl(historical)).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(tinybirdCacheControl(live)).toBe(
      "public, s-maxage=300, stale-while-revalidate=3600"
    );
  });

  it("keeps live cache keys stable across second-precision start/end changes", () => {
    const first = tinybirdLogicalCacheKey({
      pipeName: "snapshots_range",
      range: "24h",
      revalidateSeconds: 300,
      params: { start: "2026-10-01 12:00:00", end: "2026-10-02 12:00:00" },
    });
    const second = tinybirdLogicalCacheKey({
      pipeName: "snapshots_range",
      range: "24h",
      revalidateSeconds: 300,
      params: { start: "2026-10-01 12:00:07", end: "2026-10-02 12:00:07" },
    });

    expect(first).toBe(second);
    expect(first).toContain("ttl=300");
  });

  it("separates price commodity filters in the logical key", () => {
    expect(
      tinybirdLogicalCacheKey({
        pipeName: "prices_range",
        range: "30d",
        revalidateSeconds: 1800,
        params: { start: "2026-09-02", end: "2026-10-02", commodity: "brent_crude" },
      })
    ).toContain("commodity=brent_crude");
  });

  it("serializes params stably regardless of key insertion order", () => {
    expect(serializePipeParams({ end: "b", start: "a" })).toBe("end=b&start=a");
    expect(serializePipeParams({ start: "a", end: "b" })).toBe("end=b&start=a");
  });
});

describe("Tinybird limit-error handling", () => {
  afterEach(() => {
    clearTinybirdLastGood();
  });

  it("detects 429 and daily-limit bodies as limit errors", () => {
    expect(isTinybirdLimitError(429, "rate limited")).toBe(true);
    expect(
      isTinybirdLimitError(
        403,
        "Organization daily request limit exceeded (1000 requests/day)"
      )
    ).toBe(true);
    expect(isTinybirdLimitError(502, "upstream blew up")).toBe(false);
  });

  it("serves last-good rows when Tinybird is over its daily limit", () => {
    const lastGood = [{ timestamp: "2026-05-19 00:00:00" }];
    setTinybirdLastGood("snapshots", lastGood);

    expect(
      resolveTinybirdPipeFailure(
        429,
        "Organization daily request limit exceeded (1000 requests/day)",
        getTinybirdLastGood("snapshots")
      )
    ).toEqual(lastGood);
  });

  it("throws TinybirdLimitError with Retry-After when no last-good cache exists", () => {
    expect(() =>
      resolveTinybirdPipeFailure(429, "Organization daily request limit exceeded", undefined)
    ).toThrow(TinybirdLimitError);

    try {
      resolveTinybirdPipeFailure(429, "Organization daily request limit exceeded", undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(TinybirdLimitError);
      if (error instanceof TinybirdLimitError) {
        expect(error.retryAfterSeconds).toBe(TINYBIRD_LIMIT_RETRY_AFTER_SECONDS);
      }
    }
  });

  it("still throws a normal error for non-limit upstream failures", () => {
    expect(() => resolveTinybirdPipeFailure(502, "connection reset", [{ ok: true }])).toThrow(
      /Tinybird query error \(502\)/
    );
    expect(() => resolveTinybirdPipeFailure(502, "connection reset", [{ ok: true }])).not.toThrow(
      TinybirdLimitError
    );
  });
});
