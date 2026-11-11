import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_FROM = /from\s+["']([^"']+)["']/g;
const IMPORT_BARE = /import\s+["']([^"']+)["']/g;
const IMPORT_DYNAMIC = /import\(\s*["']([^"']+)["']\s*\)/g;

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier === "maplibre-gl" || specifier === "pmtiles" || specifier.startsWith("maplibre-gl/") || specifier.startsWith("pmtiles/")) {
    return specifier;
  }
  const base = specifier.startsWith("@/")
    ? resolve(process.cwd(), "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) {
    return null;
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function moduleGraph(entry: string, includeDynamic = true): string[] {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (!file.endsWith(".ts") && !file.endsWith(".tsx") && !file.endsWith(".js")) {
      continue;
    }
    const raw = readFileSync(file, "utf8");
    const source = includeDynamic ? raw : raw.replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "");
    const patterns = includeDynamic ? [IMPORT_FROM, IMPORT_BARE, IMPORT_DYNAMIC] : [IMPORT_FROM, IMPORT_BARE];
    const specifiers = patterns.flatMap((pattern) =>
      [...source.matchAll(pattern)].map((match) => match[1] ?? ""),
    );
    for (const specifier of specifiers) {
      const next = resolveSpecifier(file, specifier);
      if (next) {
        pending.push(next);
      }
    }
  }
  return [...seen];
}

describe("homepage module graph", () => {
  it("does not import maplibre-gl or pmtiles", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 300");
    const files = [
      ...moduleGraph(resolve(process.cwd(), "src/app/page.tsx")),
      ...moduleGraph(resolve(process.cwd(), "src/app/layout.tsx")),
    ];
    expect(files.some((file) => file === "maplibre-gl" || file === "pmtiles" || file.startsWith("maplibre-gl/") || file.startsWith("pmtiles/"))).toBe(false);
    const joined = files.map((file) => (file.endsWith(".ts") || file.endsWith(".tsx") ? readFileSync(file, "utf8") : "")).join("\n");
    expect(joined).not.toMatch(/["']maplibre-gl["']/);
    expect(joined).not.toMatch(/maplibre-gl\.css/);
    expect(joined).not.toMatch(/maplibre\.css/);
    expect(joined).not.toMatch(/["']pmtiles["']/);
    expect(files.some((file) => file.endsWith("static-map.ts") || file.endsWith("today-card-build.ts"))).toBe(false);
    expect(files.some((file) => file.includes(`${join("ingest", "national-gas")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "gas")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "constraints")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "balancing", "fetch.ts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "balancing", "load.ts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "balancing", "blob.ts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "whole-energy")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "projects")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "eirgrid", "reader.ts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "eirgrid", "pipeline.ts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "postcode")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("lib", "power-cuts")}`))).toBe(false);
    expect(files.some((file) => file.includes(`${join("components", "power-cuts")}`))).toBe(false);
    expect(joined).not.toContain("releases/eirgrid-ni");
    expect(joined).not.toContain("releases/neso-constraints");
    expect(joined).not.toContain("blob.vercel-storage");
    expect(joined).not.toContain("/api/v1/gas");
    expect(joined).not.toContain("releases/gas/");
    expect(joined).not.toContain("/tiles/");
  });

  it("keeps MapLibre off the static graph of /map so a homepage prefetch cannot pull it", () => {
    const entry = resolve(process.cwd(), "src/app/map/page.tsx");
    const page = readFileSync(entry, "utf8");
    expect(page).not.toMatch(/maplibre/);
    const files = moduleGraph(entry, false);
    const joined = files.map((file) => (file.endsWith(".ts") || file.endsWith(".tsx") ? readFileSync(file, "utf8") : "")).join("\n");
    expect(files.some((file) => file === "maplibre-gl" || file.endsWith("maplibre.css") || file.includes("maplibre-gl"))).toBe(false);
    expect(joined).not.toMatch(/import\s+["'][^"']*maplibre/);
    expect(joined).not.toMatch(/from\s+["']maplibre-gl["']/);
    expect(joined).not.toMatch(/from\s+["']pmtiles["']/);
  });

  it("keeps MapLibre off the static graph of /power-cuts", () => {
    const entry = resolve(process.cwd(), "src/app/power-cuts/page.tsx");
    const files = moduleGraph(entry, false);
    expect(files.some((file) => file === "maplibre-gl" || file.includes("maplibre-gl") || file.endsWith("map-browser.ts"))).toBe(false);
    const joined = files.map((file) => (file.endsWith(".ts") || file.endsWith(".tsx") ? readFileSync(file, "utf8") : "")).join("\n");
    expect(joined).not.toMatch(/from\s+["']maplibre-gl["']/);
    expect(joined).not.toMatch(/from\s+["']pmtiles["']/);
  });

  it("does not import maplibre-gl or pmtiles from an asset page", () => {
    for (const entry of ["src/app/assets/[id]/page.tsx", "src/app/assets/[id]/[slug]/page.tsx"]) {
      const files = moduleGraph(resolve(process.cwd(), entry));
      expect(files.some((file) => file === "maplibre-gl" || file === "pmtiles" || file.startsWith("maplibre-gl/") || file.startsWith("pmtiles/"))).toBe(false);
      const joined = files.map((file) => (file.endsWith(".ts") || file.endsWith(".tsx") ? readFileSync(file, "utf8") : "")).join("\n");
      expect(joined).not.toMatch(/from ["']maplibre-gl["']/);
      expect(joined).not.toMatch(/from ["']pmtiles["']/);
      expect(joined).not.toMatch(/import\(\s*["']maplibre-gl["']/);
      expect(joined).not.toMatch(/import\(\s*["']pmtiles["']/);
    }
  });
});
