import type { Metadata } from "next";
import Link from "next/link";
import { EnergyTransition } from "@/components/energy-transition";
import { LiveMixPrompt } from "@/components/live-mix-prompt";
import { ShareButton } from "@/components/share-button";
import { Sparkline } from "@/components/sparkline";
import { JsonLd } from "@/components/json-ld";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { SitePageHeader } from "@/components/site-page-header";
import { SitePublicNav } from "@/components/site-public-nav";
import { CARD_GRID_CLASS, Card, PAGE_STACK_CLASS } from "@/components/ui/card";
import {
  NESO_HISTORIC_MIX_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
} from "@/lib/attribution";
import {
  formatNesoOfficialLine,
  HIDE_SOLAR_RECORD,
  HIDE_ZERO_CARBON_RECORD,
  NESO_OFFICIAL_RECORDS,
} from "@/data/neso-official-records";
import { formatHeadlineGw } from "@/lib/facts";
import { metricProvenance, RECORD_METRICS, type RecordMetric } from "@/lib/metrics";
import {
  buildHistoricPeriodView,
  COAL_POWER_ENDED,
  COAL_POWER_ENDED_SOURCE,
  emptyRecordsWithDocumentedCoal,
  type GridRecords,
  type HistoricRecordPoint,
} from "@/lib/historic-mix";
import { recordsJsonLd } from "@/lib/jsonld";
import { recordsStandfirst } from "@/lib/records-standfirst";
import { getGridRecords, getHistoricPeriodView } from "@/lib/neso-historic";
import { formatLondonDateTimeStamp, formatLondonDayMonthYear, parseUtcDateTime } from "@/lib/london-time";
import {
  RECORDS_DESCRIPTION,
  RECORDS_H1,
  RECORDS_TITLE,
  SITE_ORIGIN,
  SITE_OG_IMAGE,
  SITE_OG_TYPE,
  SITE_TWITTER_CARD,
} from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";

const RECORDS_OG_IMAGE = {
  ...SITE_OG_IMAGE,
  url: "/records/opengraph-image",
  alt: RECORDS_TITLE,
};

export const metadata: Metadata = {
  title: RECORDS_TITLE,
  description: RECORDS_DESCRIPTION,
  alternates: { canonical: "/records" },
  openGraph: {
    type: SITE_OG_TYPE,
    title: RECORDS_TITLE,
    description: RECORDS_DESCRIPTION,
    url: "/records",
    images: [RECORDS_OG_IMAGE],
  },
  twitter: {
    ...SITE_TWITTER_CARD,
    title: RECORDS_TITLE,
    description: RECORDS_DESCRIPTION,
    images: [RECORDS_OG_IMAGE.url],
  },
};

