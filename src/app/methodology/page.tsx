import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
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
      "Grid refreshes every hour. Oil and gas prices refresh every 6 hours. Physical gas data is updated hourly. Missing metrics stay null, never zero. The site is not a second-by-second feed.",
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
      "Grid (grid.vahaah.com), data from Elexon BMRS and NESO, {date, time BST}. Derived data is CC BY 4.0 with the upstream attributions on this page.",
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
          <ul className="mt-4 flex flex-col gap-2 text-copy-14">
            {sources.map((source) => (
              <li key={source.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
                <a href={`/data-sources#${source.id}`} className="text-blue-700 underline-offset-2 hover:underline">
                  {source.name}
                </a>
                <span className="text-gray-900">{sourceRefreshLabel(source.id)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-copy-14 text-gray-900">
            Licences, attribution and what each source is used for are on{" "}
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

        <section id="balancing">
          <h2 className="text-heading-24 text-gray-1000">Balancing cost and traded electricity</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-copy-16 text-gray-900">
            <p>
              Balancing cost is NESO&apos;s daily file: six categories, summed to a day. A financial year is the sum of
              those days. A day with fewer half-hours than the clock is incomplete. A missing day is a gap, not zero,
              and a year-to-date total that skips a day is partial. The figure is not NESO&apos;s £3.1 billion for
              2025/26, from{" "}
              <a
                href="https://www.neso.energy/news/balancing-act"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                NESO&apos;s 3 November 2026 post
              </a>
              . The daily file for that year is a smaller total. The two are not added together.
            </p>
            <p>
              The per-household figure is the current final BSUoS tariff × 2,500 kWh, Ofgem&apos;s typical yearly
              electricity use for a medium household from 1 Jul 2026. It leaves out network losses. Excluding VAT.
              NESO puts balancing at 4.3% of a typical household electricity bill in 2025/26.
            </p>
            <p>
              The interconnector figure is an estimate: half-hourly flow (Elexon FUELHH) × the Market index price
              (Elexon MID). Net imports are imports minus exports. It is not an invoice and it is not added to
              balancing cost. Half-hours with flow but no Market index price are left out, and that day is incomplete.
            </p>
            <p>
              HMRC Overseas Trade Statistics publish UK electricity trade under commodity 2716. That series is UK trade
              and leaves out flows between Great Britain and Northern Ireland. Grid&apos;s estimate is GB
              interconnectors, including Moyle, so the two are not the same total. The custom table is on{" "}
              <a
                href="https://www.uktradeinfo.com/trade-data/ots-custom-table/"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                UK Trade Info
              </a>
              . See{" "}
              <Link href="/system/balancing" className="text-blue-700 underline-offset-2 hover:underline">
                /system/balancing
              </Link>
              .
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
