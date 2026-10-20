export const API_ERROR_UNKNOWN_ID = "Unknown ID.";
export const API_ERROR_NO_RESULTS = "No results for these filters.";
export const API_ERROR_SCOPE = "This scope is not supported.";
export const API_ERROR_SOURCE_UNAVAILABLE =
  "The source is unavailable. The last published data is still returned where Grid holds it.";

export const API_ERROR_UNSUPPORTED_FILTER = "unsupported filter";

const GB_SCOPE = "GB";

export type ApiErrorBody = { error: string };

export function scopeRejection(params: URLSearchParams): { status: 400; body: ApiErrorBody } | null {
  const scope = params.get("scope");
  const geography = params.get("geography");
  if (scope == null && geography == null) {
    return null;
  }
  if ((scope == null || scope === GB_SCOPE) && (geography == null || geography === GB_SCOPE)) {
    return null;
  }
  return { status: 400, body: { error: API_ERROR_SCOPE } };
}

export function unsupportedFilter(params: URLSearchParams, allowed: ReadonlySet<string>): { status: 400; body: ApiErrorBody } | null {
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      return { status: 400, body: { error: API_ERROR_UNSUPPORTED_FILTER } };
    }
  }
  return null;
}
