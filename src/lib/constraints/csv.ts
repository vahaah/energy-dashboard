export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

export function csvRows(text: string): string[][] {
  const lines = stripBom(text).split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    rows.push(line.split(",").map((cell) => cell.trim()));
  }
  return rows;
}

export function parsePublishedNumber(value: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
