#!/usr/bin/env npx tsx
/**
 * Write the checked-in MapLibre styles, Geist glyph stacks, and empty sprites.
 *
 *   npx tsx scripts/build-basemap-style.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { basemapStyleJson } from "../src/lib/map/basemap-style";
import { writeBasemapGlyphs } from "./basemap/glyphs";
import { writeBasemapSprites } from "./basemap/sprites";

const COPYRIGHT_YEAR = 2026;

function main(): void {
  const repoRoot = process.cwd();
  const directory = resolve(repoRoot, "public/basemap");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "style-light.json"), basemapStyleJson("light", COPYRIGHT_YEAR));
  writeFileSync(join(directory, "style-dark.json"), basemapStyleJson("dark", COPYRIGHT_YEAR));
  writeBasemapSprites(repoRoot);
  writeBasemapGlyphs(repoRoot);
  console.log("wrote public/basemap styles, sprites, and glyphs");
}

main();
