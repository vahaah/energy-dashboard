import { NextResponse } from "next/server";
import { REDISTRIBUTION_NOT_PERMITTED } from "@/lib/directory/copy";

/**
 * ISD redistribution is source-blocked. Lookup stays on GET /api/v1/identifiers.
 */
export const dynamic = "force-dynamic";

function refused() {
  return NextResponse.json({ error: REDISTRIBUTION_NOT_PERMITTED }, { status: 403 });
}

export function GET() {
  return refused();
}

export function POST() {
  return refused();
}
