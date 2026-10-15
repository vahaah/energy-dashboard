import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AssetPageView } from "@/components/asset-page-view";
import { SeoPage } from "@/components/seo-page";
import { attachedFlows } from "@/lib/assets/cached-flows";
import { assetPageDescription } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { assetPageModel, type AssetPageModel } from "@/lib/assets/page-model";
import { resolveAssetRoute } from "@/lib/assets/route";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86_400;

export function generateStaticParams(): { id: string; slug: string }[] {
  return loadAssetCatalogue().rows.map((row) => {
    const path = resolveAssetRoute(row.id, undefined, [row]);
    const slug = path.status === 404 ? "asset" : path.location.split("/").at(-1) ?? "asset";
    return { id: row.id, slug };
  });
}

function withRegisterCredits(model: AssetPageModel, sources: readonly string[]): AssetPageModel {
  if (model.attributions.length > 0) {
    return model;
  }
  const catalogue = cataloguePageSources();
  const credits: string[] = [];
  if (sources.includes("REPD")) {
    const source = catalogue.find((item) => item.id === "desnz-repd");
    if (source) {
      credits.push(source.attribution);
    }
  }
  if (sources.includes("DUKES")) {
    const source = catalogue.find((item) => item.id === "desnz-dukes");
    if (source) {
      credits.push(source.attribution);
    }
  }
  return { ...model, attributions: credits };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id, slug } = await params;
  const catalogue = loadAssetCatalogue();
  const decision = resolveAssetRoute(id, slug, catalogue.rows);
  if (decision.status !== 200) {
    return {};
  }
  const detail = catalogue.details.get(id);
  if (!detail) {
    return {};
  }
  const model = withRegisterCredits(assetPageModel(detail), detail.row.sources);
  return buildPageMetadata({
    title: model.title,
    description: assetPageDescription(model.lede),
    path: model.canonicalPath,
    imagePath: "/og",
    imageAlt: model.title,
  });
}

export default async function AssetSlugPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const catalogue = loadAssetCatalogue();
  const decision = resolveAssetRoute(id, slug, catalogue.rows);
  if (decision.status === 404) {
    notFound();
  }
  if (decision.status === 308) {
    permanentRedirect(decision.location);
  }
  const detail = catalogue.details.get(id);
  if (!detail) {
    notFound();
  }
  const model = withRegisterCredits(assetPageModel(detail), detail.row.sources);
  const series = model.output.attached ? await attachedFlows(model.output.code) : null;
  return (
    <SeoPage
      section="Assets"
      title={model.name}
      header={<span className="sr-only">{model.title}</span>}
      breadcrumb={[{ href: "/assets", label: "Assets" }, { label: model.name }]}
      cite={null}
      citation={`Grid, "${model.name}", grid.vahaah.com${model.canonicalPath}, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <AssetPageView model={model} series={series} />
    </SeoPage>
  );
}
