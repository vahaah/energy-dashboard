import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";
import Icon from "@/app/icon";
import { mixSegmentsFromSnapshot } from "@/lib/mix-favicon";
import { loadMixFaviconSegments } from "@/lib/mix-favicon-snapshot";
import type { EnergySnapshot } from "@/lib/types";

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("@/lib/mix-favicon-snapshot", () => ({
  loadMixFaviconSegments: vi.fn(),
}));

function snapshot(overrides: Partial<EnergySnapshot> = {}): EnergySnapshot {
  return {
    timestamp: "2026-10-25 20:30:00",
    carbon_intensity: 48,
    carbon_forecast: 48,
    carbon_index: "low",
    demand_mw: 30000,
    price_gbp_mwh: 70,
    price_mid_gbp_mwh: 68,
    gen_gas_pct: 16.6,
    gen_coal_pct: 0,
    gen_nuclear_pct: 16,
    gen_wind_pct: 57.1,
    gen_solar_pct: 0,
    gen_hydro_pct: 0,
    gen_biomass_pct: 4.1,
    gen_imports_pct: 6.2,
    gen_other_pct: 0,
    gen_gas_mw: 8000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 7000,
    gen_solar_mw: 0,
    gen_hydro_mw: 400,
    gen_biomass_mw: 600,
    gen_other_mw: 0,
    ...overrides,
  };
}

describe("live mix favicon route", () => {
  beforeEach(() => {
    vi.mocked(loadMixFaviconSegments).mockReset();
  });

  it("reads the cached homepage mix and does not add a Tinybird pipe", () => {
    const icon = readFileSync(resolve(process.cwd(), "src/app/icon.tsx"), "utf8");
    const loader = readFileSync(resolve(process.cwd(), "src/lib/mix-favicon-snapshot.ts"), "utf8");
    const warmer = readFileSync(resolve(process.cwd(), "src/lib/cache-warm.ts"), "utf8");

    expect(icon).toContain('dynamic = "force-dynamic"');
    expect(icon).toContain("revalidate = 300");
    expect(icon).toContain("connection(");
    expect(icon).toContain("loadMixFaviconSegments");
    expect(icon).not.toContain("queryPipe");

    expect(loader).toContain('dashboardPayloadCacheKey("day", null)');
    expect(loader).toContain("peekThroughCache");
    expect(loader).toContain("peekWarmedPipe<EnergySnapshot>");
    expect(loader).toContain('"snapshots_range"');
    expect(loader).toContain('range: "24h"');
    expect(loader).not.toContain("queryPipe");
    expect(loader).not.toContain("fetchPipeRows");
    expect(loader).not.toContain("loadDashboardPayload");
    expect(loader).not.toContain("loadHomepagePayload");
    expect(loader).not.toContain("latest_snapshot");
    expect(loader).not.toContain("latest_generation");
    expect(loader).not.toContain("latest_prices");

    expect(warmer).toContain('revalidatePath("/icon")');
  });

  it("returns an SVG donut with at least two fuel colours when the mix is cached", async () => {
    vi.mocked(loadMixFaviconSegments).mockResolvedValue(mixSegmentsFromSnapshot(snapshot()));

    const response = await Icon();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await response.text();
    expect(fuelFills(svg).size).toBeGreaterThanOrEqual(2);
    expect(svg).not.toContain("<text");
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("returns a neutral ring when no mix is cached", async () => {
    vi.mocked(loadMixFaviconSegments).mockResolvedValue([]);

    const response = await Icon();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await response.text();
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#737373"');
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg).not.toContain('fill="#9ca3af"');
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
  });

  it("keeps a static favicon and does not shadow the dynamic icon", () => {
    const root = process.cwd();
    expect(existsSync(resolve(root, "src/app/favicon.ico"))).toBe(true);
    const ico = readFileSync(resolve(root, "src/app/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3);

    for (const file of ["src/app/icon.svg", "src/app/icon.png", "public/favicon.ico"]) {
      expect(existsSync(resolve(root, file)), file).toBe(false);
    }
  });

  it("ships a manifest with 192 and 512 icons", () => {
    const body = manifest();
    expect(body.name).toBe("Grid");
    expect(body.short_name).toBe("Grid");
    expect(body.theme_color).toBe("#0a0a0a");
    expect(body.background_color).toBe("#ffffff");
    const icons = body.icons ?? [];
    expect(icons.map((icon) => ("sizes" in icon ? icon.sizes : null))).toEqual([
      "192x192",
      "512x512",
    ]);

    for (const [file, size] of [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
    ] as const) {
      const png = readFileSync(resolve(process.cwd(), file));
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it("keeps the 180 apple touch icon", () => {
    const png = readFileSync(resolve(process.cwd(), "src/app/apple-icon.png"));
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});

function fuelFills(svg: string): Set<string> {
  return new Set(
    [...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((match) => match[1].toLowerCase())
  );
}
