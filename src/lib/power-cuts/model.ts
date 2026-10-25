import { displayedPercents, largestRemainder } from "@/lib/display-rounding";
import { formatGrouped } from "@/lib/format/quantity";
import { formatLondon } from "@/lib/london-time";
import { normalizePostcode } from "@/lib/postcode/parse";
import { parsePostcodeSector } from "@/lib/postcode/sector";
import { areaName } from "@/lib/power-cuts/areas";
import {
  ALL_FEEDS_FAILED,
  NO_POWER_CUTS,
  operatorName,
  POWER_CUT_CREDITS,
  publicOperatorError,
} from "@/lib/power-cuts/copy";
import {
  AREAS,
  NATIONS,
  OPERATORS,
  type Area,
  type Nation,
  type Operator,
  type PowerCut,
  type PowerCutsSnapshot,
  type SourceReport,
} from "@/lib/power-cuts/schema";

export const POWER_CUTS_PAGE_SIZE = 50;
export const POWER_CUTS_FRESH_MS = 30 * 60 * 1000;

export type PowerCutsFreshness = "current" | "stale" | "partial" | "missing";

export type AreaTableRow = {
  row: "area" | "nation" | "uk";
  area: Area | null;
  nation: Nation | null;
  operator: Operator | null;
  label: string;
  incidents: number;
  customers: number | null;
  /** Largest-remainder customer count. Grouping happens in the view. */
  customersShown: number | null;
  unplanned: number;
  planned: number;
};

export type ListedIncident = PowerCut & {
  operatorLabel: string;
  areaLabel: string;
  startedLabel: string;
  restorationLabel: string;
};

export type PowerCutsPageModel = {
  answer: string;
  coverage: string;
  freshness: PowerCutsFreshness;
  asOf: string | null;
  freshnessDetail: string | null;
  snapshotAge: string | null;
  incidents: number;
  customersOff: number | null;
  customersPartial: boolean;
  unplanned: number;
  planned: number;
  unplannedPercent: number;
  plannedPercent: number;
  operatorsReporting: number;
  operatorTotal: number;
  rows: AreaTableRow[];
  list: ListedIncident[];
  notices: Array<{ operator: Operator; name: string; status: SourceReport["status"]; error: string }>;
  allFailed: boolean;
  empty: boolean;
};

const COVERAGE: Record<Operator, string> = {
  ukpn: "UK Power Networks (East of England, London and the South East)",
  npg: "Northern Powergrid (North East and Yorkshire)",
  nged: "National Grid Electricity Distribution (East Midlands, West Midlands, the South West and South Wales)",
  enw: "Electricity North West (north-west England)",
  spen: "SP Energy Networks (central and southern Scotland, and north Wales)",
  ssen: "Scottish and Southern Electricity Networks (north of Scotland and southern England)",
  nie: "Northern Ireland Electricity",
};

function included(report: SourceReport): boolean {
  return report.status === "ok" || report.status === "stale";
}

function liveIncidents(snapshot: PowerCutsSnapshot): PowerCut[] {
  return snapshot.incidents.filter((incident) => incident.status === "active");
}

