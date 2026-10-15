import { NextResponse } from "next/server";
import { parseResolveBody, resolveCodes, resolveLogFields } from "@/lib/directory/lookup";
import { getDirectoryReader } from "@/lib/directory/reader";

/**
 * POST /api/v1/identifiers/resolve
 *
 * At most 20 codes. The log line is the count. Codes stay out of the log.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON object" }, { status: 400 });
  }
  const parsed = parseResolveBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  console.info("[identifiers] resolve", resolveLogFields(parsed.queries.length));
  const snapshot = await getDirectoryReader().readDirectory();
  if (!snapshot) {
    return NextResponse.json({ error: "Not yet available" }, { status: 404 });
  }
  return NextResponse.json({
    effective_on: parsed.effectiveOn,
    results: resolveCodes(snapshot, parsed.effectiveOn, parsed.queries),
  });
}
