import { latestSnapshotWithMix } from "@/lib/dashboard-model";
import { getHeadlineSnapshotsQueryParams } from "@/lib/dashboard-data";
import { renderMixFaviconSvg } from "@/lib/mix-favicon";
import type { EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

export const revalidate = 300;
export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

export default async function Icon() {
  const now = new Date();
  const snapshots =
    (await peekWarmedPipe<EnergySnapshot>(
      "snapshots_range",
      getHeadlineSnapshotsQueryParams(now),
      { range: "24h", now }
    ).catch(() => null)) ?? [];
  const svg = renderMixFaviconSvg(latestSnapshotWithMix(snapshots));
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
