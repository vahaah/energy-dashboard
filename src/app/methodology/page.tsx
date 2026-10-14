import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
import { Card } from "@/components/ui/card";
import { dataSources, sourceRefreshLabel } from "@/lib/catalogue/page-sources";
import { methodologyJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { methodologyPageMetadata } from "@/lib/page-metadata";
import { DATASET_TEMPORAL_COVERAGE_START, METHODOLOGY_H1 } from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = methodologyPageMetadata();

const FAQS = [
  {
    question: "How often does Grid update?",
    answer:
      "Ingest runs hourly for the GB grid and every six hours for commodities. Missing metrics stay null, never zero. The site is not a second-by-second feed.",
  },
  {
    question: "What is the market index versus the system price?",
    answer:
      "The headline £/MWh figure is Elexon's Market Index (APXMIDP), the short-term wholesale price. The system price is the imbalance (cash-out) price. Neither is the day-ahead auction.",
  },
  {
    question: "What do records on Grid mean?",
    answer:
      "Records are highest or lowest half-hours since Grid's records began, from NESO historic generation mix (2009). They are shown next to NESO's official records and are not claimed as national records on their own.",
  },
  {
    question: "How should I cite Grid?",
    answer:
      'Grid (grid.vahaah.com), data from Elexon BMRS and NESO, {date time}. Derived data is CC BY 4.0 with the upstream attributions on this page.',
  },
];

export default function MethodologyPage() {
  const sources = dataSources();

  return (
    <>
      <JsonLd data={methodologyJsonLd({ faqs: FAQS })} />
      <SeoPage
        section="Methodology"
        title={METHODOLOGY_H1}
        breadcrumb={[{ label: "Methodology" }]}
        cite={
          <p data-cite>
            Grid compiles half-hourly Great Britain electricity figures from Elexon BMRS, NESO, the
            Carbon Intensity API and Sheffield Solar PV Live, plus slower oil and gas series from
            EIA, World Bank and National Gas. Every number carries its source, unit and time.
            Coverage starts {formatLondonDayMonthYear(DATASET_TEMPORAL_COVERAGE_START)}.
          </p>
        }
        citation={`Grid, "How Grid's numbers are made", grid.vahaah.com/methodology, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
      >
        <section>
          <h2 className="text-heading-24 text-gray-1000">Sources</h2>
          <Card className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-copy-14">
                <caption className="sr-only">Grid data sources, licences and refresh</caption>
                <thead className="text-label-13 text-gray-900">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">
                      Source
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Used for
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Licence
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Refresh
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr id={source.id} key={source.id} className="border-t border-gray-alpha-200 align-top">
                      <th scope="row" className="py-2 font-medium">
                        <a
                          href={source.url}
                          className="text-blue-700 underline-offset-2 hover:underline"
                        >
                          {source.name}
                        </a>
                      </th>
                      <td className="py-2">{source.usedFor}</td>
                      <td className="py-2">
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
                      </td>
                      <td className="py-2">{sourceRefreshLabel(source.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-copy-14 text-gray-900">
            Attribution text required by each licence is on{" "}
            <Link href="/data-sources" className="text-blue-700 underline-offset-2 hover:underline">
              Data sources
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Definitions</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-copy-16 text-gray-900">
            <p>
              Market index: Elexon APXMIDP, the short-term wholesale price in £/MWh. System price:
              imbalance / cash-out. Day-ahead auction prices are not republished.
            </p>
            <p>
              Embedded wind: NESO&apos;s estimate of wind that is not metered on the transmission
              system, joined to Elexon FUELINST. Solar is Sheffield Solar PV Live, including
              estimated embedded panels.
            </p>
            <p>
              Carbon intensity: national actual half-hour from the NESO Carbon Intensity API (CC BY
              4.0). Forecasts are used for look-ahead only and are not treated as actuals.
            </p>
            <p>
              Look-ahead uses the NESO Carbon Intensity 48-hour forecast, Elexon WINDFOR, Elexon NDF,
              and the NESO embedded wind and solar forecast, fetched by Grid and cached for 30
              minutes. Year, All time and records use NESO historic generation mix.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Data checks</h2>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">
            Snapshot integrity tests drop rows with impossible fuel shares, wind above 25.5 GW, or
            solar above 16.5 GW, and flag half-hours where the sum of generation exceeds 1.15× demand
            plus net exports. Missing metrics stay null. Coverage gaps are not filled with zeroes.
            Records stay blocked on any series that still fails those checks.
          </p>
        </section>

        <section id="records">
          <h2 className="text-heading-24 text-gray-1000">Records</h2>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">
            A Grid record is the highest or lowest valid half-hour since Grid&apos;s records began
            (NESO historic data from 2009). Each card is paired with NESO&apos;s official record.
            Solar is hidden while Grid&apos;s peak disagrees with NESO. See{" "}
            <Link href="/records" className="text-blue-700 underline-offset-2 hover:underline">
              /records
            </Link>
            .
          </p>
        </section>

        <SiteFaq items={FAQS} />
      </SeoPage>
    </>
  );
}
