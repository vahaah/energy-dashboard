import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bakeTabularFigures } from "@/lib/og/tabular-font";

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
};

export async function loadOgFonts(): Promise<OgFont[]> {
  const sans = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const mono = join(process.cwd(), "node_modules/geist/dist/fonts/geist-mono");
  const [regular, medium, semibold, monoRegular] = await Promise.all([
    readFile(join(sans, "Geist-Regular.ttf")),
    readFile(join(sans, "Geist-Medium.ttf")),
    readFile(join(sans, "Geist-SemiBold.ttf")),
    readFile(join(mono, "GeistMono-Regular.ttf")),
  ]);

  return [
    {
      name: "Geist",
      data: toArrayBuffer(regular),
      weight: 400,
      style: "normal",
    },
    {
      name: "Geist",
      data: toArrayBuffer(medium),
      weight: 500,
      style: "normal",
    },
    {
      name: "Geist",
      data: toArrayBuffer(semibold),
      weight: 600,
      style: "normal",
    },
    {
      name: "Geist Mono",
      data: toArrayBuffer(monoRegular),
      weight: 400,
      style: "normal",
    },
  ];
}

function toArrayBuffer(file: Buffer): ArrayBuffer {
  const baked = bakeTabularFigures(file);
  const copy = new ArrayBuffer(baked.byteLength);
  new Uint8Array(copy).set(baked);
  return copy;
}
