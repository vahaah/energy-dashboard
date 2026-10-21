export type GlyphBitmap = {
  id: number;
  bitmap: Uint8Array;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
};

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value >>> 0;
  while (rest > 127) {
    bytes.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  bytes.push(rest);
  return bytes;
}

function zigzag(value: number): number {
  return (value << 1) ^ (value >> 31);
}

function key(field: number, wire: number): number[] {
  return varint((field << 3) | wire);
}

function lengthDelimited(field: number, payload: Uint8Array): number[] {
  return [...key(field, 2), ...varint(payload.length), ...payload];
}

function uintField(field: number, value: number, keepZero = false): number[] {
  if (value === 0 && !keepZero) {
    return [];
  }
  return [...key(field, 0), ...varint(value)];
}

function sintField(field: number, value: number): number[] {
  // MapLibre's glyph parser leaves an omitted sint undefined. A left bearing of
  // 0 then becomes a NaN quad, so the letter keeps its advance and draws nothing.
  return [...key(field, 0), ...varint(zigzag(value))];
}

function encodeGlyph(glyph: GlyphBitmap): Uint8Array {
  const bitmap = glyph.bitmap.length > 0 ? lengthDelimited(2, glyph.bitmap) : [];
  const bytes = [
    ...uintField(1, glyph.id),
    ...bitmap,
    ...uintField(3, glyph.width, true),
    ...uintField(4, glyph.height, true),
    ...sintField(5, glyph.left),
    ...sintField(6, glyph.top),
    ...uintField(7, glyph.advance, true),
  ];
  return Uint8Array.from(bytes);
}

function encodeFontstack(name: string, range: string, glyphs: readonly GlyphBitmap[]): Uint8Array {
  const nameBytes = Buffer.from(name);
  const rangeBytes = Buffer.from(range);
  const parts: number[] = [
    ...lengthDelimited(1, nameBytes),
    ...lengthDelimited(2, rangeBytes),
  ];
  for (const glyph of glyphs) {
    parts.push(...lengthDelimited(3, encodeGlyph(glyph)));
  }
  return Uint8Array.from(parts);
}

/** Mapbox glyph stack. One font, one 256-codepoint range. */
export function encodeGlyphRange(name: string, rangeStart: number, glyphs: readonly GlyphBitmap[]): Buffer {
  const range = `${rangeStart}-${rangeStart + 255}`;
  const stack = encodeFontstack(name, range, glyphs);
  return Buffer.from(lengthDelimited(1, stack));
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < bytes.length) {
    const byte = bytes[cursor] ?? 0;
    cursor += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: value >>> 0, offset: cursor };
    }
    shift += 7;
  }
  throw new Error("truncated varint");
}

function unzigzag(value: number): number {
  return (value >>> 1) ^ -(value & 1);
}

export function decodeGlyphRange(bytes: Uint8Array): { name: string; range: string; glyphs: GlyphBitmap[] } {
  const outer = readLength(bytes, 0);
  if (outer.field !== 1) {
    throw new Error("glyph stack field missing");
  }
  let name = "";
  let range = "";
  const glyphs: GlyphBitmap[] = [];
  let cursor = 0;
  const body = outer.value;
  while (cursor < body.length) {
    const part = readLength(body, cursor);
    cursor = part.next;
    if (part.field === 1) {
      name = Buffer.from(part.value).toString("utf8");
    } else if (part.field === 2) {
      range = Buffer.from(part.value).toString("utf8");
    } else if (part.field === 3) {
      glyphs.push(decodeGlyph(part.value));
    }
  }
  return { name, range, glyphs };
}

function decodeGlyph(bytes: Uint8Array): GlyphBitmap {
  const glyph: GlyphBitmap = {
    id: 0,
    bitmap: new Uint8Array(),
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    advance: 0,
  };
  let cursor = 0;
  while (cursor < bytes.length) {
    const header = readVarint(bytes, cursor);
    cursor = header.offset;
    const field = header.value >> 3;
    const wire = header.value & 0x7;
    if (wire === 2) {
      const length = readVarint(bytes, cursor);
      cursor = length.offset;
      const slice = bytes.slice(cursor, cursor + length.value);
      cursor += length.value;
      if (field === 2) {
        glyph.bitmap = Uint8Array.from(slice);
      }
      continue;
    }
    if (wire !== 0) {
      throw new Error(`unexpected wire type ${wire}`);
    }
    const number = readVarint(bytes, cursor);
    cursor = number.offset;
    switch (field) {
      case 1:
        glyph.id = number.value;
        break;
      case 3:
        glyph.width = number.value;
        break;
      case 4:
        glyph.height = number.value;
        break;
      case 5:
        glyph.left = unzigzag(number.value);
        break;
      case 6:
        glyph.top = unzigzag(number.value);
        break;
      case 7:
        glyph.advance = number.value;
        break;
      default:
        break;
    }
  }
  return glyph;
}

function readLength(
  bytes: Uint8Array,
  offset: number,
): { field: number; value: Uint8Array; next: number } {
  const header = readVarint(bytes, offset);
  const field = header.value >> 3;
  const wire = header.value & 0x7;
  if (wire !== 2) {
    throw new Error(`expected length-delimited field at ${offset}`);
  }
  const length = readVarint(bytes, header.offset);
  const start = length.offset;
  const end = start + length.value;
  return { field, value: bytes.slice(start, end), next: end };
}
