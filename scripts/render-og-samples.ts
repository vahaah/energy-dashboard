import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderOgImageResponse } from "../src/lib/og/response";
import {
  fixtureOgSnapshot,
  ogSampleFilename,
  sampleOgVariants,
} from "../src/lib/og/model";

const outDir = join(process.cwd(), "public/og-samples");

async function main() {
  await mkdir(outDir, { recursive: true });
  const snapshot = fixtureOgSnapshot();

  for (const variant of sampleOgVariants()) {
    const image = await renderOgImageResponse(variant, snapshot);
    const bytes = Buffer.from(await image.arrayBuffer());
    const file = join(outDir, ogSampleFilename(variant));
    await writeFile(file, bytes);
  }
}

void main();
