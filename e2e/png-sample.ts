import { inflateSync } from "node:zlib";

export type DecodedPng = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

export type CanvasPalette = {
  samples: number;
  distinct: number;
  nonBackground: number;
};

/** Playwright element screenshots are non-interlaced 8-bit PNG. */
export function decodePng(buffer: Buffer): DecodedPng {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("screenshot is not a png");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const chunks: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      chunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (width === 0 || height === 0) {
    throw new Error("png has no image");
  }
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`unsupported png color type ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let src = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src] ?? 0;
    src += 1;
    const row = Buffer.alloc(stride);
    inflated.copy(row, 0, src, src + stride);
    src += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? (row[index - channels] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const upLeft = index >= channels ? (previous[index - channels] ?? 0) : 0;
      const raw = row[index] ?? 0;
      let value = raw;
      switch (filter) {
        case 0:
          break;
        case 1:
          value = (raw + left) & 255;
          break;
        case 2:
          value = (raw + up) & 255;
          break;
        case 3:
          value = (raw + Math.floor((left + up) / 2)) & 255;
          break;
        case 4: {
          const estimate = left + up - upLeft;
          const pa = Math.abs(estimate - left);
          const pb = Math.abs(estimate - up);
          const pc = Math.abs(estimate - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          value = (raw + predictor) & 255;
          break;
        }
        default:
          throw new Error(`png filter ${filter}`);
      }
      row[index] = value;
    }
    previous = row;
    for (let x = 0; x < width; x += 1) {
      const index = x * channels;
      const output = (y * width + x) * 4;
      pixels[output] = row[index] ?? 0;
      pixels[output + 1] = row[index + 1] ?? 0;
      pixels[output + 2] = row[index + 2] ?? 0;
      pixels[output + 3] = channels === 4 ? (row[index + 3] ?? 255) : 255;
    }
  }
  return { width, height, pixels };
}

/** Quantised colours. The mode is treated as the background wash. */
export function paletteOf(image: DecodedPng): CanvasPalette {
  const step = Math.max(1, Math.floor(Math.min(image.width, image.height) / 80));
  const buckets = new Map<string, number>();
  let samples = 0;
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const offset = (y * image.width + x) * 4;
      const key = `${(image.pixels[offset] ?? 0) >> 3},${(image.pixels[offset + 1] ?? 0) >> 3},${(image.pixels[offset + 2] ?? 0) >> 3}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      samples += 1;
    }
  }
  const ranked = [...buckets.values()].sort((left, right) => right - left);
  const mode = ranked[0] ?? 0;
  const distinct = ranked.filter((count) => count >= Math.max(3, Math.floor(samples * 0.005))).length;
  return { samples, distinct, nonBackground: samples - mode };
}
