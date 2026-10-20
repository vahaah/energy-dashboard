import { displayedPercents, formatDisplay, largestRemainder, roundDisplay } from "@/lib/display-rounding";
import { latestDate } from "@/lib/projects/dates";
import { technologyLabel, type ProjectTechnology } from "@/lib/projects/technology";
import { PIPELINE_CONSENTED_LABEL, PIPELINE_NOT_PUBLISHED } from "@/lib/pipeline/copy";
import { pipelineMarker } from "@/lib/pipeline/colors";
import {
  GB_PIPELINE_COUNTRIES,
  type GbPipelineCountry,
  type PipelineRecord,
  type RepdShortStatus,
} from "@/lib/pipeline/records";

export const PIPELINE_GW_QUANTUM = 0.1;

export const PIPELINE_STAGES = ["under_construction", "consented", "in_planning"] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export const STORAGE_BUCKETS = ["battery", "other_storage", "generation"] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

const OTHER_STORAGE = new Set<ProjectTechnology>(["pumped_storage", "liquid_air", "compressed_air", "flywheel"]);

const OUTCOME_ORDER = [
  "operating",
  "under_construction",
  "awaiting",
  "expired",
  "abandoned",
  "refused",
  "withdrawn",
  "in_planning",
  "decommissioned",
] as const;

export type OutcomeId = (typeof OUTCOME_ORDER)[number];

export type GwPart = {
  id: string;
  label: string;
  projects: number;
  gw: string;
  exactGw: number;
};

export type StagePart = GwPart & { id: PipelineStageId };

export type StorageTypeRow = {
  label: string;
  text: string;
};

export type StorageTotal = {
  gw: string;
  exactMwLabel: string;
  rows: StorageTypeRow[];
};

export type TechnologyPart = GwPart & {
  technology: ProjectTechnology;
  shape: ReturnType<typeof pipelineMarker>["shape"];
  color: string;
  /** GW at 0.1, or MW to one decimal when the row is under 0.1 GW. */
  amount: string;
};

export type OutcomePart = {
  id: OutcomeId;
  label: string;
  projects: number;
  percent: number;
};

export type MedianStep = {
  id: PipelineStageId;
  label: string;
  days: number | null;
  projects: number;
};

export type PipelineTableRow = {
  ref: string;
  name: string;
  stage: PipelineStageId;
  technology: ProjectTechnology;
  technologyLabel: string;
  nation: GbPipelineCountry;
  mw: number | null;
  capacityLabel: string;
  statusDate: string | null;
  statusDateLabel: string;
  href: string | null;
};

export type PipelineFigures = {
  projects: number;
  missingCapacity: number;
  totalGw: string;
  exactGw: number;
  stages: StagePart[];
  nations: GwPart[];
  storage: GwPart[];
  storageTotal: StorageTotal;
  technologies: TechnologyPart[];
  revised: number;
  noApplicationRequired: number;
  cohort: {
    applications: number;
    consented: number;
    built: number;
    operating: number;
    outcomes: OutcomePart[];
  };
  medians: MedianStep[];
  northernIreland: { projects: number; gw: string; exactGw: number };
  table: PipelineTableRow[];
};

type Bucket = { projects: number; exactMw: number; missing: number };

function emptyBucket(): Bucket {
  return { projects: 0, exactMw: 0, missing: 0 };
}

function addProject(bucket: Bucket, mw: number | null): void {
  bucket.projects += 1;
  if (mw === null) {
    bucket.missing += 1;
    return;
  }
  bucket.exactMw += mw;
}

export function isGbCountry(country: PipelineRecord["country"]): country is GbPipelineCountry {
  return country !== null && (GB_PIPELINE_COUNTRIES as readonly string[]).includes(country);
}

