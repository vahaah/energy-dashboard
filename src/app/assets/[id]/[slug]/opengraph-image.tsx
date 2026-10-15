import { notFound } from "next/navigation";
import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { withRegisterCredits } from "@/lib/assets/credits";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { assetPageModel } from "@/lib/assets/page-model";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 1_800;
export const alt = "GB power asset";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function AssetOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;
  const detail = loadAssetCatalogue().details.get(id);
  if (!detail) {
    notFound();
  }
  const model = withRegisterCredits(assetPageModel(detail), detail.row.sources);
  return renderOgImageResponse(
    {
      kind: "asset",
      title: model.name,
      kicker: model.technologyLabel,
      source: model.attributions.join(" ") || OGL_V3_ATTRIBUTION,
    },
    snapshot,
  );
}
