import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryCodeSearch } from "@/components/directory/code-search";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { ELEXON_ISD_ATTRIBUTION, ELEXON_ISD_URL } from "@/lib/attribution";
import {
  IDENTIFIERS_DESCRIPTION,
  IDENTIFIERS_H1,
  IDENTIFIERS_STANDFIRST,
  IDENTIFIERS_TITLE,
} from "@/lib/directory/copy";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { pageJsonLd } from "@/lib/jsonld";
import { buildPageMetadata } from "@/lib/page-metadata";
import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = buildPageMetadata({
  title: IDENTIFIERS_TITLE,
  description: IDENTIFIERS_DESCRIPTION,
  path: "/directory/identifiers",
  imagePath: "/directory/identifiers/opengraph-image",
  imageAlt: IDENTIFIERS_TITLE,
});

export default function DirectoryIdentifiersPage() {
  const today = getLondonDate(new Date());
  return (
    <SeoPage
      section="Directory"
      title={IDENTIFIERS_H1}
      breadcrumb={[{ href: "/directory", label: "Directory" }, { label: "Codes" }]}
      schema={pageJsonLd({
        name: IDENTIFIERS_TITLE,
        description: IDENTIFIERS_DESCRIPTION,
        url: `${SITE_ORIGIN}/directory/identifiers`,
        breadcrumbs: [
          { name: "Directory", item: `${SITE_ORIGIN}/directory` },
          { name: "Codes", item: `${SITE_ORIGIN}/directory/identifiers` },
        ],
      })}
      cite={<p>{IDENTIFIERS_STANDFIRST}</p>}
      citation={`Grid, "Look up an MPID or industry code", grid.vahaah.com/directory/identifiers, accessed ${formatLondonDayMonthYear(today)}. ${ELEXON_ISD_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Directory</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{IDENTIFIERS_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{IDENTIFIERS_STANDFIRST}</p>
        </section>
      }
    >
      <Card
        title="Codes"
        footer={
          <p>
            <a href={ELEXON_ISD_URL} className="text-blue-700 underline-offset-2 hover:underline">
              Elexon Industry Standing Data
            </a>
            . {ELEXON_ISD_ATTRIBUTION}
          </p>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-copy-14 text-gray-900">
            <Link href="/directory" className="text-blue-700 underline-offset-2 hover:underline">
              Energy organisations and codes
            </Link>
          </p>
          <DirectoryCodeSearch defaultDate={today} />
        </div>
      </Card>
    </SeoPage>
  );
}
