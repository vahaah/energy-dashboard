import { DATA_SOURCE_IDS } from "@/lib/attribution";
import { checkAssetFiles } from "@/lib/catalogue/assets/check";
import { checkLinkFiles } from "@/lib/catalogue/links/check";
import { checkLayerCatalogue } from "@/lib/catalogue/layers-check";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { catalogueErrors, loadCatalogue, type CatalogueReleaseLine } from "@/lib/catalogue/load";
import { METRICS } from "@/lib/metrics";
import {
  CATALOGUE_SOURCE_IDS,
  catalogueDatasetId,
  catalogueReleaseId,
  NATIONAL_GAS_PUBLICATION_ID,
  type CatalogueDataset,
  type CatalogueSource,
  type IngestionRun,
} from "@/lib/catalogue/schema";

export type CatalogueMetricRef = {
  metric_id: string;
  /** Catalogue key, the same string `METRICS[id].dataset_id` already uses. */
  dataset_id: string;
  source_id: string | readonly string[];
  /** `METRICS[id].expected_cadence`. Dataset cadence must match one listed metric. */
  expected_cadence: string;
};

export type CheckResult = { ok: true; errors: [] } | { ok: false; errors: string[] };

export type CheckCatalogueOptions = {
  /** Release ids already published must still be present with the same content. */
  baselineDir?: string;
  /** Defaults to `src/lib/metrics.ts`. Fixtures pass a smaller list. */
  metrics?: readonly CatalogueMetricRef[];
  /** When true, the file must list every attribution source slug. Default true. */
  fullRegistry?: boolean;
};

function sourceIdsOf(metric: CatalogueMetricRef): readonly string[] {
  return typeof metric.source_id === "string" ? [metric.source_id] : metric.source_id;
}

function registryMetrics(): CatalogueMetricRef[] {
  return Object.values(METRICS).map((metric) => ({
    metric_id: metric.metric_id,
    dataset_id: metric.dataset_id,
    source_id: metric.source_id,
    expected_cadence: metric.expected_cadence,
  }));
}

function fail(errors: string[]): CheckResult {
  return { ok: false, errors };
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const seen = new Set(left);
  return right.every((value) => seen.has(value));
}

export function releaseChanges(
  baseline: readonly CatalogueReleaseLine[],
  candidate: readonly CatalogueReleaseLine[],
): string[] {
  const errors: string[] = [];
  const byId = new Map<string, CatalogueReleaseLine>();
  for (const record of candidate) {
    const id = record.release.source_release_id;
    const previous = byId.get(id);
    if (previous) {
      errors.push(`duplicate source_release_id ${id}`);
      continue;
    }
    byId.set(id, record);
  }
  for (const record of baseline) {
    const id = record.release.source_release_id;
    const next = byId.get(id);
    if (!next) {
      errors.push(`source_release_id ${id} was removed`);
      continue;
    }
    if (next.line !== record.line) {
      errors.push(`source_release_id ${id} is not the committed line`);
    }
  }
  return errors;
}

function checkSources(sources: readonly CatalogueSource[], fullRegistry: boolean): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.source_id)) {
      errors.push(`duplicate source_id ${source.source_id}`);
    }
    seen.add(source.source_id);
    if (source.licence.trim().length === 0 || source.licence_url.trim().length === 0) {
      errors.push(`${source.source_id}: missing licence`);
    }
    if (source.attribution.trim().length === 0) {
      errors.push(`${source.source_id}: missing attribution`);
    }
  }
  if (fullRegistry && !sameMembers(sources.map((source) => source.source_id), DATA_SOURCE_IDS)) {
    errors.push(
      `sources.json must list ${DATA_SOURCE_IDS.join(", ")} and no other source_id`,
    );
  }
  if (!sameMembers([...CATALOGUE_SOURCE_IDS], [...DATA_SOURCE_IDS])) {
    errors.push("CATALOGUE_SOURCE_IDS drifted from DATA_SOURCE_IDS");
  }
  return errors;
}

