import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_FROM = /from\s+["']([^"']+)["']/g;
const IMPORT_BARE = /import\s+["']([^"']+)["']/g;
const IMPORT_DYNAMIC = /import\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE = /require\(\s*["']([^"']+)["']\s*\)/g;

const LLM_PACKAGES = new Set([
  "ai",
  "openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "langchain",
  "@langchain/core",
  "@langchain/openai",
  "groq-sdk",
  "@google/generative-ai",
  "@ai-sdk/openai",
  "@ai-sdk/anthropic",
]);

const LLM_CALLS = /\b(generateText|generateObject|streamText|streamObject)\b/;

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? resolve(process.cwd(), "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) {
    return null;
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function moduleGraph(entry: string): { files: string[]; specifiers: string[] } {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || files.has(file)) {
      continue;
    }
    files.add(file);
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    const found = [IMPORT_FROM, IMPORT_BARE, IMPORT_DYNAMIC, REQUIRE].flatMap((pattern) =>
      [...source.matchAll(pattern)].map((match) => match[1] ?? ""),
    );
    for (const specifier of found) {
      specifiers.add(specifier);
      const next = resolveSpecifier(file, specifier);
      if (next) {
        pending.push(next);
      }
    }
  }
  return { files: [...files], specifiers: [...specifiers] };
}

function packageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return `${scope}/${name ?? ""}`;
  }
  return specifier.split("/")[0] ?? specifier;
}

describe("changes import graph", () => {
  it("does not import an LLM on the page or the API", () => {
    const entries = [
      resolve(process.cwd(), "src/app/changes/page.tsx"),
      resolve(process.cwd(), "src/app/api/v1/changes/route.ts"),
    ];
    for (const entry of entries) {
      const graph = moduleGraph(entry);
      const names = graph.specifiers.map(packageName);
      expect(names.filter((name) => LLM_PACKAGES.has(name) || name.startsWith("@ai-sdk/"))).toEqual([]);
      const joined = graph.files.map((file) => readFileSync(file, "utf8")).join("\n");
      expect(joined).not.toMatch(LLM_CALLS);
      expect(joined).not.toContain("queryPipe");
      expect(graph.files.some((file) => file.includes(`${join("lib", "whole-energy")}`))).toBe(false);
      expect(graph.files.some((file) => file.includes(`${join("lib", "constraints")}`))).toBe(false);
    }
    const route = readFileSync(resolve(process.cwd(), "src/app/api/v1/changes/route.ts"), "utf8");
    expect(route).toContain('export const dynamic = "force-dynamic"');
    expect(route).toContain("Tinybird impact +0");
  });
});
