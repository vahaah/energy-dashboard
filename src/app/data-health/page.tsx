import type { Metadata } from "next";
import Link from "next/link";
import { DataHealthReading } from "@/components/data-health-reading";
import { MapLayerChangeNotice } from "@/components/map-layer-change";
import { SeoPage } from "@/components/seo-page";
import { CARD_GRID_CLASS, Card } from "@/components/ui/card";
import {
  constraintMetricIds,
  eirgridMetricIds,
  featuredMetricIds,
  loadDataHealth,
  type DataHealthReading as Reading,
} from "@/lib/data-health";
import { NI_PATH } from "@/lib/eirgrid/copy";
import { physicalGasCoverage } from "@/lib/metrics";
import { readDnoLayerFlag } from "@/lib/map/layer-flag";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { dataHealthPageMetadata } from "@/lib/page-metadata";
import { DATA_HEALTH_H1 } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = dataHealthPageMetadata();

export default async function DataHealthPage() {
  const readings = await loadDataHealth(new Date());
  const mapLayerFlag = await readDnoLayerFlag();
  const featuredIds = new Set<string>(featuredMetricIds());
  const constraintIds = new Set<string>(constraintMetricIds());
  const northernIrelandIds = new Set<string>(eirgridMetricIds());
  const featured = featuredMetricIds().map((id) => readings.find((reading) => reading.metric_id === id));
  const constraints = readings.filter((reading) => constraintIds.has(reading.metric_id));
  const northernIreland = readings.filter((reading) => northernIrelandIds.has(reading.metric_id));
  const rest = readings.filter(
    (reading) =>
      !featuredIds.has(reading.metric_id) &&
      !constraintIds.has(reading.metric_id) &&
      !northernIrelandIds.has(reading.metric_id),
  );

  return (
    <SeoPage
      section="Data health"
      title={DATA_HEALTH_H1}
      breadcrumb={[{ label: "Data health" }]}
      cite={
        <p data-cite>
          Published is the source time on the warmed row. Retrieved is when Grid stored that
          envelope. A series is stale once that source time is older than its expected cadence
          plus its publication lag. NTS intraday series are stale when that source time is more
          than 3 hours old. A completed gas day stays current. A missing value stays —.
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
      <section id="nts" className="scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">National Transmission System</h2>
        <Card className="mt-4" title="Physical gas">
          <p className="break-words text-copy-14 text-gray-900">
            Supply, demand, linepack and storage for the gas day. These series are separate from the System Average Price.
          </p>
          <ul className="mt-4 flex flex-col">
            {physicalGasCoverage().map((series) => (
              <li
                key={series.dataset_id}
                className="border-t border-gray-alpha-400 py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <p className="text-copy-14 text-gray-1000">{series.dataset_id}</p>
                <p className="text-label-12 text-gray-900">{series.expected_cadence}</p>
                <p className="mt-1 break-words text-copy-14 text-gray-900">{series.coverage}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
      <section id="constraints" className="scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Transmission constraints</h2>
        <Card className="mt-4" title="NESO constraints">
          <p className="break-words text-copy-14 text-gray-900">
            Published constraint cost and volume, and the day-ahead boundary snapshot. Cost stays in £.
            Volume stays in MWh.
          </p>
          <ul className="mt-4 flex flex-col">
            {constraints.map((reading) => (
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
      <section id="northern-ireland" className="scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Northern Ireland</h2>
        <Card className="mt-4" title="SONI and SEMO">
          <p className="break-words text-copy-14 text-gray-900">
            Outside GB. Northern Ireland, Ireland, and all-island stay on separate series. A missing value stays —.
          </p>
          <p className="mt-3">
            <Link href={NI_PATH} className="text-copy-14 text-blue-700 underline-offset-2 hover:underline">
              Northern Ireland electricity
            </Link>
          </p>
          <ul className="mt-4 flex flex-col">
            {northernIreland.map((reading) => (
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
      <section id="storage" className="scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Electricity storage</h2>
        <Card className="mt-4" title="Pumped storage and batteries">
          <p className="break-words text-copy-14 text-gray-900">
            Discharge and charging from the warmed FUELINST envelope. The storage page keeps the DESNZ inventory
            separate from this monitored fleet.
          </p>
          <p className="mt-3">
            <Link href="/system/storage" className="text-copy-14 text-blue-700 underline-offset-2 hover:underline">
              Storage
            </Link>
          </p>
          <ul className="mt-4 flex flex-col">
            {storageReadings(readings).map((reading) => (
              <li
                key={reading.metric_id}
                className="border-t border-gray-alpha-400 py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <DataHealthReading reading={reading} />
              </li>
            ))}
          </ul>
        </Card>
      </section>
      {mapLayerFlag ? <MapLayerChangeNotice pointer={mapLayerFlag} /> : null}
    </SeoPage>
  );
}

const STORAGE_METRIC_IDS = [
  "elec.gb.generation.pumped_storage",
  "elec.gb.generation.battery",
  "elec.gb.storage.charging",
] as const;

function storageReadings(readings: readonly Reading[]): Reading[] {
  const byId = new Map(readings.map((reading) => [reading.metric_id, reading]));
  const rows: Reading[] = [];
  for (const id of STORAGE_METRIC_IDS) {
    const reading = byId.get(id);
    if (reading) {
      rows.push(reading);
    }
  }
  return rows;
}

function SeriesRow({ reading }: { reading: Reading }) {
  return <DataHealthReading reading={reading} />;
}
