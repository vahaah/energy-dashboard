import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { renderStaticMap, staticMapDimensions, type StaticMapImage } from "@/lib/map/static-map";

const THEME = { sea: "#d0dbe3", land: "#f4f1ea", coast: "#80909c" };

describe("renderStaticMap", () => {
  it("is deterministic for the same bbox and points", () => {
    const first = sample();
    const second = sample();
    expect(Buffer.from(first.png).equals(Buffer.from(second.png))).toBe(true);
  });

  it("fills land, keeps the sea, and paints a point in its own colour", () => {
    const image = sample();
    const decoded = decodeIndexedPng(image.png);
    expect(decoded.width).toBe(image.width);
    expect(decoded.height).toBe(image.height);
    expect(colorAt(decoded, 0, 0)).toBe(THEME.sea);
    const center = decoded.indices[Math.floor(decoded.height / 2) * decoded.width + Math.floor(decoded.width / 2)];
    expect(decoded.palette[center ?? 0]).toBe("#e06814");
    const bare = renderStaticMap({
      bbox: [0, 0, 10, 10],
      width: 80,
      height: 80,
      padding: 4,
      theme: THEME,
      rings: [
        [
          [1, 1],
          [9, 1],
          [9, 9],
          [1, 9],
        ],
      ],
      points: [],
    });
    const bareDecoded = decodeIndexedPng(bare.png);
    const middle = bareDecoded.indices[40 * 80 + 40];
    expect(bareDecoded.palette[middle ?? 0]).toBe(THEME.land);
  });

  it("fills a triangle and leaves the square's corner empty", () => {
    const image = renderStaticMap({
      bbox: [0, 0, 10, 10],
      width: 40,
      height: 40,
      padding: 2,
      theme: THEME,
      points: [{ longitude: 5, latitude: 5, color: "#0d94d2", radius: 8, shape: "triangle", filled: true }],
    });
    const decoded = decodeIndexedPng(image.png);
    const center = Math.floor(decoded.width / 2);
    const above = colorAt(decoded, center, center - 4);
    const corner = colorAt(decoded, center - 6, center + 6);
    expect(above).toBe("#0d94d2");
    expect(corner).not.toBe("#0d94d2");
  });

  it("sizes the frame from the bbox without stretching longitude", () => {
    expect(staticMapDimensions([-4, 50, 2, 59], 100).height).toBe(100);
    expect(staticMapDimensions([-4, 50, 2, 59], 100).width).toBeLessThan(100);
  });
});

function sample(): StaticMapImage {
  return renderStaticMap({
    bbox: [0, 0, 10, 10],
    width: 80,
    height: 80,
    padding: 4,
    pointRadius: 4,
    theme: THEME,
    rings: [
      [
        [1, 1],
        [9, 1],
        [9, 9],
        [1, 9],
        [1, 1],
      ],
    ],
    points: [
      { longitude: 5, latitude: 5, color: "#e06814", radius: 3 },
      { longitude: 4, latitude: 6, color: "#0d94d2" },
    ],
  });
}

function colorAt(decoded: DecodedPng, x: number, y: number): string | undefined {
  const index = decoded.indices[y * decoded.width + x];
  return index === undefined ? undefined : decoded.palette[index];
}

type DecodedPng = {
  width: number;
  height: number;
  indices: Uint8Array;
  palette: string[];
};

function decodeIndexedPng(png: Uint8Array): DecodedPng {
  expect(Buffer.from(png.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  let offset = 8;
  let width = 0;
  let height = 0;
  let palette: string[] = [];
  const idat: Uint8Array[] = [];
  while (offset + 8 <= png.length) {
    const length = readUint32(png, offset);
    const type = Buffer.from(png.subarray(offset + 4, offset + 8)).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    switch (type) {
      case "IHDR":
        width = readUint32(data, 0);
        height = readUint32(data, 4);
        expect(data[8]).toBe(8);
        expect(data[9]).toBe(3);
        break;
      case "PLTE":
        palette = [];
        for (let index = 0; index < data.length; index += 3) {
          palette.push(
            `#${hex(data[index] ?? 0)}${hex(data[index + 1] ?? 0)}${hex(data[index + 2] ?? 0)}`,
          );
        }
        break;
      case "IDAT":
        idat.push(data);
        break;
      case "IEND":
        break;
      default:
        break;
    }
  }
  const compressed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of idat) {
    compressed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateSync(compressed);
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    expect(raw[y * (width + 1)]).toBe(0);
    indices.set(raw.subarray(y * (width + 1) + 1, y * (width + 1) + 1 + width), y * width);
  }
  return { width, height, indices, palette };
}

function readUint32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset);
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
