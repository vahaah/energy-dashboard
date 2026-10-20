import { NextResponse } from "next/server";
import { API_ERROR_SOURCE_UNAVAILABLE, scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { postcodeLogFields, type PostcodeLogStatus } from "@/lib/postcode/analytics";
import { resolvePostcode } from "@/lib/postcode/resolve";

/**
 * POST /api/v1/postcode
 *
 * The postcode is the JSON body. It is not a query parameter, not logged,
 * and not copied into the response.
 */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["scope", "geography"]);

function readPostcode(body: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "expected a JSON object" };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "postcode") {
      return { ok: false, error: "unsupported filter" };
    }
  }
  if (typeof record.postcode !== "string" || record.postcode.length === 0 || record.postcode.length > 16) {
    return { ok: false, error: "expected a postcode string" };
  }
  return { ok: true, value: record.postcode };
}

function loggedStatus(result: Awaited<ReturnType<typeof resolvePostcode>>): PostcodeLogStatus {
  if (result.http === 503) {
    return "error";
  }
  return result.body.status === "found" ? "found" : "not_found";
}

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = scopeRejection(params);
  if (scope) {
    return NextResponse.json(scope.body, { status: scope.status });
  }
  const extra = unsupportedFilter(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra.body, { status: extra.status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON object" }, { status: 400 });
  }
  const postcode = readPostcode(body);
  if (!postcode.ok) {
    return NextResponse.json({ error: postcode.error }, { status: 400 });
  }
  try {
    const result = await resolvePostcode(postcode.value);
    console.info("[postcode] resolve", postcodeLogFields(loggedStatus(result)));
    return NextResponse.json(result.body, { status: result.http });
  } catch {
    console.info("[postcode] resolve", postcodeLogFields("error"));
    return NextResponse.json({ error: API_ERROR_SOURCE_UNAVAILABLE }, { status: 503 });
  }
}
