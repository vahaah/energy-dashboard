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

function moduleGraph(entry: string): string[] {
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
    const source = readFileSync(file, "utf8");
    const specifiers = [IMPORT_FROM, IMPORT_BARE, IMPORT_DYNAMIC].flatMap((pattern) =>
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
    expect(joined).not.toMatch(/["']pmtiles["']/);
  });
});
