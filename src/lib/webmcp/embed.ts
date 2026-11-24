import type { HomeCardFile } from "@/lib/balancing/types";
import type { GridLiveReading } from "@/lib/webmcp/reading";

export const WEBMCP_PAGE_SCRIPT_ID = "grid-webmcp-page";

export type EmbeddedWebMcp = {
  version: 1;
  path: string;
  generatedAt: string;
  reading: GridLiveReading | null;
  balancing: HomeCardFile | null;
};

export function embeddedWebMcpJson(page: EmbeddedWebMcp): string {
  return JSON.stringify(page).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function parseEmbeddedWebMcp(value: unknown): EmbeddedWebMcp | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<EmbeddedWebMcp>;
  if (record.version !== 1 || typeof record.path !== "string" || typeof record.generatedAt !== "string") {
    return null;
  }
  return {
    version: 1,
    path: record.path,
    generatedAt: record.generatedAt,
    reading: record.reading ?? null,
    balancing: record.balancing ?? null,
  };
}

export function readEmbeddedWebMcp(doc: { getElementById: (id: string) => { textContent: string | null } | null }): EmbeddedWebMcp | null {
  const node = doc.getElementById(WEBMCP_PAGE_SCRIPT_ID);
  if (!node?.textContent) {
    return null;
  }
  try {
    return parseEmbeddedWebMcp(JSON.parse(node.textContent));
  } catch {
    return null;
  }
}
