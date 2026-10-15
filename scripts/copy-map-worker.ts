import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(fileURLToPath(import.meta.url));
const source = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
const target = resolve(process.cwd(), "public/maplibre/maplibre-gl-worker.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
