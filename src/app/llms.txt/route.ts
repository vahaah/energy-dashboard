import { balancingLlmsLine } from "@/lib/balancing/leads";
import { readBalancingRelease } from "@/lib/balancing/load";
import { buildBalancingPage } from "@/lib/balancing/page-model";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { buildLlmsTxt } from "@/lib/llms-txt";

export const revalidate = 3600;
export const dynamic = "force-static";

export async function GET() {
  const payload = await loadHomepagePayload();
  const balancing = buildBalancingPage(await readBalancingRelease(), new Date());
  return new Response(buildLlmsTxt(payload, balancingLlmsLine(balancing)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