export function pipelineStage(status: RepdShortStatus): PipelineStageId | null {
  switch (status) {
    case "under_construction":
      return "under_construction";
    case "awaiting_construction":
      return "consented";
    case "application_submitted":
    case "appeal_lodged":
      return "in_planning";
    case "operational":
    case "application_refused":
    case "revised":
    case "application_withdrawn":
    case "abandoned":
    case "permission_expired":
    case "appeal_refused":
    case "appeal_withdrawn":
    case "decommissioned":
    case "no_application_required":
      return null;
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function stageLabel(stage: PipelineStageId): string {
  switch (stage) {
    case "under_construction":
      return "Under construction";
    case "consented":
      return PIPELINE_CONSENTED_LABEL;
    case "in_planning":
      return "In planning";
    default: {
      const neverStage: never = stage;
      return neverStage;
    }
  }
}

export function storageLabel(bucket: StorageBucket): string {
  switch (bucket) {
    case "battery":
      return "Battery storage";
    case "other_storage":
      return "Other storage";
    case "generation":
      return "Generation";
    default: {
      const neverBucket: never = bucket;
      return neverBucket;
    }
  }
}

function storageBucket(technology: ProjectTechnology): StorageBucket {
  if (technology === "battery") {
    return "battery";
  }
  if (OTHER_STORAGE.has(technology)) {
    return "other_storage";
  }
  return "generation";
}

function outcomeOf(status: RepdShortStatus): OutcomeId | "excluded" {
  switch (status) {
    case "operational":
      return "operating";
    case "under_construction":
      return "under_construction";
    case "awaiting_construction":
      return "awaiting";
    case "permission_expired":
      return "expired";
    case "abandoned":
      return "abandoned";
    case "application_refused":
    case "appeal_refused":
      return "refused";
    case "application_withdrawn":
    case "appeal_withdrawn":
      return "withdrawn";
    case "application_submitted":
    case "appeal_lodged":
      return "in_planning";
    case "decommissioned":
      return "decommissioned";
    case "revised":
    case "no_application_required":
      return "excluded";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function outcomeLabel(id: OutcomeId): string {
  switch (id) {
    case "operating":
      return "Operating";
    case "under_construction":
      return "Under construction";
    case "awaiting":
      return PIPELINE_CONSENTED_LABEL;
    case "expired":
      return "Permission expired";
    case "abandoned":
      return "Abandoned";
    case "refused":
      return "Refused";
    case "withdrawn":
      return "Withdrawn";
    case "in_planning":
      return "Still in planning";
    case "decommissioned":
      return "Decommissioned";
    default: {
      const neverId: never = id;
      return neverId;
    }
  }
}

function grantDate(record: PipelineRecord): string | null {
  return latestDate([record.granted, record.appeal_granted, record.sos_granted]);
}

function wasConsented(record: PipelineRecord): boolean {
  return grantDate(record) !== null || record.status === "operational" || record.status === "under_construction";
}

function statusDate(record: PipelineRecord, stage: PipelineStageId): string | null {
  switch (stage) {
    case "under_construction":
      return record.construction;
    case "consented":
      return grantDate(record);
    case "in_planning":
      return record.status === "appeal_lodged" ? (record.appeal_lodged ?? record.submitted) : record.submitted;
    default: {
      const neverStage: never = stage;
      return neverStage;
    }
  }
}

function daysBetween(start: string, end: string): number | null {
  if (end < start) {
    return null;
  }
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }
  return Math.round((to - from) / 86_400_000);
}

/** Higher of the two central values when the count is even, so the median is an observed duration. */
export function medianDays(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function formatGw(exactGw: number): string {
  return formatDisplay(roundDisplay(exactGw, PIPELINE_GW_QUANTUM), PIPELINE_GW_QUANTUM);
}

function gwParts(rows: readonly { id: string; label: string; bucket: Bucket }[]): GwPart[] {
  const shown = largestRemainder(
    rows.map((row) => row.bucket.exactMw / 1000),
    PIPELINE_GW_QUANTUM,
  );
  return rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    projects: row.bucket.projects,
    exactGw: row.bucket.exactMw / 1000,
    gw: formatDisplay(shown[index] ?? 0, PIPELINE_GW_QUANTUM),
  }));
}

/**
 * Gigawatt quanta for technologies at or above 0.1 GW. Smaller rows stay at 0
 * and are shown in MW, so their capacity is not also given to a larger label.
 * The returned values sum to the rounded total of the rows that stay in GW.
 */
function technologyGwShown(exactGw: readonly number[]): number[] {
  const eligible = exactGw.map((value) => (value >= PIPELINE_GW_QUANTUM ? value : 0));
  const shown = largestRemainder(eligible, PIPELINE_GW_QUANTUM);
  return shown.map((value, index) => ((exactGw[index] ?? 0) >= PIPELINE_GW_QUANTUM ? value : 0));
}

function technologyAmount(exactMw: number, gw: string): string {
  if (!(exactMw > 0)) {
    return PIPELINE_NOT_PUBLISHED;
  }
  if (exactMw / 1000 < PIPELINE_GW_QUANTUM) {
    return formatExactMw(exactMw);
  }
  return `${gw} GW`;
}

function formatCapacity(mw: number | null): string {
  if (mw === null) {
    return PIPELINE_NOT_PUBLISHED;
  }
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(mw)} MW`;
}

function formatStatusDate(value: string | null): string {
  if (value === null) {
    return PIPELINE_NOT_PUBLISHED;
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return PIPELINE_NOT_PUBLISHED;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function decisionDate(record: PipelineRecord): string | null {
  const dates = [
    record.granted,
    record.appeal_granted,
    record.sos_granted,
    record.refused,
    record.withdrawn,
    record.appeal_refused,
    record.appeal_withdrawn,
    record.sos_refused,
  ].filter((value): value is string => value !== null && record.submitted !== null && value >= record.submitted);
  return dates.sort()[0] ?? null;
}

function inCohort(record: PipelineRecord): boolean {
  if (!isGbCountry(record.country) || record.submitted === null) {
    return false;
  }
  if (record.status === "revised" || record.status === "no_application_required") {
    return false;
  }
  const year = Number(record.submitted.slice(0, 4));
  return year >= 2015 && year <= 2020;
}

export function buildPipelineFigures(
  records: readonly PipelineRecord[],
  hrefForRef: (ref: string) => string | null = () => null,
): PipelineFigures {
  const stageBuckets = new Map<PipelineStageId, Bucket>(PIPELINE_STAGES.map((stage) => [stage, emptyBucket()]));
  const nationBuckets = new Map<GbPipelineCountry, Bucket>(GB_PIPELINE_COUNTRIES.map((nation) => [nation, emptyBucket()]));
  const storageBuckets = new Map<StorageBucket, Bucket>(STORAGE_BUCKETS.map((bucket) => [bucket, emptyBucket()]));
  const technologyBuckets = new Map<ProjectTechnology, Bucket>();
  const ni = emptyBucket();
  let revised = 0;
  let noApplicationRequired = 0;
  const table: PipelineTableRow[] = [];

  const planningDays: number[] = [];
  const consentedDays: number[] = [];
  const constructionDays: number[] = [];

  const cohortRecords: PipelineRecord[] = [];

  for (const record of records) {
    const stage = pipelineStage(record.status);
    if (record.country === "Northern Ireland" && stage) {
      addProject(ni, record.mw);
    }
    if (!isGbCountry(record.country)) {
      continue;
    }
    if (record.status === "revised") {
      revised += 1;
    }
    if (record.status === "no_application_required") {
      noApplicationRequired += 1;
    }
    if (inCohort(record)) {
      cohortRecords.push(record);
    }
    if (record.status !== "application_submitted" && record.status !== "appeal_lodged" && record.status !== "revised" && record.status !== "no_application_required") {
      const end = decisionDate(record);
      const days = record.submitted && end ? daysBetween(record.submitted, end) : null;
      if (days !== null) {
        planningDays.push(days);
      }
    }
    const grant = grantDate(record);
    const leftConsent = record.construction ?? record.operational;
    if (grant && leftConsent) {
      const days = daysBetween(grant, leftConsent);
      if (days !== null) {
        consentedDays.push(days);
      }
    }
    if ((record.status === "operational" || record.status === "decommissioned") && record.construction && record.operational) {
      const days = daysBetween(record.construction, record.operational);
      if (days !== null) {
        constructionDays.push(days);
      }
    }
    if (!stage) {
      continue;
    }
    const stageBucket = stageBuckets.get(stage);
    const nationBucket = nationBuckets.get(record.country);
    const storage = storageBuckets.get(storageBucket(record.technology));
    if (!stageBucket || !nationBucket || !storage) {
      continue;
    }
    addProject(stageBucket, record.mw);
    addProject(nationBucket, record.mw);
    addProject(storage, record.mw);
    const technology = technologyBuckets.get(record.technology) ?? emptyBucket();
    addProject(technology, record.mw);
    technologyBuckets.set(record.technology, technology);
    const dated = statusDate(record, stage);
    table.push({
      ref: record.ref,
      name: record.name,
      stage,
      technology: record.technology,
      technologyLabel: technologyLabel(record.technology),
      nation: record.country,
      mw: record.mw,
      capacityLabel: formatCapacity(record.mw),
      statusDate: dated,
      statusDateLabel: formatStatusDate(dated),
      href: hrefForRef(record.ref),
    });
  }

  const stageRows = PIPELINE_STAGES.map((stage) => ({
    id: stage,
    label: stageLabel(stage),
    bucket: stageBuckets.get(stage) ?? emptyBucket(),
  }));
  const stages: StagePart[] = gwParts(stageRows).map((part, index) => {
    const id = stageRows[index]?.id;
    if (!id) {
      throw new Error("pipeline stage row is missing");
    }
    return { ...part, id };
  });
  const nations = gwParts(
    GB_PIPELINE_COUNTRIES.map((nation) => ({
      id: nation,
      label: nation,
      bucket: nationBuckets.get(nation) ?? emptyBucket(),
    })),
  );
  const storage = gwParts(
    STORAGE_BUCKETS.map((bucket) => ({
      id: bucket,
      label: storageLabel(bucket),
      bucket: storageBuckets.get(bucket) ?? emptyBucket(),
    })),
  );
  const technologyRows = [...technologyBuckets.entries()]
    .map(([technology, bucket]) => ({
      id: technology,
      label: technologyLabel(technology),
      technology,
      bucket,
    }))
    .sort((left, right) => right.bucket.exactMw - left.bucket.exactMw || left.label.localeCompare(right.label));
  const technologyShown = technologyGwShown(technologyRows.map((row) => row.bucket.exactMw / 1000));
  const technologies: TechnologyPart[] = technologyRows.map((row, index) => {
    const marker = pipelineMarker(row.technology);
    const gw = formatDisplay(technologyShown[index] ?? 0, PIPELINE_GW_QUANTUM);
    return {
      id: row.id,
      technology: row.technology,
      label: row.label,
      projects: row.bucket.projects,
      exactGw: row.bucket.exactMw / 1000,
      gw,
      amount: technologyAmount(row.bucket.exactMw, gw),
      shape: marker.shape,
      color: marker.color,
    };
  });

  const exactMw = stageRows.reduce((sum, row) => sum + row.bucket.exactMw, 0);
  const projects = stageRows.reduce((sum, row) => sum + row.bucket.projects, 0);
  const missingCapacity = stageRows.reduce((sum, row) => sum + row.bucket.missing, 0);

  const outcomeCounts = new Map<OutcomeId, number>(OUTCOME_ORDER.map((id) => [id, 0]));
  let consented = 0;
  let built = 0;
  let operating = 0;
  for (const record of cohortRecords) {
    const outcome = outcomeOf(record.status);
    if (outcome === "excluded") {
      throw new Error(`cohort record ${record.ref} is excluded from the pipeline definition`);
    }
    outcomeCounts.set(outcome, (outcomeCounts.get(outcome) ?? 0) + 1);
    if (wasConsented(record)) {
      consented += 1;
    }
    if (record.status === "under_construction" || record.status === "operational") {
      built += 1;
    }
    if (record.status === "operational") {
      operating += 1;
    }
  }
  const outcomeRows = OUTCOME_ORDER.map((id) => ({ id, projects: outcomeCounts.get(id) ?? 0 })).filter((row) => row.projects > 0);
  const percents = displayedPercents(outcomeRows.map((row) => (cohortRecords.length === 0 ? 0 : (row.projects / cohortRecords.length) * 100)));
  const outcomes: OutcomePart[] = outcomeRows.map((row, index) => ({
    id: row.id,
    label: outcomeLabel(row.id),
    projects: row.projects,
    percent: percents[index] ?? 0,
  }));

  table.sort((left, right) => (right.mw ?? -1) - (left.mw ?? -1) || left.name.localeCompare(right.name));

  return {
    projects,
    missingCapacity,
    totalGw: formatGw(exactMw / 1000),
    exactGw: exactMw / 1000,
    stages,
    nations,
    storage,
    storageTotal: storageTotalOf(storage, storageBuckets, technologyBuckets),
    technologies,
    revised,
    noApplicationRequired,
    cohort: {
      applications: cohortRecords.length,
      consented,
      built,
      operating,
      outcomes,
    },
    medians: [
      { id: "in_planning", label: "In planning", days: medianDays(planningDays), projects: planningDays.length },
      { id: "consented", label: stageLabel("consented"), days: medianDays(consentedDays), projects: consentedDays.length },
      { id: "under_construction", label: "Under construction", days: medianDays(constructionDays), projects: constructionDays.length },
    ],
    northernIreland: {
      projects: ni.projects,
      exactGw: ni.exactMw / 1000,
      gw: formatGw(ni.exactMw / 1000),
    },
    table,
  };
}

export function sumDisplayedGw(parts: readonly { gw: string }[]): number {
  return Number(parts.reduce((sum, part) => sum + Number(part.gw), 0).toFixed(1));
}

function formatExactMw(mw: number): string {
  const roundedMw = Math.round(mw * 10) / 10;
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(roundedMw)} MW`;
}

