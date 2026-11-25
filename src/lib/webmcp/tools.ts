import { createWebMcpHandlers, type WebMcpDeps, type WebMcpHandlers } from "@/lib/webmcp/handlers";

const EMPTY_INPUT = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const SEARCH_INPUT = {
  type: "object",
  properties: {
    query: {
      type: "string",
      maxLength: 80,
      description: "Pages, projects or assets. An empty string lists the main pages.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

export type GridTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true };
  execute: (input: unknown, options: { signal: AbortSignal }) => Promise<unknown>;
};

function bind(run: (input: unknown, signal: AbortSignal) => Promise<unknown> | unknown): GridTool["execute"] {
  return (input, options) => Promise.resolve(run(input, options.signal));
}

export function gridTools(deps: WebMcpDeps, registration?: AbortSignal): GridTool[] {
  const handlers: WebMcpHandlers = createWebMcpHandlers(deps, registration);
  return [
    {
      name: "get_live_mix",
      title: "Latest generation mix",
      description:
        "Latest GB electricity generation for the current half-hour: each fuel in MW and as a share of generation, plus demand. Uses the figures already on the page, or one latest dashboard peek. An absent fuel is null. Does not accept a historical date.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getLiveMix(input, signal)),
    },
    {
      name: "get_carbon_intensity",
      title: "Carbon intensity",
      description:
        "National carbon intensity for the latest half-hour, in gCO₂/kWh, and the cleanest two-hour window when that derived figure is available. The raw 48-hour forecast series is not returned. Does not accept a historical date.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getCarbonIntensity(input, signal)),
    },
    {
      name: "get_wholesale_price",
      title: "Wholesale electricity price",
      description:
        "The GB Market Index price (APXMIDP), in £/MWh, and the imbalance (system) price when it is present. These are different series. Does not accept a historical date.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getWholesalePrice(input, signal)),
    },
    {
      name: "get_price_cap",
      title: "Energy price cap",
      description:
        "The Ofgem energy price cap in force for a typical dual-fuel Direct Debit household, and the published cap for 1 January to 31 March 2027. Does not accept a historical date.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input) => handlers.getPriceCap(input)),
    },
    {
      name: "search_grid",
      title: "Search Grid",
      description:
        "Search Grid's pages, planning projects and operating assets with the same ranking as the header search. An empty query lists the main pages. This is not an MPAN, MPRN or meter lookup.",
      inputSchema: SEARCH_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.searchGrid(input, signal)),
    },
    {
      name: "get_page_dataset",
      title: "This page's dataset",
      description:
        "Title, URL, citation, sources and the figures this page is already showing. It does not request another day.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getPageDataset(input, signal)),
    },
    {
      name: "get_balancing_summary",
      title: "Balancing summary",
      description:
        "Latest NESO balancing cost, the BSUoS tariff and the per-household estimate. The trade estimate is separate and is not included.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getBalancingSummary(input, signal)),
    },
    {
      name: "get_data_health",
      title: "Data health",
      description:
        "Which GB electricity and gas streams are fresh or stale, with each publication time and the time Grid fetched it.",
      inputSchema: EMPTY_INPUT,
      annotations: { readOnlyHint: true },
      execute: bind((input, signal) => handlers.getDataHealth(input, signal)),
    },
  ];
}
