export const EDGE_CACHEABLE_API_PATHS = [
  "/api/dashboard",
  "/api/prices",
  "/api/look-ahead",
  "/api/snapshots",
  "/api/generation",
  "/api/interconnectors",
] as const;

/** Next.js appends these to Vary on every App path; they fragment the CDN key. */
export const NEXT_FLIGHT_HEADERS = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-hmr-refresh",
  "next-router-segment-prefetch",
  "next-url",
] as const;

export const API_CDN_VARY = "Accept-Encoding";

export function isEdgeCacheableApi(pathname: string, method: string): boolean {
  return method === "GET" && (EDGE_CACHEABLE_API_PATHS as readonly string[]).includes(pathname);
}

export function withoutFlightHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const name of NEXT_FLIGHT_HEADERS) {
    next.delete(name);
  }
  return next;
}
