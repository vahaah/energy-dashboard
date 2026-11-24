export type SourceCredit = {
  name: string;
  attribution: string;
  url?: string;
  licence?: string;
};

export type ToolResult<T> = {
  tool: string;
  readOnly: true;
  retrievedAt: string;
  sources: SourceCredit[];
  notice: string | null;
  data: T | null;
};

export function toolResult<T>(
  tool: string,
  retrievedAt: string,
  sources: SourceCredit[],
  data: T | null,
  notice: string | null = null,
): ToolResult<T> {
  return {
    tool,
    readOnly: true,
    retrievedAt,
    sources,
    notice,
    data,
  };
}

/** Any `date` field is refused. Tools never forward a historical day. */
export function historicalDateNotice(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "date")) {
    return "This tool does not read a historical date.";
  }
  return null;
}

export const NOT_YET_AVAILABLE = "Not yet available.";
