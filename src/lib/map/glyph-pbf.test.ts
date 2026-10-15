import { describe, expect, it } from "vitest";
import { decodeGlyphRange, encodeGlyphRange } from "@/lib/map/glyph-pbf";

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
});
