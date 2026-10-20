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

export type Rgb = readonly [number, number, number];

export type ImageRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function pixel(image: DecodedPng, x: number, y: number): Rgb {
  const clampedX = Math.max(0, Math.min(image.width - 1, x));
  const clampedY = Math.max(0, Math.min(image.height - 1, y));
  const offset = (clampedY * image.width + clampedX) * 4;
  return [image.pixels[offset] ?? 0, image.pixels[offset + 1] ?? 0, image.pixels[offset + 2] ?? 0];
}

function near(color: Rgb, page: Rgb): boolean {
  return Math.abs(color[0] - page[0]) <= 2 && Math.abs(color[1] - page[1]) <= 2 && Math.abs(color[2] - page[2]) <= 2;
}

function exact(color: Rgb, page: Rgb): boolean {
  return color[0] === page[0] && color[1] === page[1] && color[2] === page[2];
}

function covered(x: number, y: number, exclude: readonly ImageRegion[]): boolean {
  return exclude.some(
    (region) => x >= region.x && y >= region.y && x < region.x + region.width && y < region.y + region.height,
  );
}

/**
 * Land-coloured pixels in the right and bottom bands. A land rectangle that
 * stops short of the sea fill shows up here as a beige or grey strip.
 */
export function landEdgePixels(
  image: DecodedPng,
  land: Rgb,
  tolerance: number,
  exclude: readonly ImageRegion[],
): { right: number; bottom: number } {
  const rightBand = Math.max(8, Math.round(image.width * 0.04));
  const bottomBand = Math.max(6, Math.round(image.height * 0.015));
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = image.width - rightBand; x < image.width; x += 1) {
      if (covered(x, y, exclude)) {
        continue;
      }
      if (closeTo(pixel(image, x, y), land, tolerance)) {
        right += 1;
      }
    }
  }
  for (let y = image.height - bottomBand; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (covered(x, y, exclude)) {
        continue;
      }
      if (closeTo(pixel(image, x, y), land, tolerance)) {
        bottom += 1;
      }
    }
  }
  return { right, bottom };
}

/** Low-chroma ink to the right of an anchor. The coast is bluer, so it does not count. */
export function glyphSpan(
  image: DecodedPng,
  anchorX: number,
  anchorY: number,
  theme: "light" | "dark",
): { width: number; left: number; count: number } | null {
  const x0 = Math.max(0, Math.floor(anchorX - 6));
  const x1 = Math.min(image.width - 1, Math.ceil(anchorX + 72));
  const y0 = Math.max(0, Math.floor(anchorY - 12));
  const y1 = Math.min(image.height - 1, Math.ceil(anchorY + 12));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const [red, green, blue] = pixel(image, x, y);
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const luminance = (red + green + blue) / 3;
      const ink =
        theme === "dark" ? chroma < 16 && luminance > 70 && luminance < 200 : chroma < 16 && luminance > 90 && luminance < 200;
      if (!ink) {
        continue;
      }
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  if (count < 24) {
    return null;
  }
  return { width: maxX - minX + 1, left: minX, count };
}

/** Share of samples inside a square that match `color`. */
export function sampleMatch(
  image: DecodedPng,
  x: number,
  y: number,
  radius: number,
  color: Rgb,
  tolerance: number,
): number {
  let hit = 0;
  let total = 0;
  const x0 = Math.max(0, Math.floor(x - radius));
  const x1 = Math.min(image.width - 1, Math.ceil(x + radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const y1 = Math.min(image.height - 1, Math.ceil(y + radius));
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      total += 1;
      if (closeTo(pixel(image, px, py), color, tolerance)) {
        hit += 1;
      }
    }
  }
  return total === 0 ? 0 : hit / total;
}

/** Every pixel painted the page colour. Controls and the sheet are passed in `exclude`. */
export function pageBackgroundPixels(image: DecodedPng, page: Rgb, exclude: readonly ImageRegion[]): number {
  let count = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (covered(x, y, exclude)) {
        continue;
      }
      if (exact(pixel(image, x, y), page)) {
        count += 1;
      }
    }
  }
  return count;
}

function closeTo(color: Rgb, target: Rgb, tolerance: number): boolean {
  const distance = Math.hypot(color[0] - target[0], color[1] - target[1], color[2] - target[2]);
  return distance <= tolerance;
}

/**
 * Thin axis-aligned runs of one colour. Tile-edge strokes show up as several
 * of these across the sea; a shoreline does not.
 */
export function axisLineRuns(
  image: DecodedPng,
  target: Rgb,
  tolerance: number,
  minLength: number,
): { horizontal: number; vertical: number } {
  const hit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
      return false;
    }
    return closeTo(pixel(image, x, y), target, tolerance);
  };
  const thinRow = (x: number, y: number) => hit(x, y) && (!hit(x, y - 2) || !hit(x, y + 2));
  const thinColumn = (x: number, y: number) => hit(x, y) && (!hit(x - 2, y) || !hit(x + 2, y));
  let horizontal = 0;
  for (let y = 0; y < image.height; y += 1) {
    let run = 0;
    for (let x = 0; x < image.width; x += 1) {
      if (thinRow(x, y)) {
        run += 1;
        continue;
      }
      if (run >= minLength) {
        horizontal += 1;
      }
      run = 0;
    }
    if (run >= minLength) {
      horizontal += 1;
    }
  }
  let vertical = 0;
  for (let x = 0; x < image.width; x += 1) {
    let run = 0;
    for (let y = 0; y < image.height; y += 1) {
      if (thinColumn(x, y)) {
        run += 1;
        continue;
      }
      if (run >= minLength) {
        vertical += 1;
      }
      run = 0;
    }
    if (run >= minLength) {
      vertical += 1;
    }
  }
  return { horizontal, vertical };
}

/** Quadrants plus a strip along each edge. */
export function canvasRegions(image: DecodedPng): ImageRegion[] {
  const { width, height } = image;
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const edgeX = Math.max(4, Math.floor(width * 0.08));
  const edgeY = Math.max(4, Math.floor(height * 0.08));
  return [
    { name: "north-west", x: 0, y: 0, width: halfW, height: halfH },
    { name: "north-east", x: halfW, y: 0, width: width - halfW, height: halfH },
    {
      name: "south-west",
      x: 0,
      y: halfH,
      width: halfW,
      height: height - halfH,
    },
    {
      name: "south-east",
      x: halfW,
      y: halfH,
      width: width - halfW,
      height: height - halfH,
    },
    { name: "top", x: 0, y: 0, width, height: edgeY },
    { name: "bottom", x: 0, y: height - edgeY, width, height: edgeY },
    { name: "left", x: 0, y: 0, width: edgeX, height },
    { name: "right", x: width - edgeX, y: 0, width: edgeX, height },
  ];
}

/** A region is blank when almost every sample matches the page colour. */
export function regionMatchesPage(image: DecodedPng, region: ImageRegion, page: Rgb): boolean {
  const x1 = Math.min(image.width, region.x + region.width);
  const y1 = Math.min(image.height, region.y + region.height);
  const span = Math.max(1, Math.min(region.width, region.height));
  const step = Math.max(1, Math.floor(span / 10));
  let match = 0;
  let total = 0;
  for (let y = region.y; y < y1; y += step) {
    for (let x = region.x; x < x1; x += step) {
      total += 1;
      if (near(pixel(image, x, y), page)) {
        match += 1;
      }
    }
  }
  return total > 0 && match / total >= 0.85;
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
