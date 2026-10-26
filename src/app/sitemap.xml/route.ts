import { sitemapIndexXml, xmlResponse } from "@/lib/sitemap-document";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return xmlResponse(await sitemapIndexXml());
}
