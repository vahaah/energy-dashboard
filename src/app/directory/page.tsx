import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryNameSearch } from "@/components/directory/name-search";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { ELEXON_ISD_ATTRIBUTION, ELEXON_ISD_URL } from "@/lib/attribution";
import { FaqList } from "@/components/ui/faq-list";
import { DIRECTORY_DESCRIPTION, DIRECTORY_FAQS, DIRECTORY_H1, DIRECTORY_STANDFIRST, DIRECTORY_TITLE } from "@/lib/directory/copy";
import { pageJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/site";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = buildPageMetadata({
  title: DIRECTORY_TITLE,
  description: DIRECTORY_DESCRIPTION,
  path: "/directory",
  imagePath: "/directory/opengraph-image",
  imageAlt: DIRECTORY_TITLE,
});

export default function DirectoryPage() {
  const today = getLondonDate(new Date());
  return (
    <SeoPage
      section="Directory"
      title={DIRECTORY_H1}
      breadcrumb={[{ label: "Directory" }]}
      schema={pageJsonLd({
        name: DIRECTORY_TITLE,
        description: DIRECTORY_DESCRIPTION,
        url: `${SITE_ORIGIN}/directory`,
        breadcrumbs: [{ name: "Directory", item: `${SITE_ORIGIN}/directory` }],
        faqs: [...DIRECTORY_FAQS],
      })}
      cite={<p>{DIRECTORY_STANDFIRST}</p>}
      citation={`Grid, "Energy organisations and codes", grid.vahaah.com/directory, accessed ${formatLondonDayMonthYear(today)}. ${ELEXON_ISD_ATTRIBUTION}`}
      header={
        <section>
          <h1 className="text-heading-32 text-gray-1000">{DIRECTORY_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{DIRECTORY_STANDFIRST}</p>
        </section>
      }
    >
      <Card
        title="Search by organisation name"
        footer={
          <p>
            Source: Elexon (Industry Standing Data). Grid shows only the fields needed for a lookup and does not offer a download.{" "}
            <a href={ELEXON_ISD_URL} className="text-blue-700 underline-offset-2 hover:underline">
              Elexon Industry Standing Data
            </a>
            .
          </p>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-copy-14 text-gray-900">
            <Link href="/directory/identifiers" className="text-blue-700 underline-offset-2 hover:underline">
              Look up an MPID or industry code
            </Link>
          </p>
          <DirectoryNameSearch defaultDate={today} />
        </div>
      </Card>
      <FaqList items={DIRECTORY_FAQS} />
    </SeoPage>
  );
}
