import { deflateSync } from "node:zlib";

/** West, south, east, north in WGS84 degrees. */
export type StaticMapBbox = readonly [number, number, number, number];

export type LngLat = readonly [longitude: number, latitude: number];

export type StaticMapPoint = {
  longitude: number;
  latitude: number;
  /** `#rrggbb`, matching the map legend for a technology. */
  color: string;
  /** Device-pixel radius. Falls back to `pointRadius` on the input. */
  radius?: number;
};

export type StaticMapTheme = {
  sea: string;
  land: string;
  coast: string;
};

export type StaticMapInput = {
  bbox: StaticMapBbox;
  points: readonly StaticMapPoint[];
  width: number;
  height: number;
  /** Closed or open `[longitude, latitude]` rings. Filled as land, then edged. */
  rings?: readonly (readonly LngLat[])[];
  theme: StaticMapTheme;
  pointRadius?: number;
  /** Inset in device pixels so strokes are not clipped by the frame. */
  padding?: number;
};

export type StaticMapImage = {
  width: number;
  height: number;
  indices: Uint8Array;
  palette: readonly string[];
  png: Uint8Array;
};

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PIXELS = 2_000_000;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[n] = crc >>> 0;
  }
  return table;
})();

export function staticMapExtent(coordinates: readonly LngLat[]): StaticMapBbox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of coordinates) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error("static map coordinate is not finite");
    }
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  if (!Number.isFinite(west) || east <= west || north <= south) {
    throw new Error("static map extent is empty");
  }
  return [west, south, east, north];
}

export function padStaticMapBbox(bbox: StaticMapBbox, ratio: number): StaticMapBbox {
  const [west, south, east, north] = bbox;
  if (!(ratio >= 0) || !Number.isFinite(ratio)) {
    throw new Error("static map padding ratio is invalid");
  }
  const longitudePad = (east - west) * ratio;
  const latitudePad = (north - south) * ratio;
  return [west - longitudePad, south - latitudePad, east + longitudePad, north + latitudePad];
}

/** Width for a fixed height so degrees of longitude are not stretched. */
export function staticMapDimensions(bbox: StaticMapBbox, height: number): { width: number; height: number } {
  const [west, south, east, north] = bbox;
  if (!(east > west) || !(north > south)) {
    throw new Error("static map bbox is empty");
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new Error("static map height must be a positive integer");
  }
  const midLatitude = ((south + north) / 2) * (Math.PI / 180);
  const worldWidth = (east - west) * Math.cos(midLatitude);
  const worldHeight = north - south;
  const width = Math.max(1, Math.round((height * worldWidth) / worldHeight));
  return { width, height };
}

export function projectStaticMap(
  bbox: StaticMapBbox,
  width: number,
  height: number,
  padding: number,
): (longitude: number, latitude: number) => { x: number; y: number } {
  const [west, south, east, north] = bbox;
  const midLatitude = ((south + north) / 2) * (Math.PI / 180);
  const xScale = Math.cos(midLatitude);
  const worldWidth = (east - west) * xScale;
  const worldHeight = north - south;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scale = Math.min(innerWidth / worldWidth, innerHeight / worldHeight);
  const usedWidth = worldWidth * scale;
  const usedHeight = worldHeight * scale;
  const offsetX = padding + (innerWidth - usedWidth) / 2;
  const offsetY = padding + (innerHeight - usedHeight) / 2;
  return (longitude, latitude) => ({
    x: offsetX + (longitude - west) * xScale * scale,
    y: offsetY + (north - latitude) * scale,
  });
}

/**
 * Rasterise an outline and coloured points into a deterministic indexed PNG.
 * A later asset-page thumbnail can call this with its own bbox and points.
 */
export function renderStaticMap(input: StaticMapInput): StaticMapImage {
  const width = input.width;
  const height = input.height;
  const padding = input.padding ?? 0;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("static map size must be positive integers");
  }
  if (width * height > MAX_PIXELS) {
    throw new Error("static map is too large");
  }
  if (!Number.isFinite(padding) || padding < 0 || padding * 2 >= width || padding * 2 >= height) {
    throw new Error("static map padding does not fit the frame");
  }
  const [west, south, east, north] = input.bbox;
  if (!(east > west) || !(north > south)) {
    throw new Error("static map bbox is empty");
  }

  const sea = normalizeHex(input.theme.sea);
  const land = normalizeHex(input.theme.land);
  const coast = normalizeHex(input.theme.coast);
  if (sea === land || sea === coast || land === coast) {
    throw new Error("static map theme colours must be distinct");
  }
  const palette = [sea, land, coast];
  const indices = new Uint8Array(width * height);
  const project = projectStaticMap(input.bbox, width, height, padding);

  for (const ring of input.rings ?? []) {
    fillRing(indices, width, height, projectRing(project, ring), 1);
  }
  dilateLand(indices, width, height);
  paintCoast(indices, width, height);

  const defaultRadius = input.pointRadius ?? 2;
  const points = input.points.map((point) => {
    if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) {
      throw new Error("static map point is not finite");
    }
    const radius = point.radius ?? defaultRadius;
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error("static map point radius is invalid");
    }
    return {
      longitude: point.longitude,
      latitude: point.latitude,
      color: normalizeHex(point.color),
      radius,
    };
  });
  points.sort((left, right) => {
    if (left.radius !== right.radius) {
      return left.radius - right.radius;
    }
    if (left.latitude !== right.latitude) {
      return left.latitude - right.latitude;
    }
    if (left.longitude !== right.longitude) {
      return left.longitude - right.longitude;
    }
    if (left.color < right.color) {
      return -1;
    }
    if (left.color > right.color) {
      return 1;
    }
    return 0;
  });

  for (const point of points) {
    const projected = project(point.longitude, point.latitude);
    const colorIndex = paletteIndex(palette, point.color);
    fillCircle(indices, width, height, projected.x, projected.y, point.radius, colorIndex);
  }

  return {
    width,
    height,
    indices,
    palette,
    png: encodeIndexedPng(width, height, indices, palette),
  };
}

