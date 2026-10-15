import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { encodeAssetIndex } from "../src/lib/assets/index-file";
import { loadAssetCatalogue } from "../src/lib/assets/load";

const catalogue = loadAssetCatalogue();
const path = resolve("public/search/assets.json");
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, encodeAssetIndex(catalogue.rows));
console.log(`wrote ${catalogue.rows.length} assets to ${path}`);
