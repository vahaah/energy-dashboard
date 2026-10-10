import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const loadDashboardPayloadResult = vi.fn();

vi.mock("@/lib/dashboard-payload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dashboard-payload")>(
    "@/lib/dashboard-payload"
  );
  return {
    ...actual,
    loadDashboardPayloadResult: (...args: unknown[]) => loadDashboardPayloadResult(...args),
  };
});

import { GET } from "./route";

describe("/api/dashboard", () => {
  beforeEach(() => {
    loadDashboardPayloadResult.mockReset();
    loadDashboardPayloadResult.mockResolvedValue({
      data: {
        period: "day",
        snapshots: [],
        prices: [],
      },
      status: "miss",
    });
  });

  it("returns assembled payload with CDN cache headers", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=day"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=1800");
    expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    expect(response.headers.get("x-grid-cache")).toBe("miss");
    expect(loadDashboardPayloadResult).toHaveBeenCalledWith(
      expect.objectContaining({ period: "day" })
    );
    expect(loadDashboardPayloadResult).toHaveBeenCalledWith(
      expect.not.objectContaining({ commodityRange: expect.anything() })
    );
  });

  it("logs a fallback reason even when Redis did not throw a visible error", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    loadDashboardPayloadResult.mockResolvedValue({
      data: {
        period: "week",
        snapshots: [],
        prices: [],
      },
      status: "fallback",
    });

    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=week"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-grid-cache")).toBe("fallback");
    expect(info.mock.calls.some((call) => String(call[0]).includes("reason="))).toBe(true);
    info.mockRestore();
  });

  it("rejects an unknown period", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=decade"));
    expect(response.status).toBe(400);
    expect(loadDashboardPayloadResult).not.toHaveBeenCalled();
  });
});
