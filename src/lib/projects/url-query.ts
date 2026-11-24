export const PROJECT_QUERY_MAX = 80;

export function projectUrlQuery(value: string | null): string {
  return (value ?? "").trim().slice(0, PROJECT_QUERY_MAX);
}

/**
 * A typed filter stays until the URL query changes. A header-search navigation
 * then wins, including a same-page App Router update.
 */
export function typedQueryForUrl(typed: string | null, previousUrl: string, nextUrl: string): string | null {
  return previousUrl === nextUrl ? typed : null;
}
