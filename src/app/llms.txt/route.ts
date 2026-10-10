import { loadHomepagePayload } from "@/lib/homepage-payload";
import { buildLlmsTxt, LLMS_TXT_REVALIDATE_SECONDS } from "@/lib/llms-txt";

export const revalidate = LLMS_TXT_REVALIDATE_SECONDS;
export const dynamic = "force-static";

export async function GET() {
  const payload = await loadHomepagePayload();
  return new Response(buildLlmsTxt(payload), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, s-maxage=${LLMS_TXT_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
