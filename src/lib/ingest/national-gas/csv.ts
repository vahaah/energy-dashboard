export const GAS_CSV_COLUMNS = [
  "Applicable At",
  "Applicable For",
  "Data Item",
  "Value",
  "Generated Time",
  "Quality Indicator",
] as const;

export type GasCsvColumn = (typeof GAS_CSV_COLUMNS)[number];

export type GasCsvTable = {
  header: string[];
  unknownColumns: string[];
  rows: Array<Record<string, string>>;
};

const KNOWN = new Set<string>(GAS_CSV_COLUMNS);

/** Portal CSV. Leading `#` comment lines are the fixture header, not columns. */
export function parseGasCsvTable(text: string): GasCsvTable {
  const trimmed = text.replace(/^\uFEFF/, "");
  const lines = trimmed.split(/\r?\n/);
  const body: string[] = [];
  for (const line of lines) {
    if (body.length === 0 && (line.length === 0 || line.startsWith("#"))) {
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    body.push(line);
  }
  const table = parseCsvRows(body.join("\n"));
  const header = table[0] ?? [];
  const unknownColumns = header.filter((column) => !KNOWN.has(column));
  const rows = table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((column, index) => {
      row[column] = cells[index] ?? "";
    });
    return row;
  });
  return { header, unknownColumns, rows };
}

export function readFixtureHeader(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (line.length === 0) {
      continue;
    }
    if (!line.startsWith("#")) {
      break;
    }
    const match = /^# ([a-z_]+): (.*)$/.exec(line);
    if (match?.[1]) {
      fields[match[1]] = match[2] ?? "";
    }
  }
  return fields;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n") {
      pushRow();
      continue;
    }
    if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}
