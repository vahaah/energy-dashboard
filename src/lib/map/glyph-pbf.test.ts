import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeGlyphRange, encodeGlyphRange } from "@/lib/map/glyph-pbf";
import { BASEMAP_FONTSTACK } from "@/lib/map/constants";

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

function lengthField(bytes: Uint8Array, offset: number): { field: number; value: Uint8Array; next: number } {
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

/** Field numbers on one glyph message. MapLibre does not default a missing sint to 0. */
function glyphFields(bytes: Uint8Array): { id: number; fields: number[] }[] {
  const outer = lengthField(bytes, 0);
  const glyphs: { id: number; fields: number[] }[] = [];
  let cursor = 0;
  while (cursor < outer.value.length) {
    const part = lengthField(outer.value, cursor);
    cursor = part.next;
    if (part.field !== 3) {
      continue;
    }
    let glyphCursor = 0;
    let id = 0;
    const fields: number[] = [];
    while (glyphCursor < part.value.length) {
      const header = readVarint(part.value, glyphCursor);
      glyphCursor = header.offset;
      const field = header.value >> 3;
      const wire = header.value & 0x7;
      fields.push(field);
      if (wire === 2) {
        const length = readVarint(part.value, glyphCursor);
        glyphCursor = length.offset + length.value;
        continue;
      }
      const number = readVarint(part.value, glyphCursor);
      glyphCursor = number.offset;
      if (field === 1) {
        id = number.value;
      }
    }
    glyphs.push({ id, fields });
  }
  return glyphs;
}

describe("glyph protobuf", () => {
  it("round-trips a glyph bitmap", () => {
    const encoded = encodeGlyphRange("Geist Sans Regular", 0, [
      {
        id: 65,
        bitmap: Uint8Array.from([1, 2, 3, 4]),
        width: 2,
        height: 2,
        left: -1,
        top: 12,
        advance: 14,
      },
    ]);
    expect(decodeGlyphRange(encoded)).toEqual({
      name: "Geist Sans Regular",
      range: "0-255",
      glyphs: [
        {
          id: 65,
          bitmap: Uint8Array.from([1, 2, 3, 4]),
          width: 2,
          height: 2,
          left: -1,
          top: 12,
          advance: 14,
        },
      ],
    });
  });

  it("writes a zero left bearing so MapLibre does not drop the glyph", () => {
    const encoded = encodeGlyphRange("Geist Sans Regular", 0, [
      {
        id: 87,
        bitmap: Uint8Array.from([9]),
        width: 1,
        height: 1,
        left: 0,
        top: 0,
        advance: 0,
      },
    ]);
    const written = glyphFields(encoded).find((glyph) => glyph.id === 87);
    expect(written?.fields).toEqual(expect.arrayContaining([5, 6, 7]));
    const checkedIn = glyphFields(
      readFileSync(resolve(process.cwd(), `public/basemap/glyphs/${BASEMAP_FONTSTACK}/0-255.pbf`)),
    ).find((glyph) => glyph.id === 87);
    expect(checkedIn?.fields).toContain(5);
    expect(checkedIn?.fields).toContain(6);
  });
});
