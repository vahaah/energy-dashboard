import { NextResponse } from "next/server";
import { queryNorthernIreland } from "@/lib/eirgrid/query";
import { readNiRelease } from "@/lib/eirgrid/reader";

/**
 * GET /api/v1/northern-ireland?geography=NI|IE|ALL_ISLAND|GB
 *
 * One operational geography. UK, and any mix of GB and NI, is unsupported_dimension.
 * No Tinybird query.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const geography = new URL(request.url).searchParams.get("geography") ?? "NI";
  const release = await readNiRelease().catch(() => null);
  const result = queryNorthernIreland(release, geography);
  return NextResponse.json(result.body, { status: result.status });
}