export function startedLabel(startedAt: string, now: Date): string {
  const elapsed = now.getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) {
    return "started just now";
  }
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `started ${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `started ${hours} h ago`;
  }
  return `started ${Math.floor(hours / 24)} d ago`;
}

export function restorationLabel(value: string | null): string {
  if (!value) {
    return "Estimated restoration is not published";
  }
  return `Estimated restoration ${formatLondon(new Date(value))}`;
}

function customersOf(incidents: readonly PowerCut[]): { total: number | null; partial: boolean } {
  const published = incidents.map((incident) => incident.customersOff).filter((value): value is number => value != null);
  return {
    total: published.length === 0 ? null : published.reduce((sum, value) => sum + value, 0),
    partial: incidents.some((incident) => incident.customersOff == null),
  };
}

export function answerSentence(input: {
  incidents: number;
  customersOff: number | null;
  customersPartial: boolean;
  unplanned: number;
  planned: number;
  reporting: boolean;
  allFailed: boolean;
}): string {
  if (input.allFailed) {
    return ALL_FEEDS_FAILED;
  }
  if (!input.reporting || input.incidents === 0) {
    return NO_POWER_CUTS;
  }
  const cuts = input.incidents === 1 ? "1 power cut is" : `${formatGrouped(input.incidents, 0)} power cuts are`;
  const customers =
    input.customersOff == null
      ? "customer counts are not published"
      : `${formatGrouped(input.customersOff, 0)} ${input.customersOff === 1 ? "customer" : "customers"} off supply${input.customersPartial ? ", where a count is published" : ""}`;
  return `${cuts} live in the areas reporting, ${customers}. ${formatGrouped(input.unplanned, 0)} unplanned, ${formatGrouped(input.planned, 0)} planned.`;
}

export function coverageSentence(snapshot: PowerCutsSnapshot): string {
  const reporting = OPERATORS.filter((operator) => included(snapshot.sources[operator])).map((operator) => COVERAGE[operator]);
  const absent = OPERATORS.filter((operator) => snapshot.sources[operator].status === "absent").map((operator) => operatorName(operator));
  const unlicensed = OPERATORS.filter((operator) => snapshot.sources[operator].status === "unlicensed").map((operator) => operatorName(operator));
  const parts: string[] = [];
  parts.push(
    reporting.length === 0
      ? "No operator is reporting in this snapshot."
      : `Reporting now: ${reporting.join(", ")}.`,
  );
  if (absent.length > 0) {
    parts.push(`${absent.join(" and ")} ${absent.length === 1 ? "is" : "are"} not configured or could not be read.`);
  }
  if (unlicensed.length > 0) {
    parts.push(`${unlicensed.join(" and ")} ${unlicensed.length === 1 ? "is" : "are"} not licensed for this page.`);
  }
  parts.push("This is not a complete UK picture while any operator is missing.");
  return parts.join(" ");
}

function oldestIncluded(snapshot: PowerCutsSnapshot): Date | null {
  const times = OPERATORS.flatMap((operator) => {
    const report = snapshot.sources[operator];
    return included(report) && report.fetchedAt ? [new Date(report.fetchedAt).getTime()] : [];
  }).filter((time) => Number.isFinite(time));
  if (times.length === 0) {
    return null;
  }
  return new Date(Math.min(...times));
}

export function freshnessOf(snapshot: PowerCutsSnapshot, now: Date): {
  state: PowerCutsFreshness;
  asOf: string | null;
  detail: string | null;
} {
  const reports = OPERATORS.map((operator) => snapshot.sources[operator]);
  const anyIncluded = reports.some(included);
  if (!anyIncluded) {
    return { state: "missing", asOf: null, detail: null };
  }
  const oldest = oldestIncluded(snapshot);
  const aged = oldest != null && now.getTime() - oldest.getTime() > POWER_CUTS_FRESH_MS;
  const staleSource = reports.some((report) => report.status === "stale");
  const licensedAbsent = OPERATORS.filter((operator) => {
    const report = snapshot.sources[operator];
    return report.status === "absent";
  });
  const detailParts = licensedAbsent.map((operator) => {
    const error = publicOperatorError(snapshot.sources[operator].error);
    return error ? `${operatorName(operator)}: ${error}` : operatorName(operator);
  });
  if (staleSource || aged) {
    return {
      state: "stale",
      asOf: oldest ? formatLondon(oldest) : null,
      detail: detailParts.length > 0 ? detailParts.join(". ") : null,
    };
  }
  if (licensedAbsent.length > 0) {
    return {
      state: "partial",
      asOf: oldest ? formatLondon(oldest) : null,
      detail: detailParts.join(". "),
    };
  }
  return { state: "current", asOf: oldest ? formatLondon(oldest) : null, detail: null };
}

function areaKey(incident: PowerCut): string {
  return `${incident.operator}|${incident.area}|${incident.nation}`;
}

export function areaTable(incidents: readonly PowerCut[]): AreaTableRow[] {
  const groups = new Map<string, PowerCut[]>();
  for (const incident of incidents) {
    const key = areaKey(incident);
    const list = groups.get(key);
    if (list) {
      list.push(incident);
    } else {
      groups.set(key, [incident]);
    }
  }
  const keys = [...groups.keys()].sort((left, right) => {
    const [leftOperator, leftArea, leftNation] = left.split("|") as [Operator, Area, Nation];
    const [rightOperator, rightArea, rightNation] = right.split("|") as [Operator, Area, Nation];
    const nation = NATIONS.indexOf(leftNation) - NATIONS.indexOf(rightNation);
    if (nation !== 0) {
      return nation;
    }
    const area = AREAS.indexOf(leftArea) - AREAS.indexOf(rightArea);
    if (area !== 0) {
      return area;
    }
    return OPERATORS.indexOf(leftOperator) - OPERATORS.indexOf(rightOperator);
  });
  const rawCustomers = keys.map((key) => {
    const rows = groups.get(key) ?? [];
    const published = rows.map((row) => row.customersOff).filter((value): value is number => value != null);
    return published.length === 0 ? null : published.reduce((sum, value) => sum + value, 0);
  });
  const numeric = rawCustomers.map((value) => value ?? 0);
  const displayed = largestRemainder(numeric, 1);
  const areaRows: AreaTableRow[] = keys.map((key, index) => {
    const [operator, area, nation] = key.split("|") as [Operator, Area, Nation];
    const rows = groups.get(key) ?? [];
    const customers = rawCustomers[index] ?? null;
    const shown = displayed[index] ?? 0;
    return {
      row: "area",
      area,
      nation,
      operator,
      label: areaName(area),
      incidents: rows.length,
      customers,
      customersShown: customers == null ? null : shown,
      unplanned: rows.filter((row) => row.kind === "unplanned").length,
      planned: rows.filter((row) => row.kind === "planned").length,
    };
  });
  const nationRows: AreaTableRow[] = NATIONS.flatMap((nation) => {
    const members = areaRows.filter((row) => row.nation === nation);
    if (members.length === 0) {
      return [];
    }
    const customers = members.every((row) => row.customers == null)
      ? null
      : members.reduce((sum, row) => sum + (row.customers ?? 0), 0);
    const shown = members.reduce((sum, row) => sum + (row.customersShown ?? 0), 0);
    return [
      {
        row: "nation" as const,
        area: null,
        nation,
        operator: null,
        label: nation,
        incidents: members.reduce((sum, row) => sum + row.incidents, 0),
        customers,
        customersShown: customers == null ? null : shown,
        unplanned: members.reduce((sum, row) => sum + row.unplanned, 0),
        planned: members.reduce((sum, row) => sum + row.planned, 0),
      },
    ];
  });
  const ukCustomers = areaRows.every((row) => row.customers == null)
    ? null
    : areaRows.reduce((sum, row) => sum + (row.customers ?? 0), 0);
  const ukShown = areaRows.reduce((sum, row) => sum + (row.customersShown ?? 0), 0);
  const uk: AreaTableRow = {
    row: "uk",
    area: null,
    nation: null,
    operator: null,
    label: "Areas reporting",
    incidents: areaRows.reduce((sum, row) => sum + row.incidents, 0),
    customers: ukCustomers,
    customersShown: ukCustomers == null ? null : ukShown,
    unplanned: areaRows.reduce((sum, row) => sum + row.unplanned, 0),
    planned: areaRows.reduce((sum, row) => sum + row.planned, 0),
  };
  const ordered: AreaTableRow[] = [];
  for (const nation of NATIONS) {
    const nationRow = nationRows.find((row) => row.nation === nation);
    if (!nationRow) {
      continue;
    }
    ordered.push(...areaRows.filter((row) => row.nation === nation), nationRow);
  }
  ordered.push(uk);
  return ordered;
}

export function sortIncidents(incidents: readonly PowerCut[]): PowerCut[] {
  return incidents.slice().sort((left, right) => {
    const leftCustomers = left.customersOff;
    const rightCustomers = right.customersOff;
    if (leftCustomers == null && rightCustomers != null) {
      return 1;
    }
    if (leftCustomers != null && rightCustomers == null) {
      return -1;
    }
    if (leftCustomers != null && rightCustomers != null && leftCustomers !== rightCustomers) {
      return rightCustomers - leftCustomers;
    }
    return left.startedAt.localeCompare(right.startedAt);
  });
}

function outwardCode(value: string): string | null {
  return normalizePostcode(value)?.outward ?? parsePostcodeSector(value)?.outward ?? null;
}

/** `SW1` matches `SW1` and `SW1A`, and does not match `SW10`. */
function outwardMatches(outward: string, query: string): boolean {
  if (outward === query || query.startsWith(outward)) {
    return true;
  }
  if (!outward.startsWith(query)) {
    return false;
  }
  const next = outward[query.length];
  const previous = query[query.length - 1];
  if (next && previous && /\d/.test(previous) && /\d/.test(next)) {
    return false;
  }
  return true;
}

export function outwardQuery(postcodes: readonly string[], query: string): boolean {
  const compact = query.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 2) {
    return true;
  }
  return postcodes.some((postcode) => {
    const outward = outwardCode(postcode);
    return outward != null && outwardMatches(outward, compact);
  });
}

export function buildPowerCutsModel(snapshot: PowerCutsSnapshot, now: Date): PowerCutsPageModel {
  const incidents = liveIncidents(snapshot);
  const counts = customersOf(incidents);
  const unplanned = incidents.filter((incident) => incident.kind === "unplanned").length;
  const planned = incidents.filter((incident) => incident.kind === "planned").length;
  const percents =
    incidents.length === 0 ? [0, 0] : displayedPercents([(unplanned / incidents.length) * 100, (planned / incidents.length) * 100]);
  const reporting = OPERATORS.some((operator) => snapshot.sources[operator].status === "ok");
  const anyIncluded = OPERATORS.some((operator) => included(snapshot.sources[operator]));
  const allFailed = !anyIncluded;
  const freshness = freshnessOf(snapshot, now);
  const list = sortIncidents(incidents).map((incident) => ({
    ...incident,
    operatorLabel: operatorName(incident.operator),
    areaLabel: areaName(incident.area),
    startedLabel: startedLabel(incident.startedAt, now),
    restorationLabel: restorationLabel(incident.estimatedRestorationAt),
  }));
  return {
    answer: answerSentence({
      incidents: incidents.length,
      customersOff: counts.total,
      customersPartial: counts.partial,
      unplanned,
      planned,
      reporting: reporting || anyIncluded,
      allFailed,
    }),
    coverage: coverageSentence(snapshot),
    freshness: freshness.state,
    asOf: freshness.asOf,
    freshnessDetail: freshness.detail,
    snapshotAge: formatLondon(new Date(snapshot.fetchedAt)),
    incidents: incidents.length,
    customersOff: counts.total,
    customersPartial: counts.partial,
    unplanned,
    planned,
    unplannedPercent: percents[0] ?? 0,
    plannedPercent: percents[1] ?? 0,
    operatorsReporting: OPERATORS.filter((operator) => snapshot.sources[operator].status === "ok").length,
    operatorTotal: OPERATORS.length,
    rows: incidents.length === 0 ? [] : areaTable(incidents),
    list,
    notices: OPERATORS.filter((operator) => snapshot.sources[operator].status !== "ok").map((operator) => ({
      operator,
      name: operatorName(operator),
      status: snapshot.sources[operator].status,
      error: publicOperatorError(snapshot.sources[operator].error) ?? snapshot.sources[operator].status,
    })),
    allFailed,
    empty: !allFailed && incidents.length === 0,
  };
}

export function licensedCredits() {
  return POWER_CUT_CREDITS;
}

/** Drop internal source errors before a snapshot is rendered or sent to the client. */
export function publicPowerCutsSnapshot(snapshot: PowerCutsSnapshot): PowerCutsSnapshot {
  const sources = { ...snapshot.sources };
  for (const operator of OPERATORS) {
    const report = sources[operator];
    const error = publicOperatorError(report.error);
    sources[operator] = error ? { ...report, error } : { status: report.status, fetchedAt: report.fetchedAt, count: report.count };
  }
  return { ...snapshot, sources };
}
