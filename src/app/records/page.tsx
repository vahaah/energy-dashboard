import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { EnergyTransition } from "@/components/energy-transition";
import {
  NESO_HISTORIC_MIX_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
} from "@/lib/attribution";
import { formatHeadlineGw } from "@/lib/facts";
import {
  buildHistoricPeriodView,
  COAL_POWER_ENDED,
  COAL_POWER_ENDED_SOURCE,
  emptyRecordsWithDocumentedCoal,
  type GridRecords,
  type HistoricRecordPoint,
} from "@/lib/historic-mix";
import { getGridRecords, getHistoricPeriodView } from "@/lib/neso-historic";
import { formatLondonDateTimeStamp, formatLondonDayMonthYear, parseUtcDateTime } from "@/lib/london-time";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "GB electricity records — Grid",
  description:
    "Great Britain electricity records: highest wind and solar, lowest carbon intensity, days since coal power ended, and the first times wind passed each gigawatt. From NESO historic generation mix.",
  openGraph: {
    title: "GB electricity records — Grid",
    description:
      "Wind, solar and carbon records for Great Britain, plus the coal-to-wind shift since 2009.",
    url: "https://grid.vahaah.com/records",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(faqs)) }}
      />
      <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-gray-1000">
            <span className="flex size-6 items-center justify-center rounded-md border border-gray-alpha-400 text-[11px] font-semibold">
              G
            </span>
            <span className="text-heading-16">Grid</span>
          </Link>
          <p className="text-label-13 text-gray-900">Records</p>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 py-8 sm:gap-16 sm:px-6 sm:py-10">
        <section>
          <p className="text-label-13 text-gray-900">Great Britain</p>
          <h1 className="mt-1 text-heading-32 text-gray-1000">Electricity records</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">
            Half-hour peaks and firsts from NESO historic generation mix, after dropping rows
            whose shares sit outside 0–100%, whose wind or solar exceeds published GB maxima, or
            whose fuel shares do not add to about 100%.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <RecordBlock
            title="Highest wind"
            value={`${formatHeadlineGw(records.maxWind?.value ?? null)} GW`}
            record={records.maxWind}
          />
          <RecordBlock
            title="Highest solar"
            value={`${formatHeadlineGw(records.maxSolar?.value ?? null)} GW`}
            record={records.maxSolar}
          />
          <RecordBlock
            title="Lowest carbon"
            value={records.lowestCarbon ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh` : "—"}
            record={records.lowestCarbon}
          />
          <RecordBlock
            title="Highest renewable share"
            value={
              records.highestRenewableShare
                ? `${records.highestRenewableShare.value.toFixed(1)}%`
                : "—"
            }
            record={records.highestRenewableShare}
          />
          <RecordBlock
            title="Highest zero-carbon share"
            value={
              records.highestZeroCarbonShare
                ? `${records.highestZeroCarbonShare.value.toFixed(1)}%`
                : "—"
            }
            record={records.highestZeroCarbonShare}
          />
          <RecordBlock
            title="Days since coal power ended"
            value={records.daysSinceCoal == null ? "—" : `${records.daysSinceCoal} days`}
            record={records.lastCoal}
            whenLabel={records.lastCoal ? formatLondonDayMonthYear(COAL_POWER_ENDED) : undefined}
          />
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">First time above N GW of wind</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Transmission-connected wind plus embedded wind. The first half-hour that series
            reached each whole gigawatt from 10 GW up.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-copy-14">
              <caption className="sr-only">Wind milestones</caption>
              <thead className="bg-background-200 text-label-13 text-gray-900">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Milestone
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    First half-hour (London)
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.windMilestones.map((milestone) => (
                  <tr key={milestone.gw} className="border-t border-gray-alpha-200">
                    <td className="px-3 py-2 tabular-nums">{milestone.gw} GW</td>
                    <td className="px-3 py-2 text-mono-12">
                      {formatLondonDateTimeStamp(parseUtcDateTime(milestone.timestampUtc))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Coal gives way to wind</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Yearly averages computed from the same NESO historic series. The sentences use those
            averages; they are not hard-coded.
          </p>
          <div className="mt-4">
            <EnergyTransition yearly={historic.yearly} sentences={historic.sentences} />
          </div>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Questions</h2>
          <dl className="mt-4 max-w-3xl space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-heading-16 text-gray-1000">{faq.question}</dt>
                <dd className="mt-1 text-copy-14 text-gray-900">{faq.answer}</dd>
              </div>
            ))}
          </dl>
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
            <Link href="/?focus=records" className="text-blue-700 underline-offset-2 hover:underline">
              Back to the live dashboard
            </Link>
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
  extra,
  whenLabel,
}: {
  title: string;
  value: string;
  record: HistoricRecordPoint | null;
  extra?: string;
  whenLabel?: string;
}) {
  const stamp =
    whenLabel ?? (record ? formatLondonDateTimeStamp(parseUtcDateTime(record.timestampUtc)) : null);

  return (
    <article className="surface-card p-4 sm:p-6">
      <h2 className="text-label-13 text-gray-900">{title}</h2>
      <p className="mt-2 font-sans text-heading-32 tabular-nums text-gray-1000">{value}</p>
      {stamp ? <p className="mt-2 text-mono-12 text-gray-900">{stamp}</p> : null}
      {record ? <p className="mt-2 text-copy-14 text-gray-900">{record.basis}</p> : null}
      {extra ? <p className="mt-2 text-copy-14 text-gray-900">{extra}</p> : null}
    </article>
  );
}

function faqItems(records: GridRecords): Array<{ question: string; answer: string }> {
  const wind = records.maxWind
    ? `${formatHeadlineGw(records.maxWind.value)} GW at ${formatLondonDateTimeStamp(parseUtcDateTime(records.maxWind.timestampUtc))}`
    : "not yet computed";
  const solar = records.maxSolar
    ? `${formatHeadlineGw(records.maxSolar.value)} GW at ${formatLondonDateTimeStamp(parseUtcDateTime(records.maxSolar.timestampUtc))}`
    : "not yet computed";
  const carbon = records.lowestCarbon
    ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh at ${formatLondonDateTimeStamp(parseUtcDateTime(records.lowestCarbon.timestampUtc))}`
    : "not yet computed";

  return [
    {
      question: "What is the wind record based on?",
      answer: `Transmission-connected wind plus embedded wind from NESO historic generation mix. The current record is ${wind}.`,
    },
    {
      question: "Is the solar record from PV Live?",
      answer: `No. All-time records use NESO historic mix solar, which includes embedded solar. The current record is ${solar}.`,
    },
    {
      question: "What was the lowest carbon half-hour?",
      answer: `${carbon}. Rows with impossible shares, such as zero-carbon above 100%, are dropped before the minimum is taken.`,
    },
    {
      question: "When did Britain stop burning coal for electricity?",
      answer:
        records.daysSinceCoal != null
          ? `Britain's last coal power station, Ratcliffe-on-Soar, closed on 30 Sep 2024. That is ${records.daysSinceCoal} days ago. NESO historic mix still shows residual coal after closure; this record stays on the documented end date.`
          : "Britain's last coal power station, Ratcliffe-on-Soar, closed on 30 Sep 2024.",
    },
  ];
}

function jsonLd(faqs: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: "Great Britain electricity records",
        description:
          "Derived records from NESO historic generation mix and carbon intensity: wind, solar, carbon, coal and wind milestones.",
        license: NESO_OPEN_DATA_LICENCE_URL,
        creator: { "@type": "Organization", name: "Grid" },
        temporalCoverage: "2009-01-01/..",
        spatialCoverage: "Great Britain",
        url: "https://grid.vahaah.com/records",
        isBasedOn: NESO_HISTORIC_MIX_URL,
        variableMeasured: [
          "Wind generation",
          "Solar generation",
          "Carbon intensity",
          "Coal generation",
        ],
        credits: NESO_OPEN_DATA_ATTRIBUTION,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}
