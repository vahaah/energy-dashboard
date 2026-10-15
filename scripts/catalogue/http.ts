import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const USER_AGENT = "grid-catalogue/1.0 (energy-dashboard; offline REPD/DUKES import)";

export async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "*/*" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

export function readCache(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

export function writeCache(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

/** `2026-08-03T09:00:03Z` becomes `2026-08-03T09:00:03.000Z`. */
export function normalizeInstant(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`not a UTC instant: ${value}`);
  }
  return parsed.toISOString();
}
