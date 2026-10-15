import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  loadNationalGasCatalogue,
  NATIONAL_GAS_CATALOGUE_LAST_CHANGE,
  NATIONAL_GAS_CATALOGUE_SHA256,
  NATIONAL_GAS_CATALOGUE_VERSION,
  nationalGasDir,
} from "@/lib/ingest/national-gas/catalogue";
import { readFixtureHeader } from "@/lib/ingest/national-gas/csv";
import { GAS_PUBLICATION_IDS, gasPublication } from "@/lib/ingest/national-gas/publications";
import { GAS_NULL_BEHAVIOUR, GAS_QUANTITY_KINDS } from "@/lib/ingest/national-gas/quantity";
import { gasReleaseSchema } from "@/lib/ingest/national-gas/release";

const dateFormatSchema = z
  .object({
    publication_id: z.literal("PUBOB2042"),
    probed_at: z.string().min(1),
    endpoint: z.string().url(),
    results: z
      .array(
        z
          .object({
            format: z.string().min(1),
            dateFrom: z.string().min(1),
            dateTo: z.string().min(1),
            length: z.number().nullable(),
            http: z.number(),
            content_type: z.string().min(1),
            works: z.boolean(),
            data_rows: z.number().int().nonnegative(),
            note: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

const instantaneousFlowSchema = z
  .object({
    needs_login: z.boolean(),
    probed_at: z.string().min(1),
    skipped_parser: z.literal(true),
    reason: z.string().min(1),
    endpoints: z.array(
      z
        .object({
          method: z.literal("GET"),
          url: z.string().url(),
          http: z.number(),
          content_type: z.string().min(1).optional(),
          body: z.record(z.string(), z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const HEADER_FIELDS = [
  "publication_id",
  "catalogue_version",
  "unit",
  "quantity_kind",
  "gas_day",
  "null_behaviour",
] as const;

export function gasFixtureDir(cwd = process.cwd()): string {
  return join(cwd, "tests/fixtures/gas/csv");
}

export function gasReleasePath(cwd = process.cwd()): string {
  return join(cwd, "tests/fixtures/gas/release.json");
}

/** Checked-in spike. A publication id outside the validated list fails. */
export function checkNationalGasSpike(
  gasDir = nationalGasDir(),
  fixtureDir = gasFixtureDir(),
  releasePath = gasReleasePath(),
): string[] {
  const errors: string[] = [];
  let catalogue;
  try {
    catalogue = loadNationalGasCatalogue(gasDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`national-gas catalogue: ${message}`];
  }

  if (catalogue.sha256 !== NATIONAL_GAS_CATALOGUE_SHA256) {
    errors.push(`catalogue sha256 ${catalogue.sha256} is not the downloaded catalogue`);
  }
  if (catalogue.catalogueVersion !== NATIONAL_GAS_CATALOGUE_VERSION) {
    errors.push(`catalogueVersion ${catalogue.catalogueVersion} is not ${NATIONAL_GAS_CATALOGUE_VERSION}`);
  }
  if (catalogue.lastChangeDate !== NATIONAL_GAS_CATALOGUE_LAST_CHANGE) {
    errors.push(`lastChangeDate ${catalogue.lastChangeDate} is not ${NATIONAL_GAS_CATALOGUE_LAST_CHANGE}`);
  }

  const ids = catalogue.rows.map((row) => row.publicationId);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) {
    errors.push("catalogue rows repeat a publication id");
  }
  for (const id of ids) {
    if (!GAS_PUBLICATION_IDS.includes(id)) {
      errors.push(`synthetic publication ${id} is not in the validated id list`);
    }
  }
  for (const id of GAS_PUBLICATION_IDS) {
    if (!idSet.has(id)) {
      errors.push(`catalogue is missing ${id}`);
    }
  }

  errors.push(...checkDateFormat(gasDir));
  errors.push(...checkInstantaneousFlow(gasDir));

  let files: string[] = [];
  try {
    files = readdirSync(fixtureDir).filter((name) => name.endsWith(".csv")).sort();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`gas fixtures: ${message}`);
    return errors;
  }

  const fileIds = new Set(files.map((name) => name.replace(/\.csv$/, "")));
  for (const id of GAS_PUBLICATION_IDS) {
    if (!fileIds.has(id)) {
      errors.push(`missing fixture ${id}.csv`);
    }
  }
  for (const name of files) {
    const text = readFileSync(join(fixtureDir, name), "utf8");
    errors.push(...checkFixture(name, text, catalogue.rows));
  }

  errors.push(...checkReleaseFile(releasePath));
  return errors;
}

function checkFixture(
  fileName: string,
  text: string,
  rows: readonly { publicationId: string; unitOfMeasure: string }[],
): string[] {
  const errors: string[] = [];
  const header = readFixtureHeader(text);
  for (const field of HEADER_FIELDS) {
    if (!header[field]?.trim()) {
      errors.push(`${fileName}: missing ${field}`);
    }
  }
  const id = header.publication_id ?? "";
  if (fileName !== `${id}.csv`) {
    errors.push(`${fileName}: publication_id ${id} does not match the file name`);
  }
  if (!GAS_PUBLICATION_IDS.includes(id)) {
    errors.push(`${fileName}: synthetic publication ${id} is not in the validated id list`);
    return errors;
  }
  const publication = gasPublication(id);
  const catalogueRow = rows.find((row) => row.publicationId === id);
  if (!catalogueRow || !publication) {
    errors.push(`${fileName}: ${id} is missing from the catalogue slice`);
    return errors;
  }
  if (header.catalogue_version !== NATIONAL_GAS_CATALOGUE_VERSION) {
    errors.push(`${fileName}: catalogue_version does not match ${NATIONAL_GAS_CATALOGUE_VERSION}`);
  }
  if (header.unit !== catalogueRow.unitOfMeasure) {
    errors.push(`${fileName}: unit ${header.unit} does not match catalogue ${catalogueRow.unitOfMeasure}`);
  }
  if (!(GAS_QUANTITY_KINDS as readonly string[]).includes(header.quantity_kind ?? "")) {
    errors.push(`${fileName}: unknown quantity_kind ${header.quantity_kind}`);
  } else if (header.quantity_kind !== publication.quantity_kind) {
    errors.push(`${fileName}: quantity_kind ${header.quantity_kind} does not match ${publication.quantity_kind}`);
  }
  if (header.null_behaviour !== GAS_NULL_BEHAVIOUR) {
    errors.push(`${fileName}: null_behaviour does not match the parser contract`);
  }
  if (!header.gas_day?.includes("05:00")) {
    errors.push(`${fileName}: gas_day comment must state the 05:00 boundary`);
  }
  return errors;
}

function checkDateFormat(gasDir: string): string[] {
  try {
    const parsed = dateFormatSchema.parse(JSON.parse(readFileSync(join(gasDir, "date-format.json"), "utf8")));
    const timestamp = parsed.results.find((result) => result.length === 19);
    if (!timestamp?.works) {
      return ["date-format.json: the 19-character timestamp probe did not work"];
    }
    const calendar = parsed.results.find((result) => result.format === "YYYY-MM-DD");
    if (!calendar) {
      return ["date-format.json: missing the YYYY-MM-DD probe"];
    }
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`date-format.json: ${message}`];
  }
}

function checkInstantaneousFlow(gasDir: string): string[] {
  try {
    instantaneousFlowSchema.parse(JSON.parse(readFileSync(join(gasDir, "instantaneous-flow.json"), "utf8")));
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`instantaneous-flow.json: ${message}`];
  }
}

export function checkReleaseFile(releasePath: string): string[] {
  try {
    return checkGasRelease(readFileSync(releasePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`gas release: ${message}`];
  }
}

export function checkGasRelease(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`gas release: ${message}`];
  }
  const result = gasReleaseSchema.safeParse(parsed);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.message);
}
