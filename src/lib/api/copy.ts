/**
 * API docs copy. Sentences are the specified text.
 * Electricity ingest in vercel.json runs every 30 minutes, not hourly.
 * The intro keeps the specified sentence. See the pull request.
 */

export const API_DOCS_STANDFIRST =
  "Access Grid's GB electricity and gas data as JSON, no API key.";

export const API_DOCS_INTRO =
  `${API_DOCS_STANDFIRST} Grid's API returns the figures shown on the dashboard as JSON. It is free, needs no account and allows 60 requests a minute per IP address. Data refreshes on the same schedule as the dashboard: hourly for electricity and physical gas, every 6 hours for oil and gas prices. Older endpoints keep working. New endpoints are under /api/v1.`;

export const API_DOCS_CONVENTIONS = [
  "Times are UTC, ISO 8601 (2026-10-14T09:30:00Z). Convert to London time (Europe/London) yourself.",
  "Every value carries its unit, interval, source, publication time and the time Grid fetched it.",
  "Missing data is null, never 0. A reported zero is 0.",
  "Forecasts carry forecast_issued_at. Revised values carry their revision.",
  "Results are paged with a cursor. Follow next_cursor until it is empty.",
  "An unsupported filter returns an error. It is never ignored.",
  "Scope is GB unless the endpoint says otherwise. Northern Ireland data is never mixed into GB results.",
] as const;

export const API_DOCS_RATE_LIMIT = "The limit is 60 requests a minute.";

export const API_DOCS_ERRORS = [
  "404 Unknown ID.",
  "404 No results for these filters.",
  "400 This scope is not supported.",
  "503 The source is unavailable. The last published data is still returned where Grid holds it.",
] as const;

export const API_DOCS_LICENCE =
  "Data in API responses is subject to each source's licence, listed in sources on every response and on the Data sources page.";

export const API_DOCS_WEBMCP_HEADING = "WebMCP";

export const API_DOCS_WEBMCP = [
  "In a browser that provides document.modelContext.registerTool, Grid registers read-only tools for the figures on the page. A browser without that API does not download the tools.",
  "The tools are get_live_mix, get_carbon_intensity, get_wholesale_price, get_price_cap, search_grid, get_page_dataset, get_balancing_summary and get_data_health. Each is marked read-only and returns the source, the unit and the time.",
  "They read what the page already holds, static JSON, or the existing peek routes. They do not send a historical date, and they do not look up an MPAN, MPRN or meter serial.",
  "Grid does not register tools that press buttons. The current draft is document.modelContext (https://webmachinelearning.github.io/webmcp/). A Chrome origin-trial token is not set.",
] as const;

export type ApiDocsEndpoint = {
  method: "GET" | "POST";
  path: string;
  note: string;
  summary: string;
};

export const API_DOCS_ENDPOINTS: readonly ApiDocsEndpoint[] = [
  {
    method: "GET",
    path: "/api/v1/gas/overview",
    note: "Query: gas_day, optional. A missing value reads the latest release.",
    summary: "Summary for one gas day, with freshness and coverage for each part.",
  },
  {
    method: "GET",
    path: "/api/v1/gas/series",
    note: "Query: metric, from, to. All three are required. An unknown metric is rejected.",
    summary: "History of one gas metric between two times.",
  },
  {
    method: "GET",
    path: "/api/v1/map/layers",
    note: "No query parameters.",
    summary: "The map layers, with source, edition, coverage and attribution for each.",
  },
  {
    method: "GET",
    path: "/api/v1/projects",
    note: "Query: display_stage, limit, offset. limit defaults to 100 and cannot exceed 500. offset defaults to 0.",
    summary: "Projects matching the filters.",
  },
  {
    method: "GET",
    path: "/api/v1/constraints",
    note: "Query: from, to, boundary. from and to are required inclusive settlement dates. boundary is optional.",
    summary: "Published constraint activity. Only the breakdowns the source publishes.",
  },
  {
    method: "GET",
    path: "/api/v1/identifiers",
    note: "Query: scheme, code, effective_on. Or search by name (2 to 80 characters).",
    summary: "Which organisation held a code on a given date.",
  },
  {
    method: "POST",
    path: "/api/v1/identifiers/resolve",
    note: "JSON body: effective_on and queries, each with scheme and code. At most 20 codes.",
    summary: "Look up a batch of codes. Limited in size; submitted codes are not logged by default.",
  },
  {
    method: "GET",
    path: "/api/v1/changes",
    note: "Query: entity_id, cursor. Follow next_cursor until it is empty. Only scope=GB is supported.",
    summary: "Changes found in published data, with evidence.",
  },
  {
    method: "GET",
    path: "/api/v1/data-health",
    note: "No required parameters. Readings are GB electricity and GB gas. Northern Ireland and other geographies are left out.",
    summary: "When each source last published and when Grid last fetched it.",
  },
];
