import { NextResponse } from "next/server";
import { scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { lookupByCode, lookupByName, parseLookupSearch } from "@/lib/directory/lookup";
import { getDirectoryReader } from "@/lib/directory/reader";

/**
 * GET /api/v1/identifiers?scheme=MPID&code=…&effective_on=…
 *
 * One code, or a short name. The response is a lookup. A bulk extract is refused.
 */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["scheme", "code", "name", "effective_on", "export", "format", "scope", "geography"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = scopeRejection(params);
  if (scope) {
    return NextResponse.json(scope.body, { status: scope.status });
  }
  const extra = unsupportedFilter(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra.body, { status: extra.status });
  }
  const parsed = parseLookupSearch(params);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const snapshot = await getDirectoryReader().readDirectory();
  if (!snapshot) {
    return NextResponse.json({ error: "Not yet available" }, { status: 404 });
  }
  const result =
    parsed.kind === "code"
      ? lookupByCode(snapshot, parsed.scheme, parsed.code, parsed.effectiveOn)
      : lookupByName(snapshot, parsed.name, parsed.effectiveOn);
  return NextResponse.json(result);
}
