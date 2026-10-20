/**
 * SDF glyphs for the checked-in basemap. MapLibre reads the Mapbox glyph
 * protobufs; this does not call a tile or glyph server.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BASEMAP_FONTSTACK } from "../../src/lib/map/constants";
import { encodeGlyphRange, type GlyphBitmap } from "../../src/lib/map/glyph-pbf";

const require = createRequire(import.meta.url);

type Point = { x: number; y: number };
type Command = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};
type Glyph = {
  advanceWidth: number;
  getPath: (x: number, y: number, fontSize: number) => { commands: Command[] };
  getBoundingBox: () => { x1: number; y1: number; x2: number; y2: number };
};
type Font = {
  unitsPerEm: number;
  charToGlyph: (char: string) => Glyph;
  charToGlyphIndex: (char: string) => number;
};

const opentype = require("opentype.js") as { parse: (buffer: Buffer) => Font };

const FONT_SIZE = 24;
const BUFFER = 3;
const RADIUS = 8;
const CUTOFF = 0.25;
const RANGES = [0, 256];

function mix(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function flattenCommand(cursor: Point, command: Command): Point[] {
  if (command.type === "L" && command.x !== undefined && command.y !== undefined) {
    return [{ x: command.x, y: command.y }];
  }
  if (command.type === "Q" && command.x !== undefined && command.y !== undefined && command.x1 !== undefined && command.y1 !== undefined) {
    const control = { x: command.x1, y: command.y1 };
    const end = { x: command.x, y: command.y };
    const points: Point[] = [];
    for (let step = 1; step <= 6; step += 1) {
      const t = step / 6;
      const left = mix(cursor, control, t);
      const right = mix(control, end, t);
      points.push(mix(left, right, t));
    }
    return points;
  }
  if (
    command.type === "C" &&
    command.x !== undefined &&
    command.y !== undefined &&
    command.x1 !== undefined &&
    command.y1 !== undefined &&
    command.x2 !== undefined &&
    command.y2 !== undefined
  ) {
    const c1 = { x: command.x1, y: command.y1 };
    const c2 = { x: command.x2, y: command.y2 };
    const end = { x: command.x, y: command.y };
    const points: Point[] = [];
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8;
      const a = mix(cursor, c1, t);
      const b = mix(c1, c2, t);
      const c = mix(c2, end, t);
      const d = mix(a, b, t);
      const e = mix(b, c, t);
      points.push(mix(d, e, t));
    }
    return points;
  }
  return [];
}

function contoursOf(commands: readonly Command[]): Point[][] {
  const contours: Point[][] = [];
  let current: Point[] = [];
  let cursor = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  for (const command of commands) {
    if (command.type === "M" && command.x !== undefined && command.y !== undefined) {
      if (current.length > 1) {
        contours.push(current);
      }
      cursor = { x: command.x, y: command.y };
      start = cursor;
      current = [cursor];
      continue;
    }
    if (command.type === "Z") {
      current.push(start);
      if (current.length > 1) {
        contours.push(current);
      }
      current = [];
      cursor = start;
      continue;
    }
    const next = flattenCommand(cursor, command);
    if (next.length > 0) {
      current.push(...next);
      const last = next[next.length - 1];
      if (last) {
        cursor = last;
      }
    }
  }
  if (current.length > 1) {
    contours.push(current);
  }
  return contours;
}

function segmentDistance(x: number, y: number, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return Math.hypot(x - start.x, y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / length));
  return Math.hypot(x - (start.x + t * dx), y - (start.y + t * dy));
}

function contains(x: number, y: number, contours: readonly Point[][]): boolean {
  let hits = 0;
  for (const contour of contours) {
    for (let index = 0; index < contour.length - 1; index += 1) {
      const start = contour[index];
      const end = contour[index + 1];
      if (!start || !end || start.y === end.y) {
        continue;
      }
      const crosses = start.y > y !== end.y > y;
      if (!crosses) {
        continue;
      }
      const xCross = ((end.x - start.x) * (y - start.y)) / (end.y - start.y) + start.x;
      if (x < xCross) {
        hits += 1;
      }
    }
  }
  return hits % 2 === 1;
}

function drawGlyph(font: Font, code: number): GlyphBitmap | null {
  const char = String.fromCodePoint(code);
  if (code !== 32 && font.charToGlyphIndex(char) === 0) {
    return null;
  }
  const glyph = font.charToGlyph(char);
  const scale = FONT_SIZE / font.unitsPerEm;
  const advance = Math.max(0, Math.round(glyph.advanceWidth * scale));
  const box = glyph.getBoundingBox();
  if (!Number.isFinite(box.x1) || box.x2 <= box.x1 || box.y2 <= box.y1) {
    // MapLibre adds a 3px border to the stored size and requires that many bitmap bytes.
    return { id: code, bitmap: new Uint8Array(36), width: 0, height: 0, left: 0, top: 0, advance };
  }
  const glyphLeft = Math.floor(box.x1 * scale);
  const glyphTop = Math.ceil(box.y2 * scale);
  const glyphWidth = Math.max(0, Math.ceil(box.x2 * scale) - glyphLeft);
  const glyphHeight = Math.max(0, glyphTop - Math.floor(box.y1 * scale));
  if (glyphWidth === 0 || glyphHeight === 0) {
    return { id: code, bitmap: new Uint8Array(36), width: 0, height: 0, left: 0, top: 0, advance };
  }
  // Protobuf width/height are the ink. The bitmap includes the 3px SDF border MapLibre adds back.
  const width = glyphWidth + BUFFER * 2;
  const height = glyphHeight + BUFFER * 2;
  const path = glyph.getPath(BUFFER - glyphLeft, BUFFER + glyphTop, FONT_SIZE);
  const contours = contoursOf(path.commands);
  const bitmap = new Uint8Array(width * height);
  const scaleByte = 255 / RADIUS;
  const base = 255 * (1 - CUTOFF);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      let distance = RADIUS;
      for (const contour of contours) {
        for (let index = 0; index < contour.length - 1; index += 1) {
          const start = contour[index];
          const end = contour[index + 1];
          if (!start || !end) {
            continue;
          }
          distance = Math.min(distance, segmentDistance(sampleX, sampleY, start, end));
        }
      }
      const inside = contains(sampleX, sampleY, contours);
      const signed = inside ? -distance : distance;
      const value = Math.round(base - scaleByte * signed);
      bitmap[y * width + x] = Math.max(0, Math.min(255, value));
    }
  }
  return {
    id: code,
    bitmap,
    width: glyphWidth,
    height: glyphHeight,
    left: glyphLeft - BUFFER,
    top: glyphTop + BUFFER,
    advance,
  };
}

export function writeBasemapGlyphs(repoRoot = process.cwd()): void {
  const fontPath = resolve(repoRoot, "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf");
  const font = opentype.parse(readFileSync(fontPath));
  const directory = join(repoRoot, "public/basemap/glyphs", BASEMAP_FONTSTACK);
  mkdirSync(directory, { recursive: true });
  for (const start of RANGES) {
    const glyphs: GlyphBitmap[] = [];
    for (let code = start; code < start + 256; code += 1) {
      const glyph = drawGlyph(font, code);
      if (glyph) {
        glyphs.push(glyph);
      }
    }
    writeFileSync(join(directory, `${start}-${start + 255}.pbf`), encodeGlyphRange(BASEMAP_FONTSTACK, start, glyphs));
  }
}
