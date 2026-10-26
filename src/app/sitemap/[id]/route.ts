import { sitemapChildXml, sitemapIdFromParam, xmlResponse, SITEMAP_IDS } from "@/lib/sitemap-document";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams(): { id: string }[] {
  return SITEMAP_IDS.map((id) => ({ id: `${id}.xml` }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const sitemapId = sitemapIdFromParam(id);
  if (!sitemapId) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return xmlResponse(await sitemapChildXml(sitemapId));
}