function checkDatasets(
  datasets: readonly CatalogueDataset[],
  sources: readonly CatalogueSource[],
  metrics: readonly CatalogueMetricRef[],
): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(sources.map((source) => source.source_id));
  const datasetIds = new Set<string>();
  const metricOwners = new Map<string, string>();

  for (const dataset of datasets) {
    if (datasetIds.has(dataset.dataset_id)) {
      errors.push(`duplicate dataset_id ${dataset.dataset_id}`);
    }
    datasetIds.add(dataset.dataset_id);
    const expectedId = catalogueDatasetId(dataset.source_id, dataset.catalogue_key);
    if (dataset.dataset_id !== expectedId) {
      errors.push(`${dataset.dataset_id}: dataset_id must be ${expectedId}`);
    }
    if (!sourceIds.has(dataset.source_id)) {
      errors.push(
        `dangling reference: dataset ${dataset.dataset_id} points at missing source ${dataset.source_id}`,
      );
    }
    if (
      dataset.source_id === "national-gas" &&
      !NATIONAL_GAS_PUBLICATION_ID.test(dataset.catalogue_key)
    ) {
      errors.push(
        `${dataset.dataset_id}: National Gas catalogue_key must be the portal publicationId, for example PUBOB603`,
      );
    }
    if (new Set(dataset.metric_ids).size !== dataset.metric_ids.length) {
      errors.push(`${dataset.dataset_id}: duplicate metric_ids`);
    }
    for (const metricId of dataset.metric_ids) {
      const owner = metricOwners.get(metricId);
      if (owner) {
        errors.push(`metric ${metricId} is listed on both ${owner} and ${dataset.dataset_id}`);
      } else {
        metricOwners.set(metricId, dataset.dataset_id);
      }
    }
    const listed = metrics.filter((metric) => dataset.metric_ids.includes(metric.metric_id));
    if (listed.length > 0 && listed.every((metric) => metric.expected_cadence !== dataset.cadence)) {
      const expected = [...new Set(listed.map((metric) => metric.expected_cadence))].join(", ");
      errors.push(
        `${dataset.dataset_id}: cadence ${dataset.cadence} does not match expected_cadence ${expected}`,
      );
    }
  }

  for (const metric of metrics) {
    const sourceIdsForMetric = sourceIdsOf(metric);
    const matches = datasets.filter(
      (dataset) =>
        dataset.catalogue_key === metric.dataset_id &&
        sourceIdsForMetric.includes(dataset.source_id),
    );
    if (matches.length === 0) {
      errors.push(
        `dangling reference: metric ${metric.metric_id} has no dataset for catalogue key ${metric.dataset_id}`,
      );
      continue;
    }
    if (matches.length > 1) {
      errors.push(`metric ${metric.metric_id} matches more than one dataset`);
      continue;
    }
    const dataset = matches[0];
    if (!dataset || !dataset.metric_ids.includes(metric.metric_id)) {
      errors.push(
        `dangling reference: dataset ${dataset?.dataset_id ?? metric.dataset_id} does not list ${metric.metric_id}`,
      );
    }
  }

  for (const [metricId, datasetId] of metricOwners) {
    if (!metrics.some((metric) => metric.metric_id === metricId)) {
      errors.push(`dangling reference: dataset ${datasetId} lists unknown metric ${metricId}`);
    }
  }

  return errors;
}

