import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { peekOgCacheSnapshot } from "@/lib/og/peek";
import { resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";
import { storeWarmedRows } from "@/lib/warm-envelope";
import { LIVE_PIPES } from "@/lib/warm-pipes";

class MemoryRedis implements RedisCommands {
  readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return null;
    }
    return hit.value as T;
  }

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean }
  ): Promise<"OK" | null> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (opts?.ex ?? 60) * 1000,
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const next = Number((await this.get<number | string>(key)) ?? 0) + 1;
    await this.set(key, next, { ex: 86_400 });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return 0;
    }
    hit.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

describe("og cache peek", () => {
  afterEach(() => {
    resetRedisClient();
  });

  it("never imports Tinybird query or an uncached dashboard load", () => {
    const peek = readFileSync(resolve(import.meta.dirname, "./peek.ts"), "utf8");
    const response = readFileSync(resolve(import.meta.dirname, "./response.tsx"), "utf8");
    const image = readFileSync(resolve(import.meta.dirname, "./image.tsx"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/og/route.tsx"), "utf8");

    expect(peek).toContain("peekThroughCache");
    expect(peek).toContain("prices_range");
    expect(peek).not.toContain("latest_prices");
    expect(peek).not.toContain("queryPipe");
    expect(peek).not.toContain("loadDashboardPayloadUncached");
    expect(peek).not.toContain("fetchPipeRows");
    expect(response).toContain("peekOgCacheSnapshot");
    expect(response).toContain("ogCacheControl(variant)");
    expect(response).not.toContain("queryPipe");
    expect(route).toContain("renderOgImageResponse");
    expect(route).not.toContain("queryPipe");
    expect(image).toContain("OG_FOOTER");
    expect(image).not.toContain("slices.slice(0, 5)");
  });

  it("derives share-card facts from the 24h envelope when the composed payload is gone", async () => {
    setRedisForTests(new MemoryRedis());
    const now = new Date("2026-10-14T12:00:00.000Z");
    const stamp = "2026-10-14 10:30:00";
    const snapshots = LIVE_PIPES[0];
    await storeWarmedRows(
      snapshots,
      snapshots.params(now),
      [{ timestamp: stamp, demand_mw: 32_000 }],
      now
    );

    const peeked = await peekOgCacheSnapshot(now);

    expect(peeked.facts?.empty).toBe(false);
    expect(peeked.facts?.referenceTimestamp).toBe(stamp);
  });

  it("returns empty snapshot fields when Redis is absent instead of loading Tinybird", async () => {
    resetRedisClient();
    await expect(peekOgCacheSnapshot(new Date("2026-10-10T12:00:00.000Z"))).resolves.toEqual({
      facts: null,
      records: null,
      prices: null,
    });
  });
});