function storageTypeLabel(technology: ProjectTechnology): string | null {
  if (technology === "battery") {
    return storageLabel("battery");
  }
  if (technology === "pumped_storage") {
    return technologyLabel(technology);
  }
  if (technology === "liquid_air") {
    return "Liquid Air Energy Storage";
  }
  if (technology === "compressed_air") {
    return "Compressed Air Energy Storage";
  }
  return null;
}

/** Rows under 0.1 GW stay in MW to one decimal. Never 0.0 GW or <0.1 GW. */
export function storageRowText(label: string, exactMw: number): string {
  const gw = exactMw / 1000;
  if (!(gw >= PIPELINE_GW_QUANTUM)) {
    return `${label}: ${formatExactMw(exactMw)}`;
  }
  const shown = formatDisplay(roundDisplay(gw, PIPELINE_GW_QUANTUM), PIPELINE_GW_QUANTUM);
  if (shown === "0.0") {
    return `${label}: ${formatExactMw(exactMw)}`;
  }
  return `${label}: ${shown} GW`;
}

function storageTypeRows(technologies: ReadonlyMap<ProjectTechnology, Bucket>): StorageTypeRow[] {
  const rows: { label: string; exactMw: number }[] = [];
  for (const [technology, bucket] of technologies) {
    if (storageBucket(technology) === "generation" || bucket.projects === 0) {
      continue;
    }
    const label = storageTypeLabel(technology);
    if (label === null) {
      continue;
    }
    rows.push({ label, exactMw: bucket.exactMw });
  }
  rows.sort((left, right) => right.exactMw - left.exactMw || left.label.localeCompare(right.label));
  return rows.map((row) => ({ label: row.label, text: storageRowText(row.label, row.exactMw) }));
}

