import { notFound, permanentRedirect } from "next/navigation";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { resolveAssetRoute } from "@/lib/assets/route";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86_400;

export function generateStaticParams(): { id: string }[] {
  return loadAssetCatalogue().rows.map((row) => ({ id: row.id }));
}

export default async function AssetIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decision = resolveAssetRoute(id, undefined, loadAssetCatalogue().rows);
  if (decision.status === 404) {
    notFound();
  }
  permanentRedirect(decision.location);
}
