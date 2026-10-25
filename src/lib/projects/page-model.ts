import { formatDisplay, roundDisplay } from "@/lib/display-rounding";
import { NO_DATE_PUBLISHED, PROJECT_EXPECTATION_CHANGE } from "@/lib/projects/copy";
import { formatProjectDate } from "@/lib/projects/dates";
import { projectPath } from "@/lib/projects/href";
import type { ChangeEvent, EnergyProject } from "@/lib/projects/schema";
import {
  agreementLabel,
  constructionLabel,
  displayStageLabel,
  gateLabel,
  operationalLabel,
  planningLabel,
  stageLabel,
} from "@/lib/projects/status";
import { technologyLabel } from "@/lib/projects/technology";
import {
  MW_QUANTUM,
  connectionCapacity,
  countExcludedFromOperating,
  operatingRatedPower,
  operatingTechnologyShares,
  storageEnergy,
  type TechnologyShare,
} from "@/lib/projects/totals";

export type ProjectIndexRow = {
  id: string;
  href: string;
  name: string;
  technology: string;
  displayStage: string;
  planning: string;
  construction: string;
  gate: string;
  power: string;
  connection: string;
  nation: string;
};

export type StatusLine = {
  label: string;
  value: string;
  date: string;
  source: string;
};

export type ProjectProfile = {
  id: string;
  name: string;
  href: string;
  title: string;
  technology: string;
  country: string;
  statuses: StatusLine[];
  power: string;
  connection: string;
  storage: string;
  expectationChange: boolean;
  expectationCopy: string;
};

export type ProjectsDocument = {
  operating: ReturnType<typeof operatingRatedPower>;
  connection: ReturnType<typeof connectionCapacity>;
  storage: ReturnType<typeof storageEnergy>;
  shares: TechnologyShare[];
  proposedExcluded: number;
  rows: ProjectIndexRow[];
};

export function projectPlace(country: string | null, region: string | null): string {
  if (country && region && region.toLowerCase() !== country.toLowerCase()) {
    return `${country}, ${region}`;
  }
  if (country) {
    return country;
  }
  if (region) {
    return region;
  }
  return "Country not published";
}

function publishedStatus(label: string): string | null {
  return label === "Unknown" ? null : label;
}

function connectionStatus(project: EnergyProject): string {
  const parts = [
    publishedStatus(stageLabel(project.connection_stage)),
    publishedStatus(gateLabel(project.connection_gate)),
    publishedStatus(agreementLabel(project.agreement_status)),
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) {
    return `${technologyLabel(project.technology)} project, ${project.project_id}`;
  }
  return parts.join(", ");
}

function measureLabel(value: number | null, unit: string): string {
  if (value === null) {
    return "Not published";
  }
  return `${formatDisplay(roundDisplay(value, MW_QUANTUM), MW_QUANTUM)} ${unit}`;
}

function sourceLine(sourceId: EnergyProject["planning_source_id"], releaseId: string | null): string {
  if (sourceId === "desnz-repd") {
    return "DESNZ REPD, 3 Aug 2026";
  }
  if (sourceId === "neso-open-data") {
    return "NESO TEC register, 13 Oct 2026";
  }
  if (releaseId) {
    return releaseId;
  }
  return "No source published";
}

export function projectIndexRow(project: EnergyProject): ProjectIndexRow {
  return {
    id: project.project_id,
    href: projectPath(project.project_id, project.name),
    name: project.name,
    technology: technologyLabel(project.technology),
    displayStage: displayStageLabel(project.display_stage),
    planning: planningLabel(project.planning_status),
    construction: constructionLabel(project.construction_status),
    gate: gateLabel(project.connection_gate),
    power: measureLabel(project.power_mw, "MW"),
    connection: measureLabel(project.connection_capacity_mw, "MW"),
    nation: project.country ?? "Not published",
  };
}

export function buildProjectsDocument(projects: readonly EnergyProject[]): ProjectsDocument {
  const shares = operatingTechnologyShares(projects).filter((share) => share.mw > 0 || share.percent > 0);
  shares.sort((left, right) => right.mw - left.mw || left.label.localeCompare(right.label));
  return {
    operating: operatingRatedPower(projects),
    connection: connectionCapacity(projects),
    storage: storageEnergy(projects),
    shares,
    proposedExcluded: countExcludedFromOperating(projects),
    rows: projects.map(projectIndexRow),
  };
}

export function buildProjectProfile(project: EnergyProject, events: readonly ChangeEvent[]): ProjectProfile {
  const expectationChange = events.some(
    (event) => event.entity === project.project_id && event.field === "expected_energisation" && event.comparison === "field",
  );
  return {
    id: project.project_id,
    name: project.name,
    href: projectPath(project.project_id, project.name),
    title: project.name,
    technology: technologyLabel(project.technology),
    country: projectPlace(project.country, project.region),
    statuses: [
      {
        label: "Planning",
        value: planningLabel(project.planning_status),
        date: formatProjectDate(project.planning_decision_date, NO_DATE_PUBLISHED),
        source: sourceLine(project.planning_source_id, project.planning_release_id),
      },
      {
        label: "Construction",
        value: constructionLabel(project.construction_status),
        date: formatProjectDate(project.construction_evidence_date, NO_DATE_PUBLISHED),
        source: sourceLine(project.construction_source_id, project.construction_release_id),
      },
      {
        label: "Connection",
        value: connectionStatus(project),
        date: formatProjectDate(project.expected_energisation, NO_DATE_PUBLISHED),
        source: sourceLine(project.connection_source_id, project.connection_release_id),
      },
      {
        label: "Operation",
        value: operationalLabel(project.operational_status),
        date: formatProjectDate(project.commissioning_date ?? project.closure_date, NO_DATE_PUBLISHED),
        source: sourceLine(project.operational_source_id, project.operational_release_id),
      },
    ],
    power: measureLabel(project.power_mw, "MW"),
    connection: measureLabel(project.connection_capacity_mw, "MW"),
    storage: measureLabel(project.storage_energy_mwh, "MWh"),
    expectationChange,
    expectationCopy: PROJECT_EXPECTATION_CHANGE,
  };
}
