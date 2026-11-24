import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { SiteFaq } from "@/components/site-faq";
import { Card, CARD_GRID_CLASS } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { formatHeadlineGw } from "@/lib/facts";
import { todayJsonLd } from "@/lib/jsonld";
import { addUtcDays, formatLondonDayMonthYear } from "@/lib/london-time";
import { todayPageMetadata } from "@/lib/page-metadata";
import { TODAY_H1 } from "@/lib/site";
import {
  buildTodayPageModel,
  todayCitation,
  todayCitePlainText,
  todayFaqs,
  TODAY_CITE_SOURCES,
  TODAY_STANDFIRST,
} from "@/lib/today-page";

export const revalidate = 3600;
export const dynamic = "force-static";
export const metadata: Metadata = todayPageMetadata();

export default async function TodayPage() {
  const now = new Date();
  const [day, week] = await Promise.all([
    loadDashboardPayload({ period: "day", now }).catch(() => null),
    loadDashboardPayload({ period: "week", now }).catch(() => null),
  ]);
  const model = buildTodayPageModel({ day, week, now });
  const faqs = todayFaqs(model);
  const cite = todayCitePlainText(model);
  const dateModified = model.dateModified ?? undefined;

  return (
    <>
      <JsonLd data={todayJsonLd({ faqs, dateModified })} />
      <SeoPage
        section="Today"
        title={TODAY_H1}
        breadcrumb={[{ label: "Today" }]}
        cite={
          model.kind === "numbers" && model.untilDatetime && model.untilClock ? (
            <p data-cite>
              {TODAY_STANDFIRST} So far today ({model.dateLabel}, to{" "}
              <time dateTime={model.untilDatetime}>{model.untilClock}</time>), wind supplied{" "}
              {Math.round(model.shares.windPct ?? 0)}% of GB generation, gas{" "}
              {Math.round(model.shares.gasPct ?? 0)}%, nuclear {Math.round(model.shares.nuclearPct ?? 0)}%
              and solar {Math.round(model.shares.solarPct ?? 0)}%. Carbon intensity averaged{" "}
              {model.carbonAverage == null ? "not available" : model.carbonAverage.toFixed(0)} gCO₂/kWh and the market index averaged £
              {model.priceAverage == null ? "not available" : model.priceAverage.toFixed(0)}/MWh. {TODAY_CITE_SOURCES}
            </p>
          ) : (
            <p data-cite>{cite}</p>
          )
        }
        citation={todayCitation(model, now)}
        updated={
          model.untilDatetime && model.untilClock ? (
            <p className="text-label-13 text-gray-900">
              Data to{" "}
              <time dateTime={model.untilDatetime}>{model.untilClock}</time>
              {" · "}
              {TODAY_CITE_SOURCES}
            </p>
          ) : (
            <p className="text-label-13 text-gray-900">{TODAY_CITE_SOURCES}</p>
          )
        }
      >
        <p className="text-copy-16 text-gray-900">
          <Link href="/explained/price-cap" className="text-blue-700 underline-offset-2 hover:underline">
            Energy price cap
          </Link>
          {" · "}
          <Link href="/prices/gas" className="text-blue-700 underline-offset-2 hover:underline">
            GB gas price
          </Link>
          {" · "}
          <Link href="/methodology" className="text-blue-700 underline-offset-2 hover:underline">
            Methodology
          </Link>
        </p>

        <section className={CARD_GRID_CLASS}>
          <Card as="article" title="Demand, latest half-hour" size="stat" id="demand">
            <p data-figure className="whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
              <span data-value>{model.latest.demandGw}</span>
              <span data-unit className="align-baseline">
                {" "}
                GW
              </span>
            </p>
            <p className="mt-2 text-copy-14 text-gray-900">
              Generation {model.latest.generationGw} GW
              {model.latest.importsGw && model.latest.exportsGw
                ? `. Importing ${model.latest.importsGw} GW, exporting ${model.latest.exportsGw} GW`
                : ""}
              {model.latest.carbon ? ` · ${model.latest.carbon} gCO₂/kWh` : ""}
              {model.latest.price ? ` · £${model.latest.price}/MWh` : ""}.
            </p>
          </Card>
          <Card as="article" title="Gas share of generation so far today" size="stat">
            <p data-figure className="whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
              <span data-value>
                {model.shares.gasPct == null ? "—" : Math.round(model.shares.gasPct)}
              </span>
              {model.shares.gasPct == null ? null : (
                <span data-unit className="align-baseline">
                  %
                </span>
              )}
            </p>
            <p className="mt-2 text-copy-14 text-gray-900">
              {model.shares.gasGw == null
                ? "Gas share so far today."
                : `${formatHeadlineGw(model.shares.gasGw)} GW average · ${model.shares.gasGwh?.toFixed(1) ?? "—"} GWh so far today.`}
            </p>
          </Card>
          <Card as="article" title="Lowest market index" size="stat">
            <p data-figure className="whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
              <span data-value>{model.cheapest ? `£${model.cheapest.value.toFixed(2)}` : "—"}</span>
            </p>
            <p className="mt-2 text-copy-14 text-gray-900">
              {model.cheapest ? `${model.cheapest.clock}` : "No market index yet today."}
            </p>
          </Card>
          <Card as="article" title="Highest market index" size="stat">
            <p data-figure className="whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
              <span data-value>{model.dearest ? `£${model.dearest.value.toFixed(2)}` : "—"}</span>
            </p>
            <p className="mt-2 text-copy-14 text-gray-900">
              {model.dearest ? `${model.dearest.clock}` : "No market index yet today."}
            </p>
          </Card>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Today, yesterday and the past 7 days</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            The past 7 days are the last seven days.
          </p>
          <Card className="mt-4">
            <TableScroll>
              <table className="w-full min-w-[560px] text-left text-copy-14">
                <caption className="sr-only">Today compared with yesterday and the past 7 days</caption>
                <thead className="text-label-13 text-gray-900">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">
                      Window
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Carbon
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Demand
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Market index
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Gas share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow label="Today so far" values={model.comparison.today} />
                  <ComparisonRow
                    label={`Yesterday (${formatLondonDayMonthYear(addUtcDays(model.londonDate, -1))})`}
                    values={model.comparison.yesterday}
                  />
                  <ComparisonRow label="Past 7 days" values={model.comparison.week} />
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </section>

        <section id="interconnectors">
          <h2 className="text-heading-24 text-gray-1000">Imports and exports</h2>
          <Card className="mt-4">
            {model.interconnectors.length === 0 ? (
              <p className="text-copy-14 text-gray-900">No interconnector flows in the latest half-hour.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-copy-14">
                {model.interconnectors.map((flow) => {
                  const peak = Math.max(...model.interconnectors.map((row) => Math.abs(row.mw)), 1);
                  const direction = flow.mw > 0 ? "Import" : flow.mw < 0 ? "Export" : "Flat";
                  const arrow = flow.mw > 0 ? "→" : flow.mw < 0 ? "←" : "·";
                  const width = `${Math.round((Math.abs(flow.mw) / peak) * 100)}%`;
                  return (
                    <li key={flow.country} className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-gray-1000">{flow.country}</span>
                        <span className="tabular-nums text-gray-900">
                          {arrow} {direction} {flow.gwLabel} GW
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200" aria-hidden="true">
                        <div
                          className="h-1.5 rounded-sm"
                          style={{
                            width,
                            backgroundColor: flow.mw < 0 ? "var(--chart-biomass)" : "var(--chart-imports)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <p className="text-copy-14 text-gray-900">
          See this settlement day on the homepage:{" "}
          <Link
            href={`/?date=${model.londonDate}`}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            {formatLondonDayMonthYear(model.londonDate)}
          </Link>
          . Method and licences:{" "}
          <Link href="/methodology" className="text-blue-700 underline-offset-2 hover:underline">
            /methodology
          </Link>
          .
        </p>

        <SiteFaq items={faqs} />
      </SeoPage>
    </>
  );
}

function ComparisonRow({
  label,
  values,
}: {
  label: string;
  values: {
    carbon: number | null;
    demandGw: number | null;
    price: number | null;
    gasSharePct: number | null;
  };
}) {
  return (
    <tr className="border-t border-gray-alpha-200">
      <th scope="row" className="py-2 font-medium">
        {label}
      </th>
      <td className="py-2 tabular-nums">{values.carbon == null ? "—" : `${values.carbon.toFixed(0)} gCO₂/kWh`}</td>
      <td className="py-2 tabular-nums">{values.demandGw == null ? "—" : `${values.demandGw.toFixed(1)} GW`}</td>
      <td className="py-2 tabular-nums">{values.price == null ? "—" : `£${values.price.toFixed(0)}/MWh`}</td>
      <td className="py-2 tabular-nums">
        {values.gasSharePct == null ? "—" : `${Math.round(values.gasSharePct)}%`}
      </td>
    </tr>
  );
}

