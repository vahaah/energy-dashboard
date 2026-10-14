import type { Metadata } from "next";
import { DataHealthReading } from "@/components/data-health-reading";
import { SeoPage } from "@/components/seo-page";
import { CARD_GRID_CLASS, Card } from "@/components/ui/card";
import { featuredMetricIds, loadDataHealth, type DataHealthReading as Reading } from "@/lib/data-health";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { dataHealthPageMetadata } from "@/lib/page-metadata";
import { DATA_HEALTH_H1 } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = dataHealthPageMetadata();

export default async function DataHealthPage() {
  const readings = await loadDataHealth(new Date());
  const featuredIds = new Set<string>(featuredMetricIds());
  const featured = featuredMetricIds().map((id) => readings.find((reading) => reading.metric_id === id));
  const rest = readings.filter((reading) => !featuredIds.has(reading.metric_id));

  return (
    <SeoPage
      section="Data health"
      title={DATA_HEALTH_H1}
      breadcrumb={[{ label: "Data health" }]}
      cite={
        <p data-cite>
          Published is the source time on the warmed row. Retrieved is when Grid stored that
          envelope. A series is stale once that source time is older than its expected cadence
          plus its publication lag. A missing value stays —.
        </p>
      }
      citation={`Grid, "Data health", grid.vahaah.com/data-health, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <section>
        <h2 className="text-heading-24 text-gray-1000">Source time and Grid time</h2>
        <div className={`mt-4 ${CARD_GRID_CLASS}`}>
          {featured.map((reading) =>
            reading ? (
              <Card key={reading.metric_id}>
                <DataHealthReading reading={reading} featured />
              </Card>
            ) : null
          )}
        </div>
      </section>
      <section>
        <h2 className="text-heading-24 text-gray-1000">Every series</h2>
        <Card className="mt-4" title="Registry">
          <ul className="flex flex-col">
            {rest.map((reading) => (
              <li
                key={reading.metric_id}
                className="border-t border-gray-alpha-400 py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <SeriesRow reading={reading} />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </SeoPage>
  );
}

function SeriesRow({ reading }: { reading: Reading }) {
  return <DataHealthReading reading={reading} />;
}
