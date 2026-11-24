import type { Metadata } from "next";
import { MeterEnquiryLinks } from "@/components/intent-recovery";
import { SeoPage } from "@/components/seo-page";
import { ToolsBoard } from "@/components/tools/tools-board";
import { NO_METER_NUMBERS } from "@/lib/directory/copy";
import {
  ECOES_NOT_PUBLIC,
  METER_HOLDS_NOTHING,
  METER_SERIAL_LINE,
  MPID_IS_NOT_MPAN,
  OTHER_NETWORK_LINE,
} from "@/lib/intent/recovery";
import { TOOLS_DESCRIPTION, TOOLS_H1, TOOLS_STANDFIRST, TOOLS_TITLE } from "@/lib/tools/copy";
import { ENA_SEARCH_TOOLS } from "@/lib/tools/ena";
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
      <section id="meter">
        <h2 className="text-heading-24 text-gray-1000">Look up a meter, MPAN or MPRN</h2>
        <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
          {NO_METER_NUMBERS} {METER_HOLDS_NOTHING} {MPID_IS_NOT_MPAN} {METER_SERIAL_LINE} {ECOES_NOT_PUBLIC}
        </p>
        <div className="mt-3 max-w-3xl text-copy-16 text-gray-900">
          <MeterEnquiryLinks />
        </div>
        <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{OTHER_NETWORK_LINE}</p>
      </section>
      <section id="ena">
        <h2 className="text-heading-24 text-gray-1000">Energy Networks Association search tools</h2>
        <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
          Grid links out to these pages. It does not replace them.
        </p>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-copy-16 text-gray-900">
          {ENA_SEARCH_TOOLS.map((tool) => (
            <li key={tool.href}>
              <a href={tool.href} className="text-blue-700 underline-offset-2 hover:underline">
                {tool.label}
              </a>
              . {tool.note}
            </li>
          ))}
        </ul>
      </section>
      <ToolsBoard file={file} />
    </SeoPage>
  );
}
