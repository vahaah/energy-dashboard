import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/warm-envelope", () => ({
  peekWarmedPipe: vi.fn(),
}));

vi.mock("@/lib/dashboard-data", () => ({
  getInterconnectorQueryParams: vi.fn(() => ({ start: "2026-10-14T23:00:00Z", end: "2026-10-15T23:00:00Z" })),
}));

import { peekCachedInterconnectorFlows, resetCachedInterconnectorFlows } from "@/lib/assets/cached-flows";
import { peekWarmedPipe } from "@/lib/warm-envelope";

describe("warmed interconnector flow peek", () => {
  beforeEach(() => {
    resetCachedInterconnectorFlows();
    vi.mocked(peekWarmedPipe).mockReset();
  });

  it("shares one peek until it settles, then peeks again", async () => {
    let resolvePeek: (rows: []) => void = () => undefined;
    const first = new Promise<[]>((resolve) => {
      resolvePeek = resolve;
    });
    vi.mocked(peekWarmedPipe).mockReturnValueOnce(first);
    const pending = peekCachedInterconnectorFlows();
    expect(peekCachedInterconnectorFlows()).toBe(pending);
    expect(peekWarmedPipe).toHaveBeenCalledTimes(1);
    resolvePeek([]);
    await pending;
    vi.mocked(peekWarmedPipe).mockResolvedValueOnce([]);
    await peekCachedInterconnectorFlows();
    expect(peekWarmedPipe).toHaveBeenCalledTimes(2);
  });

  it("clears the peek after a failure so the next read tries again", async () => {
    vi.mocked(peekWarmedPipe).mockRejectedValueOnce(new Error("redis down"));
    await expect(peekCachedInterconnectorFlows()).resolves.toBeNull();
    vi.mocked(peekWarmedPipe).mockResolvedValueOnce([]);
    await expect(peekCachedInterconnectorFlows()).resolves.toEqual([]);
    expect(peekWarmedPipe).toHaveBeenCalledTimes(2);
  });
});
