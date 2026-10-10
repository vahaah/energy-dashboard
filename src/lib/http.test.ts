import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("http fetch helper", () => {
  it("stays client-safe and does not import Redis or next/server", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./http.ts"), "utf8");
    expect(source).not.toContain("redis-cache");
    expect(source).not.toContain("next/server");
    expect(source).not.toContain("readThroughCache");
    expect(source).toContain("export async function fetchJson");
  });
});
