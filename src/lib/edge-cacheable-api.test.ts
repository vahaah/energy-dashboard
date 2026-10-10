import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  API_CDN_VARY,
  EDGE_CACHEABLE_API_PATHS,
  withoutFlightHeaders,
} from "@/lib/edge-cacheable-api";

describe("edge-cacheable API Vary", () => {
  it("pins next.config headers to Accept-Encoding for every cacheable API", async () => {
    const headers = nextConfig.headers;
    expect(headers).toBeTypeOf("function");
    const rules = headers ? await headers() : [];
    expect(rules.map((rule) => rule.source)).toEqual([...EDGE_CACHEABLE_API_PATHS]);
    for (const rule of rules) {
      expect(rule.headers).toEqual([{ key: "Vary", value: API_CDN_VARY }]);
    }
  });

  it("overrides Vary on Vercel after Next.js appends flight headers", () => {
    const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
      routes: Array<{ src: string; headers: { Vary: string }; override: boolean; continue: boolean }>;
    };
    const route = vercel.routes[0];
    expect(route.override).toBe(true);
    expect(route.continue).toBe(true);
    expect(route.headers.Vary).toBe(API_CDN_VARY);
    for (const path of EDGE_CACHEABLE_API_PATHS) {
      expect(route.src).toContain(path.replace("/api/", ""));
    }
  });

  it("drops Next.js flight headers and keeps the rest", () => {
    const headers = withoutFlightHeaders(
      new Headers({
        rsc: "1",
        "next-router-state-tree": "tree",
        accept: "application/json",
      })
    );
    expect(headers.get("rsc")).toBeNull();
    expect(headers.get("next-router-state-tree")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
  });
});
