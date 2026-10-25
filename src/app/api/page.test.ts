import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  API_DOCS_CONVENTIONS,
  API_DOCS_ENDPOINTS,
  API_DOCS_ERRORS,
  API_DOCS_INTRO,
  API_DOCS_LICENCE,
} from "@/lib/api/copy";

describe("API docs page", () => {
  it("uses the specified copy and does not query Tinybird", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("apiDocsPageMetadata");
    expect(source).toContain("apiDocsJsonLd");
    expect(source).toContain("loadHomepagePayload");
    expect(source).toContain("API_DOCS_INTRO");
    expect(source).toContain("API_DOCS_LICENCE");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toMatch(/\bTTF\b/);
    expect(API_DOCS_INTRO).toBe(
      "Grid's API returns the figures shown on the dashboard as JSON. It is free, needs no account and allows 60 requests a minute per IP address. Data refreshes on the same schedule as the dashboard: hourly for electricity and physical gas, every 6 hours for oil and gas prices. Older endpoints keep working. New endpoints are under /api/v1.",
    );
    expect(API_DOCS_CONVENTIONS).toEqual([
      "Times are UTC, ISO 8601 (2026-10-14T09:30:00Z). Convert to London time (Europe/London) yourself.",
      "Every value carries its unit, interval, source, publication time and the time Grid fetched it.",
      "Missing data is null, never 0. A reported zero is 0.",
      "Forecasts carry forecast_issued_at. Revised values carry their revision.",
      "Results are paged with a cursor. Follow next_cursor until it is empty.",
      "An unsupported filter returns an error. It is never ignored.",
      "Scope is GB unless the endpoint says otherwise. Northern Ireland data is never mixed into GB results.",
    ]);
    expect(API_DOCS_ERRORS).toEqual([
      "404 Unknown ID.",
      "404 No results for these filters.",
      "400 This scope is not supported.",
      "503 The source is unavailable. The last published data is still returned where Grid holds it.",
    ]);
    expect(API_DOCS_LICENCE).toBe(
      "Data in API responses is subject to each source's licence, listed in sources on every response and on the Data sources page.",
    );
    expect(API_DOCS_ENDPOINTS.map((endpoint) => endpoint.summary)).toEqual([
      "Summary for one gas day, with freshness and coverage for each part.",
      "History of one gas metric between two times.",
      "The map layers, with source, edition, coverage and attribution for each.",
      "Projects matching the filters.",
      "Published constraint activity. Only the breakdowns the source publishes.",
      "Which organisation held a code on a given date.",
      "Look up a batch of codes. Limited in size; submitted codes are not logged by default.",
      "Changes found in published data, with evidence.",
      "When each source last published and when Grid last fetched it.",
    ]);
    expect(API_DOCS_ENDPOINTS.map((endpoint) => endpoint.path)).not.toContain("/api/v1/areas");
    expect(source).not.toContain("/api/v1/assets");
  });
});