function storageTotalOf(
  storage: readonly GwPart[],
  buckets: ReadonlyMap<StorageBucket, Bucket>,
  technologies: ReadonlyMap<ProjectTechnology, Bucket>,
): StorageTotal {
  const parts = storage.filter((part) => part.id === "battery" || part.id === "other_storage");
  const exactMw = (buckets.get("battery")?.exactMw ?? 0) + (buckets.get("other_storage")?.exactMw ?? 0);
  return {
    gw: sumDisplayedGw(parts).toFixed(1),
    exactMwLabel: formatExactMw(exactMw),
    rows: storageTypeRows(technologies),
  };
}

/** A finished step. Under a year stays in days. */
export function formatMedianDuration(days: number | null): string {
  if (days === null) {
    return PIPELINE_NOT_PUBLISHED;
  }
  if (days < 365) {
    return `${days.toLocaleString("en-GB")} days`;
  }
  const years = Math.floor(days / 365);
  const rest = days - years * 365;
  const yearLabel = years === 1 ? "1 year" : `${years.toLocaleString("en-GB")} years`;
  if (rest === 0) {
    return yearLabel;
  }
  const dayLabel = rest === 1 ? "1 day" : `${rest.toLocaleString("en-GB")} days`;
  return `${yearLabel}, ${dayLabel}`;
}
