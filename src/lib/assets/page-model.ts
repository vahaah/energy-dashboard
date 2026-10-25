import { NI_FLOW_NOTE } from "@/lib/attribution";
import {
  DURATION_TOOLTIP,
  IMPORT_FLOW_NOTE,
  LOCATION_UNAVAILABLE,
  NOT_AVAILABLE,
  assetLede,
  assetQuestion,
  formatFactMw,
  formatMw,
  precisionLabel,
  technologyLabel,
} from "@/lib/assets/labels";
import { assetPath, mapSelectionHref } from "@/lib/assets/href";
import type { AssetCapacityView, AssetDetail, AssetMatchView, AssetProjectView } from "@/lib/assets/types";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import { assetSeoTitle } from "@/lib/seo/detail";
import type { LayerPrecision } from "@/lib/map/precision";

export type AssetFact = {
  id: string;
  label: string;
  value: string;
  tooltip?: string;
  column: 1 | 2;
};

export type AssetClaim = {
  role: "Operator" | "Owner";
  value: string;
  source: string;
  evidence: string;
};

export type AssetIdentityRow = {
  label: string;
  value: string;
  evidence: string;
};

export type AssetHistoryRow = {
  id: string;
  edition: string;
  published: string;
  source: string;
  mw: string;
  counts: string;
};

export type AssetSourceRow = {
  id: string;
  source: string;
  edition: string;
  href: string | null;
};

export type AssetMiniMap =
  | { kind: "none" }
  | { kind: "point"; longitude: number; latitude: number }
  | {
      kind: "line";
      gbLongitude: number;
      gbLatitude: number;
      remoteLongitude: number;
      remoteLatitude: number;
      gbLabel: string;
      remoteLabel: string;
    };

export type AssetPageModel = {
  id: string;
  name: string;
  technologyLabel: string;
  statusLabel: string;
  question: string;
  lede: string;
  title: string;
  description: string;
  canonicalPath: string;
  mapHref: string;
  facts: AssetFact[];
  coordinatesLabel: string | null;
  coordinateLines: string[];
  precision: LayerPrecision | null;
  miniMap: AssetMiniMap;
  identities: AssetIdentityRow[];
  output:
    | { attached: false; source: string }
    | { attached: true; code: string; note: string; niNote: string | null };
  claims: AssetClaim[];
  projects: { name: string; detail: string }[];
  history: AssetHistoryRow[];
  sourceRecords: AssetSourceRow[];
  attributions: string[];
};

function publishedLabel(value: string | null): string {
  if (!value) {
    return NOT_AVAILABLE;
  }
  return formatLondonDayMonthYear(value.slice(0, 10));
}

function matchEvidence(match: AssetMatchView): string {
  const counted = match.countsSource === "REPD" ? "REPD megawatts count." : "DUKES megawatts count.";
  const distance = match.distanceM === null ? "" : ` Distance ${Math.round(match.distanceM)} m.`;
  return `Same site in both registers, matched by ${match.rule.replaceAll("_", " ")} (${match.confidence}). ${counted}${distance}`;
}

