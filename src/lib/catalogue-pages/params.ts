import { API_ERROR_UNSUPPORTED_FILTER } from "@/lib/api/errors";

export function rejectUnknownParams(
  params: URLSearchParams,
  allowed: readonly string[],
): { error: typeof API_ERROR_UNSUPPORTED_FILTER } | null {
  const allow = new Set(allowed);
  for (const key of params.keys()) {
    if (!allow.has(key)) {
      return { error: API_ERROR_UNSUPPORTED_FILTER };
    }
  }
  for (const key of allowed) {
    if (params.getAll(key).length > 1) {
      return { error: API_ERROR_UNSUPPORTED_FILTER };
    }
  }
  return null;
}

export function pageNumber(value: string | null, max = 10_000): number | null {
  if (value === null || value === "") {
    return 1;
  }
  if (!/^[1-9]\d{0,4}$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    return null;
  }
  return parsed;
}

export function boundedQuery(value: string | null, max = 80): string | null {
  if (value === null) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return null;
  }
  return trimmed;
}

export const CATALOGUE_PAGE_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export function catalogueCacheHeaders(cacheControl = CATALOGUE_PAGE_CACHE): Record<string, string> {
  return {
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": cacheControl,
    "Vercel-CDN-Cache-Control": cacheControl,
  };
}
