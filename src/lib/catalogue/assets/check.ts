import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { canonicalJson } from "@/lib/catalogue/canonical";
import { parseNdjson } from "@/lib/catalogue/load";
import { ASSET_REGISTER_FILES } from "@/lib/catalogue/schema";
import {
  assetRecordSchema,
  capacityRecordSchema,
  dukesHeadlineSchema,
  mappingRecordSchema,
  matchOverridesSchema,
  matchRecordSchema,
  projectRecordSchema,
} from "@/lib/catalogue/assets/record-schema";
import { summarizeRegister, type AssetSummary } from "@/lib/catalogue/assets/summary";
import { DUKES_DATASET_ID, DUKES_SOURCE_ID, REPD_DATASET_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";
import type {
  AssetRecord,
  AssetRegister,
  CapacityRecord,
  ProjectRecord,
} from "@/lib/catalogue/assets/types";

const LATITUDE_MIN = 48;
const LATITUDE_MAX = 63;
const LONGITUDE_MIN = -11;
const LONGITUDE_MAX = 4.5;
const MW_MAX = 5_000;

type ReleaseRef = {
  source_release_id: string;
  dataset_id: string;
  content: unknown;
};

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${file}: ${path}: ${issue.message}`;
  });
}

function parseLines<T>(file: string, text: string, schema: z.ZodType<T>): { records: T[]; errors: string[] } {
  const parsed = parseNdjson(text, file);
  if (!parsed.ok) {
    return { records: [], errors: parsed.errors };
  }
  const records: T[] = [];
  const errors: string[] = [];
  for (let index = 0; index < parsed.data.length; index += 1) {
    const result = schema.safeParse(parsed.data[index]);
    if (!result.success) {
      for (const issue of formatIssues(file, result.error)) {
        errors.push(issue.replace(`${file}: `, `${file}:${index + 1}: `));
      }
      continue;
    }
    records.push(result.data);
  }
  return { records, errors };
}

function coordinateErrors(asset: AssetRecord): string[] {
  const latitude = asset.latitude;
  const longitude = asset.longitude;
  if (latitude === null && longitude === null) {
    return [];
  }
  if (latitude === null || longitude === null) {
    return [`${asset.asset_id} has only one of latitude and longitude`];
  }
  if (latitude === 0 && longitude === 0) {
    return [`${asset.asset_id} has coordinates (0, 0)`];
  }
  if (
    latitude < LATITUDE_MIN ||
    latitude > LATITUDE_MAX ||
    longitude < LONGITUDE_MIN ||
    longitude > LONGITUDE_MAX
  ) {
    return [`${asset.asset_id} coordinates ${latitude}, ${longitude} are outside the UK offshore box`];
  }
  return [];
}

function duplicateErrors(label: string, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`duplicate ${label} ${id}`);
    }
    seen.add(id);
  }
  return errors;
}

function sourceOfDataset(datasetId: string): string {
  const index = datasetId.indexOf(":");
  return index < 0 ? datasetId : datasetId.slice(0, index);
}

export function assetRegisterErrors(register: AssetRegister, releases: readonly ReleaseRef[]): string[] {
  const errors: string[] = [];
  const releaseById = new Map(releases.map((release) => [release.source_release_id, release]));
  const assetIds = new Set(register.assets.map((asset) => asset.asset_id));
  const projectsById = new Map(register.projects.map((project) => [project.project_id, project]));
  errors.push(
    ...duplicateErrors(
      "asset_id",
      register.assets.map((asset) => asset.asset_id),
    ),
    ...duplicateErrors(
      "project_id",
      register.projects.map((project) => project.project_id),
    ),
    ...duplicateErrors(
      "capacity_record_id",
      register.capacity.map((record) => record.capacity_record_id),
    ),
  );
  const mappingKeys = register.mappings.map((mapping) => `${mapping.scheme}:${mapping.source_entity_id}`);
  errors.push(...duplicateErrors("source entity", mappingKeys));

  for (const asset of register.assets) {
    errors.push(...coordinateErrors(asset));
  }
  for (const project of register.projects) {
    if (!assetIds.has(project.asset_id)) {
      errors.push(
        `dangling reference: project ${project.project_id} points at missing asset ${project.asset_id}`,
      );
    }
  }
  for (const mapping of register.mappings) {
    if (!assetIds.has(mapping.asset_id)) {
      errors.push(
        `dangling reference: ${mapping.scheme} ${mapping.source_entity_id} points at missing asset ${mapping.asset_id}`,
      );
    }
  }
  for (const record of register.capacity) {
    if (record.mw < 0 || record.mw > MW_MAX) {
      errors.push(`${record.capacity_record_id} mw ${record.mw} is outside 0..${MW_MAX}`);
    }
    if (!assetIds.has(record.asset_id)) {
      errors.push(
        `dangling reference: capacity ${record.capacity_record_id} points at missing asset ${record.asset_id}`,
      );
    }
    const project = projectsById.get(record.project_id);
    if (!project) {
      errors.push(
        `dangling reference: capacity ${record.capacity_record_id} points at missing project ${record.project_id}`,
      );
    } else if (project.asset_id !== record.asset_id || project.source_id !== record.source_id) {
      errors.push(
        `capacity ${record.capacity_record_id} does not belong to project ${record.project_id}`,
      );
    }
    const release = releaseById.get(record.source_release_id);
    if (!release) {
      errors.push(
        `dangling reference: capacity ${record.capacity_record_id} points at missing source release ${record.source_release_id}`,
      );
    } else if (sourceOfDataset(release.dataset_id) !== record.source_id) {
      errors.push(
        `capacity ${record.capacity_record_id} release ${record.source_release_id} belongs to ${release.dataset_id}, not ${record.source_id}`,
      );
    }
  }
  errors.push(...doubleCountErrors(register));
  return errors;
}

function projectKey(project: ProjectRecord): string {
  return `${project.source_id}|${project.external_ref}`;
}

function doubleCountErrors(register: AssetRegister): string[] {
  const errors: string[] = [];
  const projects = new Map(register.projects.map((project) => [projectKey(project), project]));
  const capacityByProject = new Map<string, CapacityRecord[]>();
  for (const record of register.capacity) {
    const list = capacityByProject.get(record.project_id) ?? [];
    list.push(record);
    capacityByProject.set(record.project_id, list);
  }
  const seenRepd = new Set<string>();
  const seenDukes = new Set<string>();
  const suppressed = new Set<string>();
  for (const match of register.matches) {
    const repdRecords: CapacityRecord[] = [];
    const dukesRecords: CapacityRecord[] = [];
    for (const ref of match.repd_refs) {
      if (seenRepd.has(ref)) {
        errors.push(`REPD ${ref} is in more than one match`);
      }
      seenRepd.add(ref);
      const project = projects.get(`${REPD_SOURCE_ID}|${ref}`);
      if (!project) {
        errors.push(`dangling reference: match ${match.match_id} REPD ${ref} has no project`);
        continue;
      }
      repdRecords.push(...(capacityByProject.get(project.project_id) ?? []));
    }
    for (const code of match.dukes_site_codes) {
      if (seenDukes.has(code)) {
        errors.push(`DUKES ${code} is in more than one match`);
      }
      seenDukes.add(code);
      const project = projects.get(`${DUKES_SOURCE_ID}|${code}`);
      if (!project) {
        errors.push(`dangling reference: match ${match.match_id} DUKES ${code} has no project`);
        continue;
      }
      dukesRecords.push(...(capacityByProject.get(project.project_id) ?? []));
    }
    const repdMw = repdRecords.reduce((sum, record) => sum + record.mw, 0);
    const dukesMw = dukesRecords.reduce((sum, record) => sum + record.mw, 0);
    const counted = [...repdRecords, ...dukesRecords].reduce(
      (sum, record) => sum + (record.counts ? record.mw : 0),
      0,
    );
    const preferred = match.counts_source === REPD_SOURCE_ID ? repdMw : dukesMw;
    if (repdMw > 0 && dukesMw > 0 && counted > Math.max(repdMw, dukesMw) + 0.05) {
      errors.push(
        `match ${match.match_id} counts ${counted} MW from both REPD ${repdMw} and DUKES ${dukesMw}`,
      );
    }
    if (Math.abs(counted - preferred) > 0.05) {
      errors.push(
        `match ${match.match_id} counted ${counted} MW, expected ${preferred} from ${match.counts_source}`,
      );
    }
    const quiet = match.counts_source === REPD_SOURCE_ID ? dukesRecords : repdRecords;
    for (const record of quiet) {
      const project = projectsByCapacity(register, record);
      if (project) {
        suppressed.add(projectKey(project));
      }
    }
  }
  for (const record of register.capacity) {
    if (record.counts) {
      continue;
    }
    const project = register.projects.find((item) => item.project_id === record.project_id);
    if (!project || !suppressed.has(projectKey(project))) {
      errors.push(`${record.capacity_record_id} does not count and is not a matched duplicate`);
    }
  }
  return errors;
}

function projectsByCapacity(register: AssetRegister, record: CapacityRecord): ProjectRecord | undefined {
  return register.projects.find((project) => project.project_id === record.project_id);
}

function readRequired(dir: string, file: string): { text: string } | { error: string } {
  const path = join(dir, file);
  if (!existsSync(path)) {
    return { error: `missing ${file}` };
  }
  return { text: readFileSync(path, "utf8") };
}

function headlineFromRelease(release: ReleaseRef | undefined): { major_power_producers: number; all_generators: number } | null {
  if (!release || typeof release.content !== "object" || release.content === null) {
    return null;
  }
  const headline = dukesHeadlineSchema.safeParse(
    (release.content as { headline_mw?: unknown }).headline_mw,
  );
  return headline.success ? headline.data : null;
}

export function checkAssetFiles(dir: string, releases: readonly ReleaseRef[]): string[] {
  const present = Object.values(ASSET_REGISTER_FILES).filter((file) => existsSync(join(dir, file)));
  if (!existsSync(join(dir, ASSET_REGISTER_FILES.assets))) {
    return present.length > 0 ? [`asset register is missing ${ASSET_REGISTER_FILES.assets}`] : [];
  }
  const errors: string[] = [];
  const loaded = new Map<string, string>();
  for (const file of Object.values(ASSET_REGISTER_FILES)) {
    const body = readRequired(dir, file);
    if ("error" in body) {
      errors.push(body.error);
      continue;
    }
    loaded.set(file, body.text);
  }
  if (errors.length > 0) {
    return errors;
  }
  const assets = parseLines(ASSET_REGISTER_FILES.assets, loaded.get(ASSET_REGISTER_FILES.assets) ?? "", assetRecordSchema);
  const projects = parseLines(
    ASSET_REGISTER_FILES.projects,
    loaded.get(ASSET_REGISTER_FILES.projects) ?? "",
    projectRecordSchema,
  );
  const capacity = parseLines(
    ASSET_REGISTER_FILES.capacity,
    loaded.get(ASSET_REGISTER_FILES.capacity) ?? "",
    capacityRecordSchema,
  );
  const mappings = parseLines(
    ASSET_REGISTER_FILES.mappings,
    loaded.get(ASSET_REGISTER_FILES.mappings) ?? "",
    mappingRecordSchema,
  );
  const matches = parseLines(
    ASSET_REGISTER_FILES.matches,
    loaded.get(ASSET_REGISTER_FILES.matches) ?? "",
    matchRecordSchema,
  );
  errors.push(
    ...assets.errors,
    ...projects.errors,
    ...capacity.errors,
    ...mappings.errors,
    ...matches.errors,
  );
  let overridesJson: unknown;
  try {
    overridesJson = JSON.parse(loaded.get(ASSET_REGISTER_FILES.overrides) ?? "");
  } catch {
    errors.push(`${ASSET_REGISTER_FILES.overrides}: invalid JSON`);
    return errors;
  }
  const overrides = matchOverridesSchema.safeParse(overridesJson);
  if (!overrides.success) {
    errors.push(...formatIssues(ASSET_REGISTER_FILES.overrides, overrides.error));
  }
  let summaryJson: unknown;
  try {
    summaryJson = JSON.parse(loaded.get(ASSET_REGISTER_FILES.summary) ?? "");
  } catch {
    errors.push(`${ASSET_REGISTER_FILES.summary}: invalid JSON`);
    return errors;
  }
  if (errors.length > 0 || !overrides.success) {
    return errors;
  }
  const register: AssetRegister = {
    assets: assets.records,
    projects: projects.records,
    capacity: capacity.records,
    mappings: mappings.records,
    matches: matches.records,
  };
  errors.push(...assetRegisterErrors(register, releases));
  errors.push(...overrideErrors(register, overrides.data));
  const summary = summaryJson as AssetSummary;
  const dukesRelease = releases.find((release) => release.source_release_id === summary.dukes_source_release_id);
  const headline = headlineFromRelease(dukesRelease);
  if (!headline || dukesRelease?.dataset_id !== DUKES_DATASET_ID) {
    errors.push("asset_summary.json dukes release is missing headline_mw");
    return errors;
  }
  const repdRelease = releases.find((release) => release.source_release_id === summary.repd_source_release_id);
  if (!repdRelease || repdRelease.dataset_id !== REPD_DATASET_ID) {
    errors.push("asset_summary.json repd release is missing");
  }
  const files: Record<string, number> = {};
  for (const file of Object.values(ASSET_REGISTER_FILES)) {
    if (file === ASSET_REGISTER_FILES.summary) {
      continue;
    }
    files[file] = statSync(join(dir, file)).size;
  }
  const expected = summarizeRegister(
    register,
    { repd: summary.repd_source_release_id, dukes: summary.dukes_source_release_id },
    headline,
    files,
  );
  if (canonicalJson(summaryJson) !== canonicalJson(expected)) {
    errors.push("asset_summary.json does not match the register");
  }
  return errors;
}

function overrideErrors(
  register: AssetRegister,
  overrides: z.infer<typeof matchOverridesSchema>,
): string[] {
  const errors: string[] = [];
  for (const link of overrides.links) {
    const match = register.matches.find(
      (item) =>
        item.confidence === "manual" &&
        sameMembers(item.dukes_site_codes, link.dukes_site_codes) &&
        sameMembers(item.repd_refs, link.repd_refs),
    );
    if (!match) {
      errors.push(`match override ${link.note} was not applied`);
    }
  }
  for (const unlink of overrides.unlinks) {
    const blocked = register.matches.some(
      (match) =>
        match.dukes_site_codes.some((code) => unlink.dukes_site_codes.includes(code)) &&
        match.repd_refs.some((ref) => unlink.repd_refs.includes(ref)),
    );
    if (blocked) {
      errors.push(`match override unlink ${unlink.note} still has a match`);
    }
  }
  return errors;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const seen = new Set(left);
  return right.every((value) => seen.has(value));
}
