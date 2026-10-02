import { describe, expect, it } from "vitest";
import {
  healthHttpStatus,
  latestObservedTimestamp,
  STALE_AFTER_MS,
  streamFreshness,
  unprobedStream,
} from "@/lib/health";

describe("health freshness", () => {
  const now = new Date("2026-09-27T10:00:00.000Z");

  it("marks a critical stream stale after its threshold", () => {
    const fresh = streamFreshness(
      "snapshots",
      "2026-09-27 09:00:00",
      now,
      STALE_AFTER_MS.snapshots,
      true
    );
    const stale = streamFreshness(
      "snapshots",
      "2026-09-27 06:00:00",
      now,
      STALE_AFTER_MS.snapshots,
      true
    );

    expect(fresh.stale).toBe(false);
    expect(stale.stale).toBe(true);
    expect(healthHttpStatus([fresh])).toBe(200);
    expect(healthHttpStatus([stale])).toBe(503);
  });

  it("does not 503 for a stale non-critical prices stream", () => {
    const prices = streamFreshness("prices", "2026-09-20 00:00:00", now, STALE_AFTER_MS.prices, false);
    expect(prices.stale).toBe(true);
    expect(healthHttpStatus([prices])).toBe(200);
  });

  it("keeps hourly-ingested generation fresh for a full cron cycle plus margin", () => {
    const twentyMinutesOld = streamFreshness(
      "generation",
      "2026-09-27 09:40:00",
      now,
      STALE_AFTER_MS.generation,
      true
    );
    const oneHourOld = streamFreshness(
      "generation",
      "2026-09-27 09:00:00",
      now,
      STALE_AFTER_MS.generation,
      true
    );
    const pastMargin = streamFreshness(
      "generation",
      "2026-09-27 07:29:00",
      now,
      STALE_AFTER_MS.generation,
      true
    );

    expect(STALE_AFTER_MS.generation).toBe(STALE_AFTER_MS.snapshots);
    expect(twentyMinutesOld.stale).toBe(false);
    expect(oneHourOld.stale).toBe(false);
    expect(pastMargin.stale).toBe(true);
    expect(healthHttpStatus([twentyMinutesOld])).toBe(200);
    expect(healthHttpStatus([pastMargin])).toBe(503);
  });

  it("keeps unprobed streams non-critical so they never trip 503", () => {
    const snapshots = streamFreshness(
      "snapshots",
      "2026-09-27 09:00:00",
      now,
      STALE_AFTER_MS.snapshots,
      true
    );
    const generation = unprobedStream("generation", STALE_AFTER_MS.generation);
    const prices = unprobedStream("prices", STALE_AFTER_MS.prices);

    expect(generation).toMatchObject({
      stream: "generation",
      latest: null,
      stale: false,
      critical: false,
    });
    expect(healthHttpStatus([snapshots, generation, prices])).toBe(200);
  });

  it("ignores future timestamps so a NESO forecast cannot become latest", () => {
    const latest = latestObservedTimestamp(
      ["2026-09-27 09:30:00", "2026-09-27 22:30:00", "not-a-date"],
      now
    );

    expect(latest).toBe("2026-09-27 09:30:00");
  });
});
