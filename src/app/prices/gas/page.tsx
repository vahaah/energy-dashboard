import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
import { Sparkline } from "@/components/sparkline";
import { Card, CARD_GRID_CLASS } from "@/components/ui/card";
import { Freshness } from "@/components/ui/freshness";
import {
  EIA_ATTRIBUTION,
  NATIONAL_GAS_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_ATTRIBUTION,
} from "@/lib/attribution";
import { loadCachedPublicPrices } from "@/lib/cached-prices";
import {
  buildGasPageModel,
  gasCitation,
  gasCitePlainText,
  gasFaqs,
  GAS_PAGE_SOURCES,
} from "@/lib/gas-page";
import { gasJsonLd } from "@/lib/jsonld";
import { getLondonDate } from "@/lib/london-time";
import { gasPageMetadata } from "@/lib/page-metadata";
import { GAS_H1 } from "@/lib/site";

export const revalidate = 3600;
export const dynamic = "force-static";
export const metadata: Metadata = gasPageMetadata();

export default async function GasPricePage() {
  const prices = await loadCachedPublicPrices("90d").catch(() => []);
  const model = buildGasPageModel(prices);
  const faqs = gasFaqs(model);
  const cite = gasCitePlainText(model);
  const accessed = getLondonDate(new Date());

  return (
    <>
      <JsonLd
        data={gasJsonLd({
          faqs,
          dateModified: model.sap ? `${model.sap.date}T00:00:00.000Z` : undefined,
        })}
      />
      <SeoPage
        section="Gas price"
        title={GAS_H1}
        breadcrumb={[{ label: "Prices" }, { label: "Gas" }]}
        cite={
          <p data-cite>
            {cite}{" "}
            <Link href="/gas" className="text-blue-700 underline-offset-2 hover:underline">
              Britain&apos;s gas system
            </Link>
            .
          </p>
        }
        citation={gasCitation(model, accessed)}
        updated={
          <p className="text-label-13 text-gray-900">
            {model.publishedLabel
              ? `Updated ${model.publishedLabel} · ${GAS_PAGE_SOURCES}`
              : GAS_PAGE_SOURCES}
          </p>
        }
      >
        <section className={CARD_GRID_CLASS}>
          {model.series.map((row) => (
            <Card as="article" key={row.commodity} title={row.label} size="stat">
              <div className="flex flex-wrap items-center gap-2">
                {row.monthly ? (
                  <span className="inline-flex h-6 items-center rounded-md border border-gray-alpha-400 px-1.5 text-label-13 text-gray-900">
                    Monthly
                  </span>
                ) : null}
                <Freshness state="current" asOf={row.dateLabel} />
              </div>
              <p data-figure className="mt-2 whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
                <span data-value>{row.value}</span>{" "}
                <span data-unit className="align-baseline text-heading-16 text-gray-900">
                  {row.unit}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Sparkline values={row.spark} color="var(--chart-gas)" label={`${row.label}, last ${row.spark.length} readings`} />
                {row.change ? <p className="text-copy-14 tabular-nums text-gray-900">{row.change}</p> : null}
              </div>
              <p className="mt-2 text-copy-14 text-gray-900">{row.source}</p>
            </Card>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="text-heading-24 text-gray-1000">What this means for electricity</h2>
          <p className="mt-2 text-copy-16 text-gray-900">
            Gas-fired stations are often the last plants needed to meet demand, so wholesale
            electricity prices frequently follow the cost of gas. The GB number here is National Gas
            SAP, not a separate NBP contract series. Henry Hub is the US benchmark from EIA. World
            Bank monthly Europe gas and Japan LNG are the Asian and European context Grid
            republishes. See{" "}
            <Link href="/today" className="text-blue-700 underline-offset-2 hover:underline">
              today&apos;s electricity mix
            </Link>{" "}
            and the{" "}
            <Link
              href="/explained/price-cap"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              price cap explainer
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Units and method</h2>
          <p className="mt-2 text-copy-16 text-gray-900">
            SAP is stored in p/kWh and shown in p/therm using 1 therm = 29.3071 kWh. Henry Hub is
            $/MMBtu. World Bank Pink Sheet series are monthly. Sources: {NATIONAL_GAS_ATTRIBUTION}{" "}
            {EIA_ATTRIBUTION} {WORLD_BANK_PINK_SHEET_ATTRIBUTION}{" "}
            <Link href="/methodology" className="text-blue-700 underline-offset-2 hover:underline">
              Methodology
            </Link>
            .
          </p>
        </section>
        </div>

        <SiteFaq items={faqs} />
      </SeoPage>
    </>
  );
}
