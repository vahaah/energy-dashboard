import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import { dataSourcesPageMetadata } from "@/lib/page-metadata";

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
    >
      <LegalSection title="How Grid uses data">
        <p>
          Ingest reads these APIs on a schedule, stores snapshots in Tinybird, and serves the
          dashboard from cache. Missing metrics stay null. Leftover OilPriceAPI and FRED helpers in
          the ingest tree are not fetched by cron or published on the homepage.
        </p>
      </LegalSection>

      {sources.map((source) => (
        <LegalSection key={source.id} title={source.name}>
          <p>{source.usedFor}</p>
          <p>
            Licence:{" "}
            {source.licenceUrl ? (
              <a
                href={source.licenceUrl}
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                {source.licence}
              </a>
            ) : (
              source.licence
            )}
            . Source:{" "}
            <a href={source.url} className="text-blue-700 underline-offset-2 hover:underline">
              {source.url.replace(/^https?:\/\//, "")}
            </a>
            .
          </p>
          <p className="text-copy-14 text-gray-1000">{source.attribution}</p>
        </LegalSection>
      ))}
    </LegalPage>
  );
}
