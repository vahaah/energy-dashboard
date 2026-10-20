import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseNdjson } from "../../src/lib/catalogue/load";
import { sourceReleaseSchema } from "../../src/lib/catalogue/schema";
import { PIPELINE_FETCH_ATTEMPTS, PIPELINE_FETCH_TIMEOUT_MS, pipelineRetryDelayMs, pipelineStatusRetries } from "../../src/lib/pipeline/fetch";
import { parseRepdPipeline } from "../../src/lib/pipeline/parse";
import { REPD_PIPELINE_EDITION_FILE, REPD_PIPELINE_FILE, pipelineEditionSchema } from "../../src/lib/pipeline/records";

const DATASET_ID = "desnz-repd:repd-quarterly";

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a path`);
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchExtract(url: string): Promise<Uint8Array> {
  let last: unknown;
  for (let attempt = 1; attempt <= PIPELINE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(PIPELINE_FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        if (!pipelineStatusRetries(response.status) || attempt === PIPELINE_FETCH_ATTEMPTS) {
          throw new Error(`REPD HTTP ${response.status}`);
        }
        last = new Error(`REPD HTTP ${response.status}`);
      } else {
        return new Uint8Array(await response.arrayBuffer());
      }
    } catch (error) {
      last = error;
      if (attempt === PIPELINE_FETCH_ATTEMPTS) {
        break;
      }
    }
    const delay = pipelineRetryDelayMs(attempt);
    if (delay === null) {
      break;
    }
    await sleep(delay);
  }
  const message = last instanceof Error ? last.message : "REPD download failed";
  throw new Error(message);
}

function releaseContent(): {
  source_release_id: string;
  edition: string;
  published_at: string;
  download_url: string;
  extract_sha256: string;
} {
  const text = readFileSync(join(process.cwd(), "data/catalogue/source_releases.ndjson"), "utf8");
  const parsed = parseNdjson(text, "source_releases.ndjson");
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  const releases = parsed.data
    .map((value) => sourceReleaseSchema.parse(value))
    .filter((release) => release.dataset_id === DATASET_ID)
    .sort((left, right) => (right.published_at ?? "").localeCompare(left.published_at ?? ""));
  const release = releases[0];
  if (!release || !release.published_at) {
    throw new Error("REPD quarterly release is missing");
  }
  const content = release.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("REPD release content is missing");
  }
  const record = content as Record<string, unknown>;
  const edition = record.edition;
  const download = record.download_url;
  const hash = record.extract_sha256;
  if (typeof edition !== "string" || typeof download !== "string" || typeof hash !== "string") {
    throw new Error("REPD release content is incomplete");
  }
  return {
    source_release_id: release.source_release_id,
    edition,
    published_at: release.published_at,
    download_url: download,
    extract_sha256: hash,
  };
}

async function readBytes(content: { download_url: string; extract_sha256: string }): Promise<Uint8Array> {
  const file = arg("--file");
  const offline = process.argv.includes("--offline");
  if (file) {
    return new Uint8Array(readFileSync(file));
  }
  if (offline) {
    const name = new URL(content.download_url).pathname.split("/").pop();
    if (!name) {
      throw new Error("REPD download URL has no file name");
    }
    return new Uint8Array(readFileSync(join(process.cwd(), "data/catalogue/raw", name)));
  }
  return fetchExtract(content.download_url);
}

async function main(): Promise<void> {
  const content = releaseContent();
  const bytes = await readBytes(content);
  const hash = sha256(bytes);
  if (hash !== content.extract_sha256) {
    throw new Error("REPD extract sha256 does not match the catalogue release");
  }
  const records = parseRepdPipeline(Buffer.from(bytes).toString("latin1"));
  const edition = pipelineEditionSchema.parse({
    catalogue_schema_version: 1,
    source_release_id: content.source_release_id,
    edition: content.edition,
    published_at: content.published_at,
    edition_day: content.published_at.slice(0, 10),
    extract_sha256: content.extract_sha256,
    row_count: records.length,
  });
  const dir = join(process.cwd(), "data/catalogue");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, REPD_PIPELINE_EDITION_FILE), `${JSON.stringify(edition, null, 2)}\n`);
  writeFileSync(join(dir, REPD_PIPELINE_FILE), records.map((record) => JSON.stringify(record)).join("\n") + "\n");
  console.log(`pipeline extract ${records.length} rows ${content.edition}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "pipeline extract failed";
  console.error(message);
  process.exit(1);
});