function projectRing(
  project: (longitude: number, latitude: number) => { x: number; y: number },
  ring: readonly LngLat[],
): Array<{ x: number; y: number }> {
  const projected = ring.map(([longitude, latitude]) => project(longitude, latitude));
  if (projected.length > 1) {
    const first = projected[0];
    const last = projected[projected.length - 1];
    if (first && last && first.x === last.x && first.y === last.y) {
      projected.pop();
    }
  }
  return projected;
}

function fillRing(
  indices: Uint8Array,
  width: number,
  height: number,
  ring: readonly { x: number; y: number }[],
  colorIndex: number,
): void {
  const count = ring.length;
  if (count < 3) {
    return;
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of ring) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(height - 1, Math.ceil(maxY));
  const crossings: number[] = [];
  for (let y = yStart; y <= yEnd; y += 1) {
    const scanY = y + 0.5;
    crossings.length = 0;
    for (let index = 0; index < count; index += 1) {
      const start = ring[index];
      const end = ring[(index + 1) % count];
      if (!start || !end) {
        continue;
      }
      const crosses = (start.y <= scanY && end.y > scanY) || (end.y <= scanY && start.y > scanY);
      if (!crosses) {
        continue;
      }
      const t = (scanY - start.y) / (end.y - start.y);
      crossings.push(start.x + t * (end.x - start.x));
    }
    crossings.sort((left, right) => left - right);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const left = crossings[index];
      const right = crossings[index + 1];
      if (left === undefined || right === undefined) {
        continue;
      }
      const xStart = Math.max(0, Math.ceil(left));
      const xEnd = Math.min(width - 1, Math.floor(right));
      const row = y * width;
      for (let x = xStart; x <= xEnd; x += 1) {
        indices[row + x] = colorIndex;
      }
    }
  }
}

function dilateLand(indices: Uint8Array, width: number, height: number): void {
  const source = indices.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (source[index] !== 0) {
        continue;
      }
      const touchesLand =
        (x > 0 && source[index - 1] === 1) ||
        (x + 1 < width && source[index + 1] === 1) ||
        (y > 0 && source[index - width] === 1) ||
        (y + 1 < height && source[index + width] === 1);
      if (touchesLand) {
        indices[index] = 1;
      }
    }
  }
}

function paintCoast(indices: Uint8Array, width: number, height: number): void {
  const source = indices.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (source[index] !== 1) {
        continue;
      }
      const touchesSea =
        (x > 0 && source[index - 1] === 0) ||
        (x + 1 < width && source[index + 1] === 0) ||
        (y > 0 && source[index - width] === 0) ||
        (y + 1 < height && source[index + width] === 0);
      if (touchesSea) {
        indices[index] = 2;
      }
    }
  }
}

function fillCircle(
  indices: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  colorIndex: number,
): void {
  if (radius < 0.5) {
    const x = Math.round(cx - 0.5);
    const y = Math.round(cy - 0.5);
    if (x >= 0 && y >= 0 && x < width && y < height) {
      indices[y * width + x] = colorIndex;
    }
    return;
  }
  const radiusSquared = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    const dy = y + 0.5 - cy;
    const row = y * width;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= radiusSquared) {
        indices[row + x] = colorIndex;
      }
    }
  }
}

function paletteIndex(palette: string[], color: string): number {
  const existing = palette.indexOf(color);
  if (existing >= 0) {
    return existing;
  }
  if (palette.length >= 256) {
    throw new Error("static map palette is full");
  }
  palette.push(color);
  return palette.length - 1;
}

function normalizeHex(color: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color);
  const hex = match?.[1];
  if (!hex) {
    throw new Error(`static map colour must be #rrggbb, got ${color}`);
  }
  return `#${hex.toLowerCase()}`;
}

function encodeIndexedPng(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: readonly string[],
): Uint8Array {
  if (indices.length !== width * height) {
    throw new Error("static map index buffer does not match the frame");
  }
  if (palette.length < 1 || palette.length > 256) {
    throw new Error("static map palette must contain 1 to 256 colours");
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = new Uint8Array(palette.length * 3);
  for (let index = 0; index < palette.length; index += 1) {
    const [red, green, blue] = hexRgb(palette[index] ?? "#000000");
    plte[index * 3] = red;
    plte[index * 3 + 1] = green;
    plte[index * 3 + 2] = blue;
  }
  const raw = new Uint8Array(height * (width + 1));
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width + 1);
    raw[offset] = 0;
    raw.set(indices.subarray(y * width, (y + 1) * width), offset + 1);
  }
  const compressed = deflateSync(raw, { level: 9 });
  return concatBytes([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("PLTE", plte),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function hexRgb(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ (data[index] ?? 0)) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
