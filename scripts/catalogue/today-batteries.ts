/**
 * Operating GB battery pins for the Today map.
 *
 *   npx tsx scripts/catalogue/today-batteries.ts data/catalogue/raw/repd.csv
 *
 * Writes src/lib/map/today-batteries.json. The raw extract is not committed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanCountry, cleanName, parseCsv, parseNumber } from "../../src/lib/catalogue/assets/parse";
import { osgbToWgs84 } from "../../src/lib/catalogue/assets/osgb";

const csvPath = process.argv[2];
if (!csvPath) {
  throw new Error("pass the REPD CSV path");
}

const GB = new Set(["England", "Scotland", "Wales"]);

const table = parseCsv(readFileSync(resolve(csvPath), "latin1"));
const header = table[0];
if (!header) {
  throw new Error("REPD extract is empty");
}

function column(name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

const refIndex = column("Ref ID");
const nameIndex = column("Site Name");
const technologyIndex = column("Technology Type");
const capacityIndex = column("Installed Capacity (MWelec)");
const statusIndex = column("Development Status (short)");
const countryIndex = column("Country");
const regionIndex = column("Region");
const eastingIndex = column("X-coordinate");
const northingIndex = column("Y-coordinate");

type BatteryPin = {
  ref: string;
  name: string;
  country: "England" | "Scotland" | "Wales";
  region: string | null;
  mw: number | null;
  longitude: number;
  latitude: number;
};

const sites: BatteryPin[] = [];
let operating = 0;
let unlocated = 0;
for (const row of table.slice(1)) {
  if ((row[technologyIndex] ?? "").trim() !== "Battery") {
    continue;
  }
  const status = (row[statusIndex] ?? "").replace(/\u00a0/g, " ").trim();
  if (status !== "Operational") {
    continue;
  }
  const country = cleanCountry(row[countryIndex] ?? null);
  if (!country || !GB.has(country)) {
    continue;
  }
  operating += 1;
  const easting = parseNumber(row[eastingIndex]);
  const northing = parseNumber(row[northingIndex]);
  const point = easting === null || northing === null ? null : osgbToWgs84(easting, northing);
  if (!point) {
    unlocated += 1;
    continue;
  }
  const ref = (row[refIndex] ?? "").trim();
  sites.push({
    ref,
    name: cleanName(row[nameIndex] ?? "") || ref,
    country: country as BatteryPin["country"],
    region: cleanCountry(row[regionIndex] ?? null),
    mw: parseNumber(row[capacityIndex]),
    longitude: point.longitude,
    latitude: point.latitude,
  });
}

sites.sort((left, right) => left.ref.localeCompare(right.ref, "en", { numeric: true }));
const payload = {
  source_release_id: "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z",
  operating,
  unlocated,
  sites,
};
const destination = resolve("src/lib/map/today-batteries.json");
writeFileSync(destination, `${JSON.stringify(payload)}\n`);
console.log(`${sites.length} battery pins, ${unlocated} operating without a grid reference -> ${destination}`);