export default async function RecordsPage() {
  const now = new Date();
  const [records, historic] = await Promise.all([
    getGridRecords(now).catch(() => emptyRecordsWithDocumentedCoal(now)),
    getHistoricPeriodView("all", now).catch(() => buildHistoricPeriodView([])),
  ]);

  const faqs = faqItems(records);

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <JsonLd data={recordsJsonLd({ faqs, records })} />
      <SitePageHeader section="Records" />

      <main className={PAGE_STACK_CLASS}>
        <nav aria-label="Breadcrumb" className="text-label-13 text-gray-900">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="text-blue-700 underline-offset-2 hover:underline">
                Grid
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <span aria-current="page">Records</span>
            </li>
          </ol>
        </nav>

        <section>
          <p className="text-label-13 text-gray-900">Great Britain</p>
          <h1 className="mt-1 text-heading-32 text-gray-1000">{RECORDS_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{recordsStandfirst(records)}</p>
          <LiveMixPrompt className="mt-4" />
          <div className="mt-4">
            <ShareButton url={`${SITE_ORIGIN}/records`} title={RECORDS_TITLE} />
          </div>
        </section>

        <section className={`${CARD_GRID_CLASS} lg:grid-cols-6`}>
          <RecordBlock
            className="lg:col-span-2"
            title="Highest wind since Grid's records began"
            value={`${formatHeadlineGw(records.maxWind?.value ?? null)} GW`}
            record={records.maxWind}
            metric={RECORD_METRICS.wind}
            nesoLine={formatNesoOfficialLine(NESO_OFFICIAL_RECORDS.wind)}
          />
          {HIDE_SOLAR_RECORD ? null : (
            <RecordBlock
              className="lg:col-span-2"
              title="Highest solar since Grid's records began"
              value={`${formatHeadlineGw(records.maxSolar?.value ?? null)} GW`}
              record={records.maxSolar}
              metric={RECORD_METRICS.solar}
              nesoLine={formatNesoOfficialLine(NESO_OFFICIAL_RECORDS.solar)}
            />
          )}
          <RecordBlock
            className="lg:col-span-2"
            title="Lowest carbon since Grid's records began"
            value={records.lowestCarbon ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh` : "Not available"}
            record={records.lowestCarbon}
            metric={RECORD_METRICS.carbon}
            nesoLine={formatNesoOfficialLine(
              NESO_OFFICIAL_RECORDS.lowest_carbon,
              historicLine(records.lowestCarbon, (value) => `${value.toFixed(0)} gCO₂/kWh`)
            )}
          />
          <RecordBlock
            className="lg:col-span-2"
            title="Highest renewable share since Grid's records began"
            value={
              records.highestRenewableShare
                ? `${records.highestRenewableShare.value.toFixed(1)}%`
                : "Not available"
            }
            record={records.highestRenewableShare}
            metric={RECORD_METRICS.renewable_share}
            nesoLine={formatNesoOfficialLine(
              NESO_OFFICIAL_RECORDS.renewable_share,
              historicLine(records.highestRenewableShare, (value) => `${value.toFixed(1)}%`)
            )}
          />
          {HIDE_ZERO_CARBON_RECORD ? null : (
            <RecordBlock
              className="lg:col-span-2"
              title="Highest zero-carbon share since Grid's records began"
              value={
                records.highestZeroCarbonShare
                  ? `${records.highestZeroCarbonShare.value.toFixed(1)}%`
                  : "Not available"
              }
              record={records.highestZeroCarbonShare}
              metric={RECORD_METRICS.zero_carbon_share}
              nesoLine={formatNesoOfficialLine(NESO_OFFICIAL_RECORDS.zero_carbon)}
            />
          )}
          <RecordBlock
            className="lg:col-span-6"
            title="Days since coal power ended"
            value={records.daysSinceCoal == null ? "Not available" : `${records.daysSinceCoal} days`}
            record={records.lastCoal}
            metric={RECORD_METRICS.coal_end}
            whenLabel={records.lastCoal ? formatLondonDayMonthYear(COAL_POWER_ENDED) : undefined}
            nesoLine="NESO: GB stopped using coal for electricity in 2024."
          />
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">First half-hour with wind above each gigawatt</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Transmission-connected wind plus embedded wind. The first half-hour that series
            reached each whole gigawatt from 10 GW up, since Grid&apos;s records began.
          </p>
          <Card className="mt-4">
            <div className="mb-3 flex items-center gap-3">
              <Sparkline
                variant="step"
                values={records.windMilestones.map((milestone) => milestone.gw)}
                color="var(--chart-wind)"
                label="Wind milestones, step"
              />
              <p className="text-copy-14 text-gray-900">First time the series reached each whole gigawatt.</p>
            </div>
            <div className="relative min-w-0 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-copy-14">
                <caption className="sr-only">Wind milestones since Grid&apos;s records began</caption>
                <thead className="text-label-13 text-gray-900">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">
                      Milestone
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      First half-hour (London)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.windMilestones.map((milestone) => (
                    <tr key={milestone.gw} className="border-t border-gray-alpha-200">
                      <td className="py-2 tabular-nums">{milestone.gw} GW</td>
                      <td className="py-2 text-copy-14">
                        {formatLondonDateTimeStamp(parseUtcDateTime(milestone.timestampUtc))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Coal gives way to wind</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Yearly averages computed from the same NESO historic series. The sentences use those
            averages; they are not hard-coded.
          </p>
          <Card className="mt-4">
            <EnergyTransition yearly={historic.yearly} sentences={historic.sentences} />
          </Card>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Questions</h2>
          <Card className="mt-4">
            <dl className="divide-y divide-gray-alpha-400">
              {faqs.map((faq) => (
                <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
                  <dt className="text-heading-16 text-gray-1000">{faq.question}</dt>
                  <dd className="mt-1 text-copy-14 text-gray-900">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        <footer className="border-t border-gray-alpha-400 pt-8 pb-4 text-copy-14 text-gray-900">
          <p>
            {NESO_OPEN_DATA_ATTRIBUTION}. Dataset:{" "}
            <a
              href={NESO_HISTORIC_MIX_URL}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Historic generation mix and carbon intensity
            </a>
            , under the{" "}
            <a
              href={NESO_OPEN_DATA_LICENCE_URL}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              NESO Open Data Licence
            </a>
            . Coal-end date:{" "}
            <a
              href={COAL_POWER_ENDED_SOURCE}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Uniper, Ratcliffe-on-Soar closed 30 Sep 2024
            </a>
            .
          </p>
          <p className="mt-3">
            <Link href="/" className="text-blue-700 underline-offset-2 hover:underline">
              Back to Grid
            </Link>
          </p>
          <SitePublicNav className="mt-4" />
          <SiteLegalNav className="mt-4" />
          <p className="mt-4">
            Made by{" "}
            <a
              href="https://vahaah.com/"
              rel="author"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Alex Vakhitov
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

function RecordBlock({
  title,
  value,
  record,
  metric,
  extra,
  whenLabel,
  nesoLine,
  className = "",
}: {
  title: string;
  value: string;
  record: HistoricRecordPoint | null;
  metric: RecordMetric;
  extra?: string;
  whenLabel?: string;
  nesoLine?: string;
  className?: string;
}) {
  const stamp =
    whenLabel ?? (record ? formatLondonDateTimeStamp(parseUtcDateTime(record.timestampUtc)) : null);

  return (
    <Card as="article" title={title} size="stat" className={className}>
      <p data-figure className="whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
        <span data-value>{value}</span>
      </p>
      {stamp ? <p className="mt-2 text-copy-14 text-gray-900">{stamp}</p> : null}
      <p className="mt-2 text-copy-14 text-gray-900">{metricProvenance(metric)}</p>
      {nesoLine ? <p className="mt-2 text-copy-14 text-gray-900">{nesoLine}</p> : null}
      {extra ? <p className="mt-2 text-copy-14 text-gray-900">{extra}</p> : null}
    </Card>
  );
}

function historicLine(
  record: HistoricRecordPoint | null,
  formatValue: (value: number) => string
): { valueLabel: string; whenLabel: string } | undefined {
  if (!record) {
    return undefined;
  }
  return {
    valueLabel: formatValue(record.value),
    whenLabel: formatLondonDateTimeStamp(parseUtcDateTime(record.timestampUtc)),
  };
}

function faqItems(records: GridRecords): Array<{ question: string; answer: string }> {
  const wind = records.maxWind
    ? `${formatHeadlineGw(records.maxWind.value)} GW at ${formatLondonDateTimeStamp(parseUtcDateTime(records.maxWind.timestampUtc))}`
    : "not yet computed";
  const carbon = records.lowestCarbon
    ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh at ${formatLondonDateTimeStamp(parseUtcDateTime(records.lowestCarbon.timestampUtc))}`
    : "not yet computed";

  return [
    {
      question: "What is the wind record based on?",
      answer: `Transmission-connected wind plus embedded wind from NESO historic generation mix, since Grid's records began. The current Grid record is ${wind}. ${formatNesoOfficialLine(NESO_OFFICIAL_RECORDS.wind)}.`,
    },
    {
      question: "Why is there no solar record?",
      answer:
        "Grid's solar peak currently disagrees with NESO's official record of 15.4 GW between 12:30 and 13:00 on 23 Apr 2026. The solar card is hidden until those figures match within 2%.",
    },
    {
      question: "Why is there no zero-carbon record?",
      answer:
        "NESO published 98.8% on 22 Apr 2026. Grid's share is wind, solar, hydro and nuclear over the historic generation total. Those are not the same definition, so the card is hidden rather than shown as one record.",
    },
    {
      question: "What was the lowest carbon half-hour since Grid's records began?",
      answer: `${carbon}. Rows with impossible shares, such as zero-carbon above 100%, are dropped before the minimum is taken.`,
    },
    {
      question: "When did GB stop burning coal for electricity?",
      answer:
        records.daysSinceCoal != null
          ? `GB's last coal power station, Ratcliffe-on-Soar, closed on 30 Sep 2024. That is ${records.daysSinceCoal} days ago. NESO historic mix still shows residual coal after closure; this record stays on the documented end date.`
          : "GB's last coal power station, Ratcliffe-on-Soar, closed on 30 Sep 2024.",
    },
  ];
}
