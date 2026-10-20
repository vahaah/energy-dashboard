import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
import { Card } from "@/components/ui/card";
import { loadCachedPublicPrices } from "@/lib/cached-prices";
import { GB_GAS_SAP_COMMODITY, sapPencePerTherm } from "@/lib/gb-gas-sap";
import { meanCommodityInWindow } from "@/lib/gas-page";
import { priceCapJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { priceCapPageMetadata } from "@/lib/page-metadata";
import {
  CURRENT_PRICE_CAP,
  OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
  OFGEM_PRICE_CAP_HUB_URL,
  PRICE_CAP_FAQS,
  PRICE_CAP_OBSERVATION_WINDOW,
  PUBLISHED_PRICE_CAPS,
  priceCapAnswerFirst,
} from "@/lib/price-cap";
import { PRICE_CAP_H1 } from "@/lib/site";

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
  const cite = priceCapAnswerFirst();
  const faqs = [...PRICE_CAP_FAQS];

  return (
    <>
      <JsonLd data={priceCapJsonLd({ faqs })} />
      <SeoPage
        section="Explained"
        title={PRICE_CAP_H1}
        breadcrumb={[{ label: "Explained" }, { label: "Price cap" }]}
        cite={<p data-cite>{cite}</p>}
        citation={`Grid, "Will energy bills go up in January 2027?", grid.vahaah.com/explained/price-cap, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}. Data: Ofgem.`}
        updated={
          <p className="text-label-13 text-gray-900">
            Ofgem figures as published · Next announcement {OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}
          </p>
        }
      >
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
                    <th scope="col" className="pb-2 font-medium">
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
                  {PUBLISHED_PRICE_CAPS.map((cap) => (
                    <tr key={cap.periodFrom} className="border-t border-gray-alpha-200">
                      <th scope="row" className="py-2 font-medium">
                        {cap.periodLabel}
                      </th>
                      <td className="py-2 tabular-nums">£{cap.typicalDualFuelDirectDebitGbp.toLocaleString("en-GB")}</td>
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
          {PUBLISHED_PRICE_CAPS.flatMap((cap) =>
            cap.notes.map((note) => (
              <p key={`${cap.periodFrom}-${note}`} className="mt-3 max-w-3xl text-copy-14 text-gray-900">
                {cap.periodLabel}: {note}
              </p>
            ))
          )}
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">What Ofgem has not published</h2>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
            Ofgem announces the next cap, covering 1 January to 31 March 2027, on{" "}
            {OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}. That page may appear earlier. Grid is not showing a
            January 2027 figure, and this page does not forecast one.
          </p>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">How the wholesale part is set</h2>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
            Ofgem updates the cap every quarter. The wholesale allowance follows observed wholesale
            prices in a defined observation window. Secondary sources put the window for the January
            2027 cap at 19 August to 17 November 2026. Grid does not restate Ofgem&apos;s model.
          </p>
          <Card className="mt-4" title="GB gas SAP in that window">
            <p className="text-copy-16 text-gray-1000">
              {sapWindow
                ? `National Gas SAP averaged ${sapWindow.average.toFixed(2)}p/kWh (${sapPencePerTherm(sapWindow.average).toFixed(1)} p/therm) over ${sapWindow.count} published gas days from ${formatLondonDayMonthYear(sapWindow.from)} to ${formatLondonDayMonthYear(sapWindow.to)}.`
                : "Grid does not yet have cached SAP days in that window."}{" "}
              Grid does not republish a separate NBP series.{" "}
              <Link href="/prices/gas" className="text-blue-700 underline-offset-2 hover:underline">
                UK gas price
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
