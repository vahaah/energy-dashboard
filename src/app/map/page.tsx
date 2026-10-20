import type { Metadata } from "next";
import { FlowsMap } from "@/components/flows-map";
import { SitePageHeader } from "@/components/site-page-header";
import { loadFlowsPageModel } from "@/lib/map/load-flows";
import { mapPageMetadata } from "@/lib/page-metadata";
import "./maplibre.css";

export const dynamic = "force-static";
export const revalidate = 1_800;

export const metadata: Metadata = mapPageMetadata();

export default async function MapPage() {
  const model = await loadFlowsPageModel();

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background-100 text-gray-1000">
      <a
        href="#flow-list"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
      >
        Skip to flow list
      </a>
      <SitePageHeader section="Map" />
      <div id="flow-list" className="min-h-0 flex-1">
        <FlowsMap model={model} />
      </div>
    </main>
  );
}
