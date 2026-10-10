import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const loadDashboardPayload = vi.fn();

vi.mock("@/lib/dashboard-payload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dashboard-payload")>(
    "@/lib/dashboard-payload"
  );
  return {
    ...actual,
    loadDashboardPayload: (...args: unknown[]) => loadDashboardPayload(...args),
  };
});

import { GET } from "./route";

describe("/api/dashboard", () => {
  beforeEach(() => {
    loadDashboardPayload.mockReset();
    loadDashboardPayload.mockResolvedValue({
      period: "day",
      snapshots: [],
      prices: [],
    });
  });

  it("returns assembled payload with CDN cache headers", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=day"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate");
    expect(loadDashboardPayload).toHaveBeenCalledWith(
      expect.objectContaining({ period: "day", commodityRange: "90d" })
    );
  });

  it("rejects an unknown period", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=decade"));
    expect(response.status).toBe(400);
    expect(loadDashboardPayload).not.toHaveBeenCalled();
  });
});