function checkReleases(
  releases: readonly CatalogueReleaseLine[],
  datasets: readonly CatalogueDataset[],
): string[] {
  const errors: string[] = [];
  const datasetIds = new Set(datasets.map((dataset) => dataset.dataset_id));
  const seen = new Set<string>();
  const covered = new Set<string>();

  for (const record of releases) {
    const release = record.release;
    if (seen.has(release.source_release_id)) {
      errors.push(`duplicate source_release_id ${release.source_release_id}`);
    }
    seen.add(release.source_release_id);
    const expectedId = catalogueReleaseId(
      release.dataset_id,
      release.published_at,
      release.content_hash,
    );
    if (release.source_release_id !== expectedId) {
      errors.push(`${release.source_release_id}: source_release_id must be ${expectedId}`);
    }
    if (sha256Prefixed(release.content) !== release.content_hash) {
      errors.push(`${release.source_release_id}: content_hash does not match content`);
    }
    if (!datasetIds.has(release.dataset_id)) {
      errors.push(
        `dangling reference: source release ${release.source_release_id} points at missing dataset ${release.dataset_id}`,
      );
      continue;
    }
    covered.add(release.dataset_id);
  }

  for (const dataset of datasets) {
    if (!covered.has(dataset.dataset_id)) {
      errors.push(`${dataset.dataset_id}: no source release`);
    }
  }

  return errors;
}

function checkRuns(
  runs: readonly IngestionRun[],
  datasets: readonly CatalogueDataset[],
  releases: readonly CatalogueReleaseLine[],
): string[] {
  const errors: string[] = [];
  const datasetIds = new Set(datasets.map((dataset) => dataset.dataset_id));
  const releasesById = new Map(releases.map((record) => [record.release.source_release_id, record.release]));
  const seen = new Set<string>();
  for (const run of runs) {
    if (seen.has(run.ingestion_run_id)) {
      errors.push(`duplicate ingestion_run_id ${run.ingestion_run_id}`);
    }
    seen.add(run.ingestion_run_id);
    if (!datasetIds.has(run.dataset_id)) {
      errors.push(
        `dangling reference: ingestion run ${run.ingestion_run_id} points at missing dataset ${run.dataset_id}`,
      );
    }
    if (run.source_release_id !== null) {
      const release = releasesById.get(run.source_release_id);
      if (!release) {
        errors.push(
          `dangling reference: ingestion run ${run.ingestion_run_id} points at missing source release ${run.source_release_id}`,
        );
      } else if (release.dataset_id !== run.dataset_id) {
        errors.push(
          `ingestion run ${run.ingestion_run_id} release ${run.source_release_id} belongs to ${release.dataset_id}, not ${run.dataset_id}`,
        );
      }
    }
    const status = run.status;
    switch (status) {
      case "succeeded":
      case "failed":
      case "partial":
        break;
      default: {
        const neverStatus: never = status;
        errors.push(`ingestion run ${run.ingestion_run_id} has unknown status ${neverStatus}`);
      }
    }
  }
  return errors;
}

export function checkCatalogue(dir: string, options: CheckCatalogueOptions = {}): CheckResult {
  const loaded = loadCatalogue(dir);
  const parseErrors = catalogueErrors(loaded);
  if (!loaded.sources.ok || !loaded.datasets.ok || !loaded.releases.ok || !loaded.runs.ok) {
    return fail(parseErrors);
  }

  const metrics = options.metrics ?? registryMetrics();
  const fullRegistry = options.fullRegistry ?? true;
  const errors = [
    ...checkSources(loaded.sources.data, fullRegistry),
    ...checkDatasets(loaded.datasets.data, loaded.sources.data, metrics),
    ...checkReleases(loaded.releases.data, loaded.datasets.data),
    ...checkRuns(loaded.runs.data, loaded.datasets.data, loaded.releases.data),
  ];

  if (options.baselineDir) {
    const baseline = loadCatalogue(options.baselineDir);
    if (!baseline.releases.ok) {
      errors.push(...baseline.releases.errors.map((error) => `baseline ${error}`));
    } else {
      errors.push(...releaseChanges(baseline.releases.data, loaded.releases.data));
    }
  }

  errors.push(
    ...checkAssetFiles(
      dir,
      loaded.releases.data.map((record) => record.release),
      loaded.datasets.data,
    ),
  );
  errors.push(...checkLayerCatalogue(dir, { required: fullRegistry }));
  errors.push(...checkLinkFiles(dir, { required: fullRegistry }));

  if (errors.length > 0) {
    return fail(errors);
  }
  return { ok: true, errors: [] };
}
