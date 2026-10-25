import { connection } from "next/server";
import { loadMixFaviconSegments } from "@/lib/mix-favicon-snapshot";
import { renderMixFaviconSegments } from "@/lib/mix-favicon";

export const dynamic = "force-dynamic";
export const revalidate = 300;
export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

export default async function Icon() {
  // The build has no warmed mix. Without this, Next prerenders the empty ring and /icon stays that file.
  await connection();
  const segments = await loadMixFaviconSegments();
  const svg = renderMixFaviconSegments(segments);
  const cache =
    segments.length > 0
      ? "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"
      : "public, max-age=60, s-maxage=60";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": cache,
    },
  });
}
