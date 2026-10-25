export { STRAIGHT_LINE_LABEL } from "@/lib/catalogue/links/schema";

export const FLOWS_TITLE = "Flows across GB borders";
export const FLOWS_STANDFIRST =
  "Electricity interconnectors and gas entry points, with the latest published readings.";
export const FLOWS_PANEL_LABEL = "Flow details";
export const FLOWS_PANEL_EMPTY = "Select a flow from the list.";

export const STATIONS_TITLE = "Power stations in Britain";
export const STATIONS_STANDFIRST =
  "Operating stations in England, Scotland and Wales, sized by rated power.";
export const STATIONS_PANEL_LABEL = "Station details";
export const STATIONS_PANEL_EMPTY = "Select a station on the map.";

export const GAS_FLOWS_UNAVAILABLE =
  "Per-terminal gas flows are not yet in Grid. National totals are on the Gas page.";

export const FEED_FAILED = "The flow readings did not load.";
export const MAP_FAILED = "The map did not load.";

export const FLOWS_FALLBACK_HREF = "/assets?preset=flows";

export const PROJECTS_LAYER_NOTE =
  "A project appears on the map once it has a published location.";

export function staleCopy(clock: string): string {
  return `Not updated · Latest electricity data is from ${clock}. Grid checks every hour.`;
}

/** Chromium names winter Greenwich time "GMT+0". Node names it "GMT". */
export function normaliseLondonZone(formatted: string): string {
  return formatted.replace(/GMT\+0+(?::00)?$/, "GMT");
}

export function londonClock(at: Date): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZoneName: "short",
  }).format(at);
  // The map clock is rendered on the server and again in the browser.
  return normaliseLondonZone(formatted);
}

export const FLOWS_KEYBOARD =
  "The list selects a flow. Enter opens it. Escape closes it and returns focus.";

export const FLOW_WIDTH_KEY = [
  { width: 2, electricity: "Under 500 MW", gas: "Under 20 mcm/d" },
  { width: 4, electricity: "500–1,000 MW", gas: "20–50 mcm/d" },
  { width: 6, electricity: "Over 1,000 MW", gas: "Over 50 mcm/d" },
] as const;
