/**
 * Satori (next/og) does not apply OpenType `tnum`. Geist Sans stores tabular
 * digits as `zero.tf`…`nine.tf` and maps ASCII digits to the proportional
 * glyphs. Point the digit segment at the tabular glyphs so every figure in
 * the OG image shares one advance width.
 *
 * Geist Mono is already tabular and is returned unchanged.
 */

const MAC_ZERO = 19;
const MAC_ONE = 20;
const POST_HEADER_BYTES = 32;

type TableRecord = {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
  directory: number;
};

export function bakeTabularFigures(file: Buffer): Buffer {
  const data = Buffer.from(file);
  const tables = readDirectory(data);
  const post = tables.get("post");
  const cmap = tables.get("cmap");
  const head = tables.get("head");
  if (!post || !cmap || !head) {
    return data;
  }

  const shift = tabularDigitShift(data, post);
  if (shift == null) {
    return data;
  }

  const patched = patchDigitSegments(data, cmap, shift);
  if (!patched) {
    return Buffer.from(file);
  }

  writeChecksums(data, tables, head);
  return data;
}

export function mappedDigitAdvances(file: Buffer): number[] | null {
  const tables = readDirectory(file);
  const cmap = tables.get("cmap");
  const hmtx = tables.get("hmtx");
  const hhea = tables.get("hhea");
  if (!cmap || !hmtx || !hhea) {
    return null;
  }

  const glyphIds = digitGlyphIds(file, cmap);
  if (!glyphIds) {
    return null;
  }

  const metrics = file.readUInt16BE(hhea.offset + 34);
  return glyphIds.map((glyphId) => {
    if (glyphId >= metrics) {
      return file.readUInt16BE(hmtx.offset + (metrics - 1) * 4);
    }
    return file.readUInt16BE(hmtx.offset + glyphId * 4);
  });
}

function readDirectory(data: Buffer): Map<string, TableRecord> {
  const count = data.readUInt16BE(4);
  const tables = new Map<string, TableRecord>();
  for (let index = 0; index < count; index += 1) {
    const directory = 12 + index * 16;
    const tag = data.toString("latin1", directory, directory + 4);
    tables.set(tag, {
      tag,
      checksum: data.readUInt32BE(directory + 4),
      offset: data.readUInt32BE(directory + 8),
      length: data.readUInt32BE(directory + 12),
      directory,
    });
  }
  return tables;
}

function tabularDigitShift(data: Buffer, post: TableRecord): number | null {
  if (data.readUInt32BE(post.offset) !== 0x00020000) {
    return null;
  }

  const names = postGlyphNames(data, post);
  const zero = names.indexOf("zero");
  const zeroTabular = names.indexOf("zero.tf");
  const one = names.indexOf("one");
  const oneTabular = names.indexOf("one.tf");
  if (zero < 0 || zeroTabular < 0 || one < 0 || oneTabular < 0) {
    return null;
  }

  const shift = zeroTabular - zero;
  if (shift === 0 || oneTabular - one !== shift) {
    return null;
  }
  return shift;
}

function postGlyphNames(data: Buffer, post: TableRecord): string[] {
  const count = data.readUInt16BE(post.offset + POST_HEADER_BYTES);
  const indexAt = post.offset + POST_HEADER_BYTES + 2;
  let stringAt = indexAt + count * 2;
  const extras: string[] = [];
  const end = post.offset + post.length;
  while (stringAt < end) {
    const length = data[stringAt] ?? 0;
    stringAt += 1;
    extras.push(data.toString("latin1", stringAt, stringAt + length));
    stringAt += length;
  }

  const names: string[] = [];
  for (let glyph = 0; glyph < count; glyph += 1) {
    const index = data.readUInt16BE(indexAt + glyph * 2);
    if (index === MAC_ZERO) {
      names.push("zero");
    } else if (index === MAC_ONE) {
      names.push("one");
    } else if (index >= 258) {
      names.push(extras[index - 258] ?? "");
    } else {
      names.push("");
    }
  }
  return names;
}

function patchDigitSegments(data: Buffer, cmap: TableRecord, shift: number): boolean {
  const subtables = cmapSubtableOffsets(data, cmap);
  let patched = 0;
  for (const offset of subtables) {
    if (patchFormat4Digits(data, offset, shift)) {
      patched += 1;
    }
  }
  return patched > 0;
}

function cmapSubtableOffsets(data: Buffer, cmap: TableRecord): number[] {
  const count = data.readUInt16BE(cmap.offset + 2);
  const offsets: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const record = cmap.offset + 4 + index * 8;
    const relative = data.readUInt32BE(record + 4);
    offsets.push(cmap.offset + relative);
  }
  return [...new Set(offsets)];
}

function patchFormat4Digits(data: Buffer, offset: number, shift: number): boolean {
  if (data.readUInt16BE(offset) !== 4) {
    return false;
  }

  const segCount = data.readUInt16BE(offset + 6) / 2;
  const endAt = offset + 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;
  let patched = false;

  for (let index = 0; index < segCount; index += 1) {
    const end = data.readUInt16BE(endAt + index * 2);
    const start = data.readUInt16BE(startAt + index * 2);
    const range = data.readUInt16BE(rangeAt + index * 2);
    if (start !== 0x30 || end !== 0x39 || range !== 0) {
      continue;
    }
    const delta = data.readUInt16BE(deltaAt + index * 2);
    data.writeUInt16BE((delta + shift) & 0xffff, deltaAt + index * 2);
    patched = true;
  }

  return patched;
}

function digitGlyphIds(data: Buffer, cmap: TableRecord): number[] | null {
  for (const offset of cmapSubtableOffsets(data, cmap)) {
    const ids = format4DigitIds(data, offset);
    if (ids) {
      return ids;
    }
  }
  return null;
}

function format4DigitIds(data: Buffer, offset: number): number[] | null {
  if (data.readUInt16BE(offset) !== 4) {
    return null;
  }

  const segCount = data.readUInt16BE(offset + 6) / 2;
  const endAt = offset + 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;

  for (let index = 0; index < segCount; index += 1) {
    const end = data.readUInt16BE(endAt + index * 2);
    const start = data.readUInt16BE(startAt + index * 2);
    const range = data.readUInt16BE(rangeAt + index * 2);
    if (start !== 0x30 || end !== 0x39 || range !== 0) {
      continue;
    }
    const delta = data.readInt16BE(deltaAt + index * 2);
    return Array.from({ length: 10 }, (_, digit) => (0x30 + digit + delta) & 0xffff);
  }

  return null;
}

function writeChecksums(data: Buffer, tables: Map<string, TableRecord>, head: TableRecord): void {
  data.writeUInt32BE(0, head.offset + 8);

  for (const table of tables.values()) {
    const checksum = checksumOf(data, table.offset, table.length);
    data.writeUInt32BE(checksum, table.directory + 4);
  }

  const whole = checksumOf(data, 0, data.length);
  data.writeUInt32BE((0xb1b0afba - whole) >>> 0, head.offset + 8);
}

function checksumOf(data: Buffer, offset: number, length: number): number {
  let sum = 0;
  const padded = (length + 3) & ~3;
  for (let index = 0; index < padded; index += 4) {
    const base = offset + index;
    const end = offset + length;
    const byte = (position: number) => (position < end ? (data[position] ?? 0) : 0);
    const value =
      ((byte(base) << 24) | (byte(base + 1) << 16) | (byte(base + 2) << 8) | byte(base + 3)) >>> 0;
    sum = (sum + value) >>> 0;
  }
  return sum;
}
