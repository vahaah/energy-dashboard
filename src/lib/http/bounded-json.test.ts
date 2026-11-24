import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoundedJson } from "@/lib/http/bounded-json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchBoundedJson", () => {
  it("retries a 500 and then returns the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBoundedJson("/rows")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("no", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBoundedJson("/rows")).rejects.toThrow("HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
