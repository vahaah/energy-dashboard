import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AssetPageView } from "@/components/asset-page-view";
import { SeoPage } from "@/components/seo-page";
import { attachedFlows } from "@/lib/assets/cached-flows";
import { assetPageDescription } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { assetPageModel } from "@/lib/assets/page-model";
import { resolveAssetRoute } from "@/lib/assets/route";
import { withRegisterCredits } from "@/lib/assets/credits";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { assetDetailIndexable } from "@/lib/seo/indexable";

export const dynamic = "force-static";
export const dynamicParams = true;
/** Same interval as WARMED_FLOW_REVALIDATE_SECONDS. Next requires a literal here. */
export const revalidate = 1_800;

export function generateStaticParams(): { id: string; slug: string }[] {
  return loadAssetCatalogue().rows.map((row) => {
    const path = resolveAssetRoute(row.id, undefined, [row]);
    const slug = path.status === 404 ? "asset" : path.location.split("/").at(-1) ?? "asset";
    return { id: row.id, slug };
  });
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
    imagePath: `${model.canonicalPath}/opengraph-image`,
    imageAlt: model.title,
    index: assetDetailIndexable(detail.row),
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
  const citation = `Grid, "${model.name}", grid.vahaah.com${model.canonicalPath}, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`;
  return (
    <SeoPage
      section="Assets"
      title={model.name}
      header={<span className="sr-only">{model.title}</span>}
      breadcrumb={[{ href: "/assets", label: "Assets" }, { label: model.name }]}
      cite={null}
      citation={citation}
    >
      <AssetPageView model={model} series={series} citation={citation} />
    </SeoPage>
  );
}
