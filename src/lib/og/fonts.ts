import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

export async function loadOgFonts(): Promise<OgFont[]> {
  const sans = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [regular, semibold] = await Promise.all([
    readFile(join(sans, "Geist-Regular.ttf")),
    readFile(join(sans, "Geist-SemiBold.ttf")),
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
      data: toArrayBuffer(semibold),
      weight: 600,
      style: "normal",
    },
  ];
}

function toArrayBuffer(file: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(file.byteLength);
  new Uint8Array(copy).set(file);
  return copy;
}
