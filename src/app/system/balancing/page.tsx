import type { Metadata } from "next";
import { BalancingBoard } from "@/components/balancing/balancing-board";
import { BalancingExplainer } from "@/components/balancing/balancing-explainer";
import { BalancingStats } from "@/components/balancing/balancing-stats";
import { SeoPage } from "@/components/seo-page";
import { DataStateNotice } from "@/components/ui/data-state";
import { elexonBmrsAttribution } from "@/lib/attribution";
import {
  BALANCING_ATTRIBUTION,
  BALANCING_DESCRIPTION,
  BALANCING_FAQS,
  BALANCING_H1,
  BALANCING_STANDFIRST,
  BALANCING_TITLE,
} from "@/lib/balancing/copy";
import { readBalancingRelease } from "@/lib/balancing/load";
import { buildBalancingPage } from "@/lib/balancing/page-model";
import { pageJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: BALANCING_TITLE,
  description: BALANCING_DESCRIPTION,
  path: "/system/balancing",
  imagePath: "/system/balancing/opengraph-image",
  imageAlt: BALANCING_TITLE,
});

export default async function BalancingPage() {
  const now = new Date();
  const model = buildBalancingPage(await readBalancingRelease(), now);
  return (
    <SeoPage
      section="Balancing"
      title={BALANCING_H1}
      breadcrumb={[{ label: "System" }, { label: "Balancing" }]}
      schema={pageJsonLd({
        name: BALANCING_TITLE,
        description: BALANCING_DESCRIPTION,
        url: `${SITE_ORIGIN}/system/balancing`,
        breadcrumbs: [
          { name: "System", item: `${SITE_ORIGIN}/system/balancing` },
          { name: "Balancing", item: `${SITE_ORIGIN}/system/balancing` },
        ],
        faqs: [...BALANCING_FAQS],
      })}
      cite={<p>{BALANCING_STANDFIRST}</p>}
      citation={`Grid, "What it costs to balance Britain's grid", grid.vahaah.com/system/balancing, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${BALANCING_ATTRIBUTION} ${elexonBmrsAttribution(now.getUTCFullYear())}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">System</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{BALANCING_H1}</h1>
          <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">{BALANCING_STANDFIRST}</p>
        </section>
      }
    >
      {model.available ? (
        <div className="flex min-w-0 flex-col gap-4">
          <BalancingStats model={model} />
          <BalancingBoard model={model} />
          <BalancingExplainer model={model} />
        </div>
      ) : (
        <DataStateNotice state="not_yet_available" />
      )}
    </SeoPage>
  );
}
