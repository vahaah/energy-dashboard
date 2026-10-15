import type { Metadata } from "next";
import Link from "next/link";
import { MapExplorer } from "@/components/map-explorer";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { formatMw, MAP_COVERAGE_COPY, technologyLabel } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { mapPageMetadata } from "@/lib/page-metadata";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = mapPageMetadata();

export default function MapPage() {
  const catalogue = loadAssetCatalogue();
  const largest = catalogue.rows
    .filter((row) => row.mw !== null)
    .slice()
    .sort((left, right) => (right.mw ?? 0) - (left.mw ?? 0) || left.name.localeCompare(right.name))
    .slice(0, 8);
  const technologies = [...new Set(catalogue.points.map((point) => point.technology))].sort((left, right) =>
    technologyLabel(left).localeCompare(technologyLabel(right)),
  );

  return (
    <SeoPage
      section="Map"
      title="Power assets"
      breadcrumb={[{ label: "Map" }]}
      skipHref="#asset-list"
      skipLabel="Skip to asset list"
      cite={<p data-map-coverage>{MAP_COVERAGE_COPY}</p>}
      citation={`Grid, "Power assets", grid.vahaah.com/map, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <MapExplorer
        points={catalogue.points}
        basemap={catalogue.basemap}
        dno={catalogue.dno}
        technologies={technologies}
      />
      <Card title="Largest stations">
        <ol id="asset-list" className="flex min-w-0 flex-col gap-3">
          {largest.map((row) => (
            <li key={row.id} className="min-w-0">
              <Link href={`/assets/${row.id}`} className="text-blue-700 underline-offset-2 hover:underline">
                {row.name}
              </Link>
              <span className="text-copy-14 text-gray-900">
                {" "}
                · {technologyLabel(row.technology)} · {formatMw(row.mw)} · {row.region}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-copy-14 text-gray-900">
          <Link href="/assets" className="text-blue-700 underline-offset-2 hover:underline">
            All {catalogue.rows.length.toLocaleString("en-GB")} stations
          </Link>
        </p>
      </Card>
      <ul className="sr-only">
        {catalogue.rows.map((row) => (
          <li key={row.id}>
            <Link href={`/assets/${row.id}`}>
              {row.name}, {technologyLabel(row.technology)}, {formatMw(row.mw)}, {row.region}, {row.source}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPage>
  );
}
