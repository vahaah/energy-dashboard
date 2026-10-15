import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TODAY_MAP_MAX_BYTES } from "../src/lib/map/today-card";
import { renderTodayMapCard, todayMapOutputsCurrent } from "../src/lib/map/today-card-build";

const force = process.argv.includes("--force");
if (!force && todayMapOutputsCurrent()) {
  console.log("today map card matches the catalogue release");
  process.exit(0);
}

const rendered = renderTodayMapCard();
for (const image of [rendered.light, rendered.dark]) {
  if (image.png.byteLength > TODAY_MAP_MAX_BYTES) {
    throw new Error(`today map image is ${image.png.byteLength} bytes, over ${TODAY_MAP_MAX_BYTES}`);
  }
}

const manifestPath = resolve("src/lib/map/today-card.json");
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(rendered.manifest, null, 2)}\n`);
writePublicPng(rendered.manifest.light, rendered.light.png);
writePublicPng(rendered.manifest.dark, rendered.dark.png);
console.log(
  `wrote ${rendered.manifest.light} (${rendered.light.png.byteLength} bytes) and ${rendered.manifest.dark} (${rendered.dark.png.byteLength} bytes) for ${rendered.manifest.count} stations`,
);

function writePublicPng(urlPath: string, bytes: Uint8Array): void {
  const path = resolve(`public${urlPath}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}
