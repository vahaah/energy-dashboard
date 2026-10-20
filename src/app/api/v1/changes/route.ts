import { NextResponse } from "next/server";
import { changesQueryResponse, readCheckedInChanges } from "@/lib/changes/query";

/**
 * GET /api/v1/changes?entity_id=&cursor=
 *
 * Checked-in change events only. No Tinybird query. Tinybird impact +0.
 * A correction supersedes earlier events for the same entity and field.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const result = changesQueryResponse(new URL(request.url).searchParams, readCheckedInChanges());
  return NextResponse.json(result.body, { status: result.status });
}
