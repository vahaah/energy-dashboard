import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryNameSearch } from "@/components/directory/name-search";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { ELEXON_ISD_ATTRIBUTION, ELEXON_ISD_URL } from "@/lib/attribution";
import { DIRECTORY_H1, DIRECTORY_STANDFIRST, DIRECTORY_TITLE, MPID_LABEL, ROLE_LABEL } from "@/lib/directory/copy";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = buildPageMetadata({
  title: DIRECTORY_TITLE,
  description: DIRECTORY_STANDFIRST,
  path: "/directory",
  imagePath: "/og",
  imageAlt: DIRECTORY_TITLE,
});

export default function DirectoryPage() {
  const today = getLondonDate(new Date());
  return (
    <SeoPage
      section="Directory"
      title={DIRECTORY_H1}
      breadcrumb={[{ label: "Directory" }]}
      cite={<p>{DIRECTORY_STANDFIRST}</p>}
      citation={`Grid, "Energy organisations and codes", grid.vahaah.com/directory, accessed ${formatLondonDayMonthYear(today)}. ${ELEXON_ISD_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Directory</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{DIRECTORY_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{DIRECTORY_STANDFIRST}</p>
        </section>
      }
    >
      <Card
        title="Organisations"
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
          <p className="text-copy-14 text-gray-900">{MPID_LABEL}</p>
          <p className="text-copy-14 text-gray-900">{ROLE_LABEL}</p>
          <p className="text-copy-14 text-gray-900">
            <Link href="/directory/identifiers" className="text-blue-700 underline-offset-2 hover:underline">
              Look up an MPID or industry code
            </Link>
          </p>
          <DirectoryNameSearch defaultDate={today} />
        </div>
      </Card>
    </SeoPage>
  );
}
