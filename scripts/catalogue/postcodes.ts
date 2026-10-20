/**
 * Build the GB postcode lookup from the ONS National Statistics Postcode Lookup.
 *
 *   npx tsx scripts/catalogue/postcodes.ts
 *   npx tsx scripts/catalogue/postcodes.ts --offline
 *
 * `--offline` reads data/catalogue/raw/nspl/, which is gitignored, and fails
 * if that cache is missing. It does not fall through to HTTP. The script
 * never prints a postcode or BLOB_READ_WRITE_TOKEN. Upload runs only when
 * the token is set.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fetchBounded } from "../../src/lib/postcode/http";
import { buildPostcodeLookup } from "../../src/lib/postcode/build";
import { postcodeStore } from "../../src/lib/postcode/blob";
import {
  NSPL_BYTES,
  NSPL_DOWNLOAD_URL,
  NSPL_EDITION,
  NSPL_ITEM_ID,
  NSPL_LICENCE_PAGE,
  NSPL_LICENCE_READ_ON,
  NSPL_PUBLISHED_AT,
  NSPL_RELEASE_CONTENT,
  commitPostcodeEdition,
} from "../../src/lib/postcode/catalogue";
import { DNO_GEOJSON_PATH, indexCarbonRegions, indexDnoAreas } from "../../src/lib/postcode/layers";
import { publishPostcodeRelease } from "../../src/lib/postcode/publish";
import { catalogueReleaseId } from "../../src/lib/catalogue/schema";
import { sha256Prefixed } from "../../src/lib/catalogue/canonical";
import { POSTCODE_DATASET_ID } from "../../src/lib/postcode/rows";
import type { GeoJsonFeatureCollection } from "../../src/lib/postcode/geometry";

const RAW = resolve(process.cwd(), "data/catalogue/raw/nspl");
const ITEM_URL = `https://www.arcgis.com/sharing/rest/content/items/${NSPL_ITEM_ID}?f=json`;
const DOWNLOAD_TIMEOUT_MS = 300_000;

function redact(message: string): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  if (token.length === 0) {
    return message;
  }
  return message.split(token).join("[redacted]");
}

function fail(message: string): never {
  throw new Error(redact(message));
}

type EditionFile = {
  published_at: string;
  bytes: number;
  item_id: string;
  download_url: string;
};

function editionPath(): string {
  return resolve(RAW, "edition.json");
}

function readEdition(): EditionFile {
  const path = editionPath();
  if (!existsSync(path)) {
    fail(`offline NSPL cache is missing ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as EditionFile;
}

function writeEdition(edition: EditionFile): void {
  mkdirSync(RAW, { recursive: true });
  writeFileSync(editionPath(), `${JSON.stringify(edition, null, 2)}\n`);
}

async function downloadZip(offline: boolean): Promise<{ zip: string; edition: EditionFile }> {
  mkdirSync(RAW, { recursive: true });
  if (offline) {
    const zip = findZip();
    if (!zip) {
      fail(`offline NSPL cache is missing a zip in ${RAW}`);
    }
    return { zip, edition: readEdition() };
  }
  const response = await fetchBounded(ITEM_URL, { timeoutMs: 10_000 });
  const item = (await response.json()) as { modified?: number; size?: number };
  if (typeof item.modified !== "number" || typeof item.size !== "number") {
    fail("NSPL item JSON has no modified time or size");
  }
  const publishedAt = new Date(item.modified).toISOString();
  const edition: EditionFile = {
    published_at: publishedAt,
    bytes: item.size,
    item_id: NSPL_ITEM_ID,
    download_url: NSPL_DOWNLOAD_URL,
  };
  writeEdition(edition);
  const zip = resolve(RAW, "NSPL_AUG_2026.zip");
  if (!existsSync(zip) || statSync(zip).size !== item.size) {
    const file = await fetchBounded(NSPL_DOWNLOAD_URL, { timeoutMs: DOWNLOAD_TIMEOUT_MS });
    const bytes = Buffer.from(await file.arrayBuffer());
    writeFileSync(zip, bytes);
  }
  return { zip, edition };
}

function findZip(): string | null {
  if (!existsSync(RAW)) {
    return null;
  }
  const zips = readdirSync(RAW).filter((name) => name.endsWith(".zip"));
  const first = zips[0];
  return first ? resolve(RAW, first) : null;
}

function unzipList(zip: string): Promise<string[]> {
  return new Promise((resolveList, reject) => {
    const child = spawn("unzip", ["-Z1", zip]);
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      err += chunk;
    });
    child.on("error", () => reject(new Error("unzip is required")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(redact(err || `unzip exited ${code}`)));
        return;
      }
      resolveList(
        out
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.endsWith(".csv")),
      );
    });
  });
}

function unzipText(zip: string, entry: string): Promise<string> {
  return new Promise((resolveText, reject) => {
    const child = spawn("unzip", ["-p", zip, entry], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      err += chunk;
    });
    child.on("error", () => reject(new Error("unzip is required")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(redact(err || `unzip exited ${code}`)));
        return;
      }
      resolveText(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

function unzipFirstLine(zip: string, entry: string): Promise<string> {
  return new Promise((resolveLine, reject) => {
    const child = spawn("unzip", ["-p", zip, entry], { stdio: ["ignore", "pipe", "pipe"] });
    let line = "";
    let settled = false;
    const finish = (value: string) => {
      if (settled) {
        return;
      }
      settled = true;
      resolveLine(value);
    };
    const onData = (chunk: Buffer) => {
      line += chunk.toString("utf8");
      const newline = line.indexOf("\n");
      if (newline >= 0) {
        child.stdout.off("data", onData);
        child.kill();
        finish(line.slice(0, newline).replace(/\r$/, ""));
      }
    };
    child.stdout.on("data", onData);
    child.on("error", () => {
      if (!settled) {
        settled = true;
        reject(new Error("unzip is required"));
      }
    });
    child.on("close", () => {
      finish(line.replace(/\r$/, ""));
    });
  });
}

function unzipLines(zip: string, entry: string): AsyncIterable<string> {
  const child = spawn("unzip", ["-p", zip, entry], { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    err += chunk;
  });
  const closed = new Promise<number | null>((resolveCode) => {
    child.on("close", resolveCode);
  });
  const lines = createInterface({ input: child.stdout });
  return {
    async *[Symbol.asyncIterator]() {
      yield* lines;
      const code = await closed;
      if (code !== 0 && code !== null) {
        throw new Error(redact(err || `unzip exited ${code}`));
      }
    },
  };
}

async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolveHash, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash());
  });
  return `sha256:${hash.digest("hex")}`;
}

async function chooseEntries(zip: string): Promise<{ postcodes: string; names: string }> {
  const entries = await unzipList(zip);
  let postcodes: string | null = null;
  let names: string | null = null;
  for (const entry of entries) {
    const header = (await unzipFirstLine(zip, entry)).toLowerCase();
    if (header.includes("pcds") && header.includes("doterm") && header.includes("lat")) {
      postcodes = entry;
    } else if (/lad\d*cd/.test(header) && /lad\d*nm/.test(header)) {
      names = entry;
    }
  }
  if (!postcodes || !names) {
    fail("NSPL zip has no postcode CSV or authority names CSV");
  }
  return { postcodes, names };
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  const { zip, edition } = await downloadZip(offline);
  const extractSha = await fileSha256(zip);
  const entries = await chooseEntries(zip);
  const names = await unzipText(zip, entries.names);
  const collection = JSON.parse(readFileSync(resolve(process.cwd(), DNO_GEOJSON_PATH), "utf8")) as GeoJsonFeatureCollection;
  const built = await buildPostcodeLookup({
    postcodeLines: unzipLines(zip, entries.postcodes),
    authorityNamesCsv: names,
    dno: indexDnoAreas(collection),
    ci: indexCarbonRegions(collection),
    keepRows: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
  const content = {
    ...NSPL_RELEASE_CONTENT,
    edition: edition.published_at === NSPL_PUBLISHED_AT ? NSPL_EDITION : edition.published_at.slice(0, 10),
    bytes: edition.bytes || NSPL_BYTES,
    download_url: edition.download_url,
    item_id: edition.item_id,
    licence_read_on: NSPL_LICENCE_READ_ON,
    licence_url: NSPL_LICENCE_PAGE,
    extract_sha256: extractSha,
  };
  let uploaded = false;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const releaseId = catalogueReleaseId(POSTCODE_DATASET_ID, edition.published_at, sha256Prefixed(content));
    await publishPostcodeRelease(postcodeStore(), releaseId, built.rows, new Date().toISOString());
    commitPostcodeEdition(resolve(process.cwd(), "data/catalogue"), content, edition.published_at);
    uploaded = true;
  }
  console.info(
    `postcode lookup: current=${built.stats.current} terminated=${built.stats.terminated} omitted=${built.stats.omitted} quarantined=${built.stats.quarantined} uploaded=${uploaded}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "postcode lookup failed";
  console.error(redact(message));
  process.exitCode = 1;
});
