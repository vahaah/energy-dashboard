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
