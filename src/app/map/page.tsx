import type { Metadata } from "next";
import { FlowsMap } from "@/components/flows-map";
import { JsonLd } from "@/components/json-ld";
import { SitePageHeader } from "@/components/site-page-header";
import { pageJsonLd } from "@/lib/jsonld";
import { loadFlowsPageModel } from "@/lib/map/load-flows";
import { mapPageMetadata } from "@/lib/page-metadata";
import { MAP_DESCRIPTION, MAP_TITLE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 1_800;

export const metadata: Metadata = mapPageMetadata();

export default async function MapPage() {
  const model = await loadFlowsPageModel();

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background-100 text-gray-1000">
      <JsonLd
        data={pageJsonLd({
          name: MAP_TITLE,
          description: MAP_DESCRIPTION,
          url: `${SITE_ORIGIN}/map`,
          breadcrumbs: [{ name: "Map", item: `${SITE_ORIGIN}/map` }],
        })}
      />
      <SitePageHeader section="Map" skipHref="#flow-list" skipLabel="Skip to flow list" />
      <div id="flow-list" className="min-h-0 flex-1">
        <FlowsMap model={model} />
      </div>
    </main>
  );
}
