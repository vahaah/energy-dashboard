/** ISD Data Store CSV. The first line is the entity preamble, then the header. */
export function parseIsdCsv(text: string): { version: string; header: string[]; rows: string[][] } {
  const table = parseCsv(text);
  if (table.length < 2) {
    throw new Error("ISD CSV is missing a header");
  }
  const preamble = table[0] ?? [];
  const entity = preamble[0] ?? "";
  if (!entity.startsWith("ISDEntity")) {
    throw new Error("ISD CSV is missing its entity preamble");
  }
  const version = (preamble[2] ?? "").trim();
  if (!version) {
    throw new Error("ISD CSV is missing its entity version");
  }
  const header = (table[1] ?? []).map((cell) => cell.trim());
  const rows = table.slice(2).map((row) => row.map((cell) => cell.trim()));
  return { version, header, rows };
}

export function columnIndex(header: readonly string[], expected: readonly string[]): Map<string, number> | null {
  if (header.length !== expected.length) {
    return null;
  }
  const index = new Map<string, number>();
  for (let position = 0; position < expected.length; position += 1) {
    const name = expected[position];
    if (!name || header[position] !== name) {
      return null;
    }
    index.set(name, position);
  }
  return index;
}

export function cell(row: readonly string[], index: Map<string, number>, name: string): string {
  const position = index.get(name);
  if (position === undefined) {
    return "";
  }
  return row[position] ?? "";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (quoted) {
      if (char === '"') {
        if (source[cursor + 1] === '"') {
          value += '"';
          cursor += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char ?? "";
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[cursor + 1] === "\n") {
        cursor += 1;
      }
      row.push(value);
      value = "";
      if (row.some((item) => item.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    value += char ?? "";
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((item) => item.trim().length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}
