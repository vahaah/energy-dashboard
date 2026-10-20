/**
 * Stamp REPD region onto data/catalogue/energy_projects.ndjson.
 *
 *   npx tsx scripts/catalogue/project-regions.ts data/catalogue/raw/repd.csv
 *
 * TEC-only rows stay region null. The raw extract is not committed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanCountry, parseCsv } from "../../src/lib/catalogue/assets/parse";

const csvPath = process.argv[2];
if (!csvPath) {
  throw new Error("pass the REPD CSV path");
}

const table = parseCsv(readFileSync(resolve(csvPath), "latin1"));
const header = table[0];
if (!header) {
  throw new Error("REPD extract is empty");
}
const refIndex = header.findIndex((cell) => cell.trim() === "Ref ID");
const regionIndex = header.findIndex((cell) => cell.trim() === "Region");
if (refIndex < 0 || regionIndex < 0) {
  throw new Error("REPD extract has no Ref ID or Region column");
}

const regions = new Map<string, string | null>();
for (const row of table.slice(1)) {
  const ref = (row[refIndex] ?? "").trim();
  if (ref.length === 0 || regions.has(ref)) {
    continue;
  }
  regions.set(ref, cleanCountry(row[regionIndex] ?? null));
}

const destination = resolve("data/catalogue/energy_projects.ndjson");
const lines = readFileSync(destination, "utf8").split("\n");
let stamped = 0;
let missing = 0;
const next = lines.map((line) => {
  if (line.trim().length === 0 || line.includes('"region":')) {
    return line;
  }
  const project = JSON.parse(line) as {
    members?: { source_id?: string; external_ref?: string }[];
  };
  const ref = project.members?.find((member) => member.source_id === "desnz-repd")?.external_ref;
  let region: string | null = null;
  if (ref) {
    if (!regions.has(ref)) {
      missing += 1;
    }
    region = regions.get(ref) ?? null;
  }
  stamped += 1;
  return line.replace(
    /"country":(null|"(?:England|Scotland|Wales)")/,
    `"country":$1,"region":${JSON.stringify(region)}`,
  );
});

if (missing > 0) {
  throw new Error(`${missing} REPD project refs were not in the extract`);
}
writeFileSync(destination, next.join("\n"));
console.log(`stamped region on ${stamped} projects`);
