import type { ToolRelation, ToolSector, ToolTask } from "@/lib/tools/schema";

export const TOOLS_TITLE = "Energy tools and official services | Grid";
export const TOOLS_H1 = "Where do I go to do this?";
export const TOOLS_STANDFIRST =
  "Official and useful services, grouped by task. Grid links to them; it does not run them unless marked.";
export const TOOLS_RUNS_ON_GRID = "Runs on Grid";
export const TOOLS_REPORT_TITLE = "Report a broken link";
export const TOOLS_REPORT_BODY = "Email Grid, or open a GitHub issue. There is no form on this page.";

export function toolTaskLabel(task: ToolTask): string {
  switch (task) {
    case "understand_a_bill":
      return "Understand a bill";
    case "find_a_network_operator":
      return "Find a network operator";
    case "find_an_official_outage_service":
      return "Find an official outage service";
    case "investigate_a_connection":
      return "Investigate a connection";
    case "find_a_code":
      return "Find a code";
    case "access_a_dataset":
      return "Access a dataset";
    case "explore_planning_or_network_evidence":
      return "Explore planning or network evidence";
    default: {
      const exhaustive: never = task;
      return exhaustive;
    }
  }
}

export function toolSectorLabel(sector: ToolSector): string {
  switch (sector) {
    case "electricity":
      return "Electricity";
    case "gas":
      return "Gas";
    case "oil":
      return "Oil";
    case "heat":
      return "Heat";
    case "whole_energy":
      return "Whole energy";
    case "multi":
      return "Electricity and gas";
    default: {
      const exhaustive: never = sector;
      return exhaustive;
    }
  }
}

export function toolRelationMark(relation: ToolRelation): string | null {
  switch (relation) {
    case "integrates":
      return TOOLS_RUNS_ON_GRID;
    case "links_out":
      return null;
    default: {
      const exhaustive: never = relation;
      return exhaustive;
    }
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatVerifiedDay(day: string): string {
  const [year, month, date] = day.split("-");
  const monthIndex = Number(month) - 1;
  const label = MONTHS[monthIndex];
  if (!year || !label || !date) {
    return day;
  }
  return `${Number(date)} ${label} ${year}`;
}
