import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { Card } from "@/components/ui/card";
import { cataloguePageSources, sourceRefreshLabel } from "@/lib/catalogue/page-sources";
import { NO_METER_NUMBERS } from "@/lib/directory/copy";
import { pageJsonLd } from "@/lib/jsonld";
import { DATA_SOURCES_DESCRIPTION, DATA_SOURCES_TITLE, dataSourcesPageMetadata } from "@/lib/page-metadata";
import { SITE_ORIGIN } from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = dataSourcesPageMetadata();

export default function DataSourcesPage() {
  const sources = cataloguePageSources();

  return (
    <LegalPage
      section="Data sources"
      title="Data sources"
      lede="Every feed Grid republishes, with the licence it is under and the attribution text that licence requires. /attributions redirects here."
      schema={pageJsonLd({
        name: DATA_SOURCES_TITLE,
        description: DATA_SOURCES_DESCRIPTION,
        url: `${SITE_ORIGIN}/data-sources`,
        breadcrumbs: [{ name: "Data sources", item: `${SITE_ORIGIN}/data-sources` }],
      })}
    >
      <LegalSection title="Looking for a meter or official search tool?">
        <p>
          {NO_METER_NUMBERS} Use the official registers and Grid&apos;s own lookups instead:{" "}
          <Link href="/tools" className="text-blue-700 underline-offset-2 hover:underline">
            Tools
          </Link>
          ,{" "}
          <Link href="/directory" className="text-blue-700 underline-offset-2 hover:underline">
            Directory
          </Link>
          ,{" "}
          <Link href="/directory/identifiers" className="text-blue-700 underline-offset-2 hover:underline">
            MPID, BM Unit ID and GSP
          </Link>
          ,{" "}
          <Link href="/api" className="text-blue-700 underline-offset-2 hover:underline">
            API
          </Link>
          ,{" "}
          <Link href="/pipeline" className="text-blue-700 underline-offset-2 hover:underline">
            Pipeline
          </Link>{" "}
          and{" "}
          <Link href="/projects" className="text-blue-700 underline-offset-2 hover:underline">
            Projects
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="How Grid uses data">
        <p>
          Grid reads these sources on a schedule, stores each reading with its source time, and serves
          the dashboard from stored copies. Missing values stay empty, never zero. The plant register,
          the projects register, the UK annual energy balance, and map layers stay in the catalogue.
          The organisation directory is a lookup. Grid does not offer a download of the ISD extract.
          The postcode lookup is a private copy. Northern Ireland postcodes are not included. Grid does
          not offer a download of the ONS file.
        </p>
      </LegalSection>

      {sources.map((source) => (
        <Card key={source.id} id={source.id} title={source.name}>
          <p className="text-copy-14 text-gray-900">{source.usedFor}</p>
          <dl className="mt-3 grid gap-3">
            <div>
              <dt className="text-label-13 text-gray-900">Licence</dt>
              <dd className="text-copy-14 text-gray-1000">
                {source.licenceUrl ? (
                  <a href={source.licenceUrl} className="text-blue-700 underline-offset-2 hover:underline">
                    {source.licence}
                  </a>
                ) : (
                  source.licence
                )}
              </dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">Attribution</dt>
              <dd className="whitespace-pre-line text-copy-14 text-gray-1000">{source.attribution}</dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">Refresh</dt>
              <dd className="text-copy-14 text-gray-1000">{sourceRefreshLabel(source.id)}</dd>
            </div>
          </dl>
          <p className="mt-3 break-all text-copy-14">
            <a href={source.url} className="text-blue-700 underline-offset-2 hover:underline">
              {source.url.replace(/^https?:\/\//, "")}
            </a>
          </p>
        </Card>
      ))}
    </LegalPage>
  );
}
