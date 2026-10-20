export const API_ERROR_UNKNOWN_ID = "Unknown ID.";
export const API_ERROR_NO_RESULTS = "No results for these filters.";
export const API_ERROR_SCOPE = "This scope is not supported.";
export const API_ERROR_SOURCE_UNAVAILABLE =
  "The source is unavailable. The last published data is still returned where Grid holds it.";

export const API_ERROR_UNSUPPORTED_FILTER = "unsupported filter";

const GB_SCOPE = "GB";

export type ApiErrorBody = { error: string };

function everyValueIsGb(params: URLSearchParams, key: string): boolean {
  const values = params.getAll(key);
  if (values.length === 0) {
    return true;
  }
  return values.every((value) => value === GB_SCOPE);
}

export function scopeRejection(params: URLSearchParams): { status: 400; body: ApiErrorBody } | null {
  if (everyValueIsGb(params, "scope") && everyValueIsGb(params, "geography")) {
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