function stationClaims(projects: readonly AssetProjectView[], sources: readonly string[]): AssetClaim[] {
  const claims: AssetClaim[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    const value = project.operator.length > 0 ? project.operator : NOT_AVAILABLE;
    const key = `${project.source}\t${value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    claims.push({
      role: "Operator",
      value,
      source: project.source,
      evidence:
        project.operator.length > 0
          ? `${project.source} records ${project.externalRef} as the operator.`
          : `${project.source} does not record an operator for ${project.externalRef}.`,
    });
  }
  claims.push({
    role: "Owner",
    value: NOT_AVAILABLE,
    source: sources.join(", ") || NOT_AVAILABLE,
    evidence: "The register records an operator, not an owner.",
  });
  return claims;
}

function stationFacts(detail: AssetDetail): AssetFact[] {
  const storage = detail.row.technology === "pumped_storage";
  const facts: AssetFact[] = [
    { id: "mw", label: "Capacity", value: formatFactMw(detail.row.mw), column: 1 },
  ];
  if (storage) {
    facts.push({ id: "mwh", label: "MWh", value: NOT_AVAILABLE, column: 2 });
    facts.push({
      id: "duration",
      label: "Nominal duration",
      value: NOT_AVAILABLE,
      tooltip: DURATION_TOOLTIP,
      column: 1,
    });
  }
  facts.push({
    id: "basis",
    label: "Capacity basis",
    value: detail.row.mw === null ? NOT_AVAILABLE : `Counted ${detail.row.source} megawatts`,
    column: 2,
  });
  const located = detail.row.latitude !== null && detail.row.longitude !== null;
  facts.push({
    id: "precision",
    label: "Location precision",
    value: located ? precisionLabel("published_approximate") : NOT_AVAILABLE,
    column: storage ? 2 : 1,
  });
  return facts;
}

function sourceRecords(capacity: readonly AssetCapacityView[]): AssetSourceRow[] {
  const rows: AssetSourceRow[] = [];
  const seen = new Set<string>();
  for (const record of capacity) {
    const key = `${record.source}\t${record.releaseId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({
      id: key,
      source: record.source,
      edition: record.edition || record.releaseId,
      href: record.downloadUrl,
    });
  }
  return rows;
}

function coordinatePair(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function assetPageModel(detail: AssetDetail): AssetPageModel {
  const technology = technologyLabel(detail.row.technology);
  const link = detail.link;
  const area = link?.area ?? detail.row.region;
  const lede = assetLede(technology, area);
  const canonicalPath = assetPath(detail.row.id, detail.row.name);
  const precision: LayerPrecision | null = link?.line
    ? "schematic"
    : detail.row.latitude !== null && detail.row.longitude !== null
      ? "published_approximate"
      : null;
  const miniMap: AssetMiniMap = link?.line
    ? {
        kind: "line",
        gbLongitude: link.line.gbLongitude,
        gbLatitude: link.line.gbLatitude,
        remoteLongitude: link.line.remoteLongitude,
        remoteLatitude: link.line.remoteLatitude,
        gbLabel: link.line.gbLabel,
        remoteLabel: link.line.remoteLabel,
      }
    : detail.row.latitude !== null && detail.row.longitude !== null
      ? { kind: "point", longitude: detail.row.longitude, latitude: detail.row.latitude }
      : { kind: "none" };
  const coordinateLines =
    miniMap.kind === "line"
      ? [
          `${miniMap.gbLabel} ${coordinatePair(miniMap.gbLatitude, miniMap.gbLongitude)}`,
          `${miniMap.remoteLabel} ${coordinatePair(miniMap.remoteLatitude, miniMap.remoteLongitude)}`,
        ]
      : miniMap.kind === "point"
        ? [coordinatePair(miniMap.latitude, miniMap.longitude)]
        : [];
  const identities: AssetIdentityRow[] = [];
  if (link?.fuelinstCode) {
    identities.push({
      label: "FUELINST code",
      value: link.fuelinstCode,
      evidence: `${link.citation} The flow series attaches on this code only.`,
    });
  } else if (link) {
    identities.push({
      label: "Terminal name",
      value: detail.row.name,
      evidence: link.citation,
    });
  }
  for (const project of detail.projects) {
    identities.push({
      label: project.source === "REPD" ? "REPD reference" : "DUKES site",
      value: project.externalRef,
      evidence: `${project.name} in ${project.source}.`,
    });
  }
  for (const match of detail.matches) {
    identities.push({
      label: "Same site",
      value: match.rule.replaceAll("_", " "),
      evidence: matchEvidence(match),
    });
  }
  const claims: AssetClaim[] = link
    ? [
        {
          role: "Operator",
          value: NOT_AVAILABLE,
          source: detail.row.source,
          evidence: link.fuelinstCode
            ? "FUELINST identifies the link by fuel type and does not name an operator."
            : "The portal lists the terminal name and does not name an operator.",
        },
        {
          role: "Owner",
          value: NOT_AVAILABLE,
          source: detail.row.source,
          evidence: link.fuelinstCode
            ? "FUELINST identifies the link by fuel type and does not name an owner."
            : "The portal lists the terminal name and does not name an owner.",
        },
      ]
    : stationClaims(detail.projects, detail.row.sources);
  const facts = link
    ? [
        { id: "mw", label: "Capacity", value: NOT_AVAILABLE, column: 1 as const },
        { id: "basis", label: "Capacity basis", value: NOT_AVAILABLE, column: 2 as const },
        {
          id: "precision",
          label: "Location precision",
          value: precision ? precisionLabel(precision) : NOT_AVAILABLE,
          column: 1 as const,
        },
      ]
    : stationFacts(detail);
  const output = link?.fuelinstCode
    ? {
        attached: true as const,
        code: link.fuelinstCode,
        note: IMPORT_FLOW_NOTE,
        niNote: detail.row.country === "Northern Ireland" ? NI_FLOW_NOTE : null,
      }
    : {
        attached: false as const,
        source: link ? "National Gas terminal flows" : "Elexon BMU metering",
      };
  return {
    id: detail.row.id,
    name: detail.row.name,
    technologyLabel: technology,
    statusLabel: "Operational",
    question: assetQuestion(detail.row.name),
    lede,
    title: assetSeoTitle({
      name: detail.row.name,
      technology,
      mw: detail.row.mw,
      region: detail.row.region,
    }),
    description: [...lede].slice(0, 155).join(""),
    canonicalPath,
    mapHref: mapSelectionHref(detail.row.id, link?.line ? "ic" : undefined),
    facts,
    coordinatesLabel: coordinateLines.length === 0 ? null : coordinateLines.join(" · "),
    coordinateLines,
    precision,
    miniMap,
    identities,
    output,
    claims,
    projects: detail.projects.map((project) => ({
      name: project.name,
      detail: [project.source, project.externalRef, project.operator || null, project.region, project.county]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
    })),
    history: detail.capacity.map((record) => ({
      id: record.capacityId,
      edition: record.edition || record.releaseId,
      published: publishedLabel(record.publishedAt),
      source: record.source,
      mw: formatMw(record.mw),
      counts: record.counts ? "Counted" : "Not counted",
    })),
    sourceRecords: link ? link.sourceRecords : sourceRecords(detail.capacity),
    attributions: link?.attributions ?? [],
  };
}

export { LOCATION_UNAVAILABLE };
