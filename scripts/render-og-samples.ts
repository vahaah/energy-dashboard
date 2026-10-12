import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderOgImageResponse } from "../src/lib/og/response";
import {
  fixtureOgSnapshot,
  ogSampleFilename,
  realisticOgSnapshot,
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

  const realistic = await renderOgImageResponse(
    { kind: "focus", focus: "overview" },
    realisticOgSnapshot()
  );
  await writeFile(
    join(outDir, "focus-overview-realistic.png"),
    Buffer.from(await realistic.arrayBuffer())
  );
}

void main();
