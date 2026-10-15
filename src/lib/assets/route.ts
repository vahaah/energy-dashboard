import { assetPath } from "@/lib/assets/href";

export type AssetIdentity = {
  id: string;
  name: string;
};

export type AssetRouteDecision =
  | { status: 200; location: string }
  | { status: 308; location: string }
  | { status: 404 };

export function resolveAssetRoute(
  id: string,
  slug: string | undefined,
  assets: readonly AssetIdentity[],
): AssetRouteDecision {
  const asset = assets.find((item) => item.id === id);
  if (!asset) {
    return { status: 404 };
  }
  const location = assetPath(asset.id, asset.name);
  const requested = slug === undefined ? `/assets/${id}` : `/assets/${id}/${slug}`;
  if (requested !== location) {
    return { status: 308, location };
  }
  return { status: 200, location };
}
