import { NextResponse } from "next/server";
import { lookupByCode, lookupByName, parseLookupSearch } from "@/lib/directory/lookup";
import { getDirectoryReader } from "@/lib/directory/reader";

/**
 * GET /api/v1/identifiers?scheme=MPID&code=…&effective_on=…
 *
 * One code, or a short name. The response is a lookup. A bulk extract is refused.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = parseLookupSearch(new URL(request.url).searchParams);
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
