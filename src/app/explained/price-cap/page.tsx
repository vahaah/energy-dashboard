import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
import { Sparkline } from "@/components/sparkline";
import { Card } from "@/components/ui/card";
import { loadCachedPublicPrices } from "@/lib/cached-prices";
import { GB_GAS_SAP_COMMODITY, sapPencePerTherm } from "@/lib/gb-gas-sap";
import type { CommodityPrice } from "@/lib/types";
import { meanCommodityInWindow } from "@/lib/gas-page";
import { priceCapJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { priceCapPageMetadata } from "@/lib/page-metadata";
import {
  CURRENT_PRICE_CAP,
  formatCapPounds,
  OFGEM_PRICE_CAP_HUB_URL,
  PRICE_CAP_OBSERVATION_WINDOW,
  priceCapPresentation,
} from "@/lib/price-cap";
import { PRICE_CAP_TITLE, SITE_ORIGIN } from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = priceCapPageMetadata();

export default async function PriceCapPage() {
  const prices = await loadCachedPublicPrices("1y").catch(() => []);
  const sapWindow = meanCommodityInWindow(
    prices,
    GB_GAS_SAP_COMMODITY,
    PRICE_CAP_OBSERVATION_WINDOW.from,
    PRICE_CAP_OBSERVATION_WINDOW.to
  );
  const sapSpark = sapWindowSeries(prices);
  const model = priceCapPresentation();
  const footnotes = model.caps.flatMap((cap, capIndex) =>
    cap.notes.map((note, noteIndex) => ({
      marker: capIndex + noteIndex + 1,
      periodFrom: cap.periodFrom,
      note,
    })),
  );
  const cite = model.answer;
  const faqs = model.faqs;

  return (
    <>
      <JsonLd data={priceCapJsonLd({ faqs })} />
      <SeoPage
        section="Explained"
        title={model.h1}
        breadcrumb={[{ label: "Explained" }, { label: "Price cap" }]}
        cite={<p data-cite>{cite}</p>}
        citation={`Grid, "${PRICE_CAP_TITLE.replace(" | Grid", "")}", grid.vahaah.com/explained/price-cap, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}. Data: Ofgem.`}
        share={{ url: `${SITE_ORIGIN}/explained/price-cap`, title: PRICE_CAP_TITLE }}
        updated={
          <p className="text-label-13 text-gray-900">{model.updated}</p>
        }
      >
        <section id="january-2027">
          <h2 className="text-heading-24 text-gray-1000">January 2027 energy price cap</h2>
          {model.januaryParagraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 max-w-3xl text-copy-16 text-gray-900">
              {paragraph}
            </p>
          ))}
          {model.rates ? (
            <>
              <p className="mt-4 max-w-3xl text-copy-14 text-gray-900">
                Direct Debit averages for Great Britain. {model.rates.basis}
              </p>
              <Card className="mt-4">
                <div className="relative min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-copy-14">
                    <caption className="sr-only">
                      Direct Debit unit rates, standing charges and the typical annual bill
                    </caption>
                    <thead className="text-label-13 text-gray-900">
                      <tr>
                        <th scope="col" className="pb-2 font-medium">
                          Period
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                          Electricity
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                          Gas
                        </th>
                        <th scope="col" className="pb-2 text-right font-medium">
                          Typical dual-fuel
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rates.periods.map((period) => (
                        <tr key={period.label} className="border-t border-gray-alpha-200">
                          <th scope="row" className="py-2 font-medium">
                            {period.label}
                          </th>
                          <td className="py-2 tabular-nums">
                            {period.electricity.unit}
                            {", "}
                            {period.electricity.standing}
                            {", "}
                            {formatCapPounds(period.electricity.annualGbp)}
                          </td>
                          <td className="py-2 tabular-nums">
                            {period.gas.unit}
                            {", "}
                            {period.gas.standing}
                            {", "}
                            {formatCapPounds(period.gas.annualGbp)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCapPounds(period.electricity.annualGbp)} + {formatCapPounds(period.gas.annualGbp)} ={" "}
                            {formatCapPounds(period.totalGbp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="mt-3 max-w-3xl text-copy-14 text-gray-900">{model.rates.vatNote}</p>
              <p className="mt-2 text-copy-16">
                <a
                  href={model.rates.ratesUrl}
                  className="text-blue-700 underline-offset-2 hover:underline"
                >
                  Ofgem unit rates and standing charges
                </a>
              </p>
            </>
          ) : null}
          <p className="mt-2 text-copy-16">
            <Link href="/methodology" className="text-blue-700 underline-offset-2 hover:underline">
              Method
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Published Ofgem caps</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Typical dual-fuel Direct Debit household. Each row is the figure Ofgem published, with
            the announcement date. Typical consumption values changed on 1 July 2026, so earlier
            pounds-per-year figures are not on the same basis as the current cap.
          </p>
          <Card className="mt-4">
            <div className="relative min-w-0 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-copy-14">
                <caption className="sr-only">Ofgem price caps published so far</caption>
                <thead className="text-label-13 text-gray-900">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">
                      Period
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Typical dual-fuel DD
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Announced
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.caps.map((cap) => (
                    <tr key={cap.periodFrom} className="border-t border-gray-alpha-200">
                      <th scope="row" className="py-2 font-medium">
                        {cap.periodLabel}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        £{cap.typicalDualFuelDirectDebitGbp.toLocaleString("en-GB")}
                        {footnotes
                          .filter((note) => note.periodFrom === cap.periodFrom)
                          .map((note) => (
                            <sup key={note.marker} className="ml-0.5 text-label-13">
                              {note.marker}
                            </sup>
                          ))}
                      </td>
                      <td className="py-2">{cap.announcedLabel}</td>
                      <td className="py-2">
                        <a
                          href={cap.sourceUrl}
                          className="text-blue-700 underline-offset-2 hover:underline"
                        >
                          {cap.sourceLabel}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <ol className="mt-3 max-w-3xl list-none text-copy-14 text-gray-900">
            {footnotes.map((note) => (
              <li key={note.marker} className="mt-2">
                <sup className="mr-1">{note.marker}</sup>
                {note.note}
              </li>
            ))}
          </ol>
        </section>

        {model.unpublishedParagraph ? (
          <section>
            <h2 className="text-heading-24 text-gray-1000">What Ofgem has not published</h2>
            <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">{model.unpublishedParagraph}</p>
          </section>
        ) : null}

        <section>
          <h2 className="text-heading-24 text-gray-1000">How the wholesale part is set</h2>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
            Ofgem updates the cap every quarter. The wholesale allowance follows observed wholesale
            prices in a defined observation window. Secondary sources put the window for the January
            2027 cap at 19 August to 17 November 2026. Grid does not restate Ofgem&apos;s model.
          </p>
          <Card className="mt-4" title="GB gas SAP in that window">
            {sapSpark.length > 1 ? (
              <div className="mb-3">
                <Sparkline
                  values={sapSpark}
                  color="var(--chart-gas)"
                  label="GB gas SAP over the observation window"
                />
              </div>
            ) : null}
            <p className="text-copy-16 text-gray-1000">
              {sapWindow
                ? `National Gas SAP averaged ${sapWindow.average.toFixed(2)}p/kWh (${sapPencePerTherm(sapWindow.average).toFixed(1)} p/therm) over ${sapWindow.count} published gas days from ${formatLondonDayMonthYear(sapWindow.from)} to ${formatLondonDayMonthYear(sapWindow.to)}.`
                : "Grid does not yet have cached SAP days in that window."}{" "}
              Grid does not republish a separate NBP series.{" "}
              <Link href="/prices/gas" className="text-blue-700 underline-offset-2 hover:underline">
                GB gas price
              </Link>
              .
            </p>
          </Card>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">What the cap does and does not cover</h2>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
            The current published cap ({CURRENT_PRICE_CAP.periodLabel}) is £
            {CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp.toLocaleString("en-GB")} a year for a
            typical dual-fuel Direct Debit household. It limits unit rates and standing charges on
            default tariffs, not the total bill, and not a fixed deal you already signed. Official
            rates:{" "}
            <a
              href={OFGEM_PRICE_CAP_HUB_URL}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Ofgem price cap unit rates and standing charges
            </a>
            . Today&apos;s electricity mix:{" "}
            <Link href="/today" className="text-blue-700 underline-offset-2 hover:underline">
              /today
            </Link>
            .
          </p>
        </section>

        <SiteFaq items={faqs} />
      </SeoPage>
    </>
  );
}

function sapWindowSeries(prices: CommodityPrice[]): number[] {
  return prices
    .filter(
      (row) =>
        row.commodity === GB_GAS_SAP_COMMODITY &&
        row.date >= PRICE_CAP_OBSERVATION_WINDOW.from &&
        row.date <= PRICE_CAP_OBSERVATION_WINDOW.to,
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => row.price);
}
