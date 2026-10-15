import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PowerMap } from "@/components/power-map";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { assetPageDescription, assetPageTitle, formatMw, technologyLabel } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import type { AssetDetail, AssetMatchView } from "@/lib/assets/types";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import { buildPageMetadata } from "@/lib/page-metadata";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 86_400;

const ASSET_ID = /^ast_[a-f0-9]{16}$/;

export function generateStaticParams(): { id: string }[] {
  return loadAssetCatalogue().rows.map((row) => ({ id: row.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = loadAssetCatalogue().details.get(id);
  if (!detail) {
    return {};
  }
  const title = assetPageTitle(detail.row.name);
  return buildPageMetadata({
    title,
    description: assetPageDescription(detail.row),
    path: `/assets/${detail.row.id}`,
    imagePath: "/og",
    imageAlt: title,
  });
}

function publishedLabel(value: string | null): string {
  if (!value) {
    return "—";
  }
  return formatLondonDayMonthYear(value.slice(0, 10));
}

function matchCopy(match: AssetMatchView): string {
  const counted = match.countsSource === "REPD" ? "REPD megawatts count." : "DUKES megawatts count.";
  const distance = match.distanceM === null ? "" : ` Distance ${Math.round(match.distanceM)} m.`;
  return `Same site in both registers, matched by ${match.rule.replaceAll("_", " ")} (${match.confidence}). ${counted}${distance}`;
}

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ASSET_ID.test(id)) {
    notFound();
  }
  const catalogue = loadAssetCatalogue();
  const detail = catalogue.details.get(id);
  if (!detail) {
    notFound();
  }
  return (
    <SeoPage
      section="Assets"
      title={detail.row.name}
      breadcrumb={[{ href: "/assets", label: "Assets" }, { label: detail.row.name }]}
      cite={<AssetLede detail={detail} />}
      citation={`Grid, "${detail.row.name}", grid.vahaah.com/assets/${detail.row.id}, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <Card title="Record">
        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Fact term="Technology" value={technologyLabel(detail.row.technology)} />
          <Fact term="Status" value="Operational" />
          <Fact term="Capacity" value={formatMw(detail.row.mw)} />
          <Fact term="Region" value={detail.row.region} />
          <Fact term="Operator" value={detail.row.operator || "—"} />
          <Fact term="Source" value={detail.row.sources.join(", ")} />
          <Fact
            term="Coordinates"
            value={
              detail.row.latitude !== null && detail.row.longitude !== null
                ? `${detail.row.latitude.toFixed(5)}, ${detail.row.longitude.toFixed(5)}`
                : "No coordinates in the register"
            }
          />
          <Fact term="Country" value={detail.row.country ?? "—"} />
        </dl>
      </Card>
      <Card title="Capacity history">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-copy-14">
            <caption className="sr-only">Capacity by source release</caption>
            <thead>
              <tr className="text-label-13 text-gray-900">
                {["Release", "Published", "Source", "MW", "Counts"].map((label) => (
                  <th key={label} scope="col" className="border-b border-gray-alpha-400 py-2 pr-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.capacity.map((record) => (
                <tr key={record.capacityId} className="border-b border-gray-alpha-400 last:border-b-0">
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-gray-1000">
                    {record.downloadUrl ? (
                      <a href={record.downloadUrl} className="text-blue-700 underline-offset-2 hover:underline">
                        {record.edition || record.releaseId}
                      </a>
                    ) : (
                      record.edition || record.releaseId
                    )}
                  </th>
                  <td className="py-3 pr-3 text-gray-1000">{publishedLabel(record.publishedAt)}</td>
                  <td className="py-3 pr-3 text-gray-1000">{record.source}</td>
                  <td className="py-3 pr-3 text-gray-1000">{formatMw(record.mw)}</td>
                  <td className="py-3 pr-3 text-gray-1000">{record.counts ? "Counted" : "Not counted"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Source records">
        <ul className="flex min-w-0 flex-col gap-4">
          {detail.projects.map((project) => (
            <li key={project.projectId} className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
              <p className="text-copy-14 text-gray-1000">{project.name}</p>
              <p className="mt-1 text-label-13 text-gray-900">
                {project.source} · {project.externalRef}
                {project.operator ? ` · ${project.operator}` : ""}
                {project.region ? ` · ${project.region}` : ""}
                {project.county ? ` · ${project.county}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      {detail.matches.length > 0 ? (
        <Card title="Register match">
          <ul className="flex flex-col gap-3">
            {detail.matches.map((match) => (
              <li key={match.matchId} className="text-copy-14 text-gray-1000">
                {matchCopy(match)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card
        title="Location"
        footer={
          <div className="flex min-w-0 flex-col gap-2 break-words">
            <p>{catalogue.basemap.attribution}</p>
            {registerCredits(detail)}
          </div>
        }
      >
        {detail.row.latitude !== null && detail.row.longitude !== null ? (
          <>
            <PowerMap
              points={[
                {
                  id: detail.row.id,
                  name: detail.row.name,
                  technology: detail.row.technology,
                  mw: detail.row.mw,
                  region: detail.row.region,
                  latitude: detail.row.latitude,
                  longitude: detail.row.longitude,
                },
              ]}
              dnoPath={catalogue.dno.path}
              dnoVisible={false}
              assetsVisible
              selectedId={detail.row.id}
              className="h-64"
            />
            <p className="mt-4 text-copy-14 text-gray-900">
              <Link
                href={`/map?asset=${detail.row.id}`}
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                Open on the full map
              </Link>
            </p>
          </>
        ) : (
          <p className="text-copy-14 text-gray-900">No coordinates in the register.</p>
        )}
      </Card>
    </SeoPage>
  );
}

function AssetLede({ detail }: { detail: AssetDetail }) {
  return (
    <p>
      {technologyLabel(detail.row.technology)} in {detail.row.region}. {formatMw(detail.row.mw)} counted from{" "}
      {detail.row.sources.join(" and ")}.
    </p>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-13 text-gray-900">{term}</dt>
      <dd className="mt-1 break-words text-copy-16 text-gray-1000">{value}</dd>
    </div>
  );
}

function registerCredits(detail: AssetDetail) {
  const wanted = new Set(detail.row.sources);
  const sources = cataloguePageSources().filter((source) => {
    if (source.id === "desnz-repd") {
      return wanted.has("REPD");
    }
    if (source.id === "desnz-dukes") {
      return wanted.has("DUKES");
    }
    return false;
  });
  return sources.map((source) => (
    <p key={source.id}>
      {source.name}. {source.attribution}
    </p>
  ));
}
