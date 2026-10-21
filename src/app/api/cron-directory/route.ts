import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runDirectoryIngest } from "@/lib/directory/ingest";
import { recordJobFailure, recordJobSuccess } from "@/lib/job-health";

/**
 * GET /api/cron-directory
 *
 * Weekly ISD lookup. Writes Blob. Does not call Tinybird. Fails closed without
 * CRON_SECRET. A missing blob token returns before any ISD request.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }
  const result = await runDirectoryIngest();
  if (!result.ok) {
    await recordJobFailure("cron-directory", result.error ?? "directory ingest failed");
    return NextResponse.json({ ok: false, error: result.error ?? "directory ingest failed" }, { status: 503 });
  }
  await recordJobSuccess("cron-directory");
  revalidatePath("/directory");
  revalidatePath("/directory/identifiers");
  console.info("[cron-directory] published", {
    unchanged: result.unchanged,
    organisations: result.organisations,
    identifiers: result.identifiers,
    roles: result.roles,
    quarantined: result.quarantined,
    hash: result.hash,
  });
  return NextResponse.json({
    ok: true,
    unchanged: result.unchanged,
    organisations: result.organisations,
    identifiers: result.identifiers,
    roles: result.roles,
    quarantined: result.quarantined,
    bytes: result.bytes,
    hash: result.hash,
    releaseId: result.releaseId,
  });
}
