import type { Metadata } from "next";
import { ToolsBoard } from "@/components/tools/tools-board";
import { SeoPage } from "@/components/seo-page";
import { TOOLS_DESCRIPTION, TOOLS_H1, TOOLS_STANDFIRST, TOOLS_TITLE } from "@/lib/tools/copy";
import { pageJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/site";
import { loadToolsFile } from "@/lib/tools/load";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: TOOLS_TITLE,
  description: TOOLS_DESCRIPTION,
  path: "/tools",
  imagePath: "/tools/opengraph-image",
  imageAlt: TOOLS_TITLE,
});

export default function ToolsPage() {
  const file = loadToolsFile();
  const today = getLondonDate(new Date());
  return (
    <SeoPage
      section="Tools"
      title={TOOLS_H1}
      breadcrumb={[{ label: "Tools" }]}
      schema={pageJsonLd({
        name: TOOLS_TITLE,
        description: TOOLS_DESCRIPTION,
        url: `${SITE_ORIGIN}/tools`,
        breadcrumbs: [{ name: "Tools", item: `${SITE_ORIGIN}/tools` }],
      })}
      cite={<p>{TOOLS_STANDFIRST}</p>}
      citation={`Grid, "Energy tools and official services", grid.vahaah.com/tools, accessed ${formatLondonDayMonthYear(today)}.`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Tools</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{TOOLS_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{TOOLS_STANDFIRST}</p>
        </section>
      }
    >
      <ToolsBoard file={file} />
    </SeoPage>
  );
}
