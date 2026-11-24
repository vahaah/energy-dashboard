import type { Metadata } from "next";
import { BalancingBoard } from "@/components/balancing/balancing-board";
import { BalancingExplainer } from "@/components/balancing/balancing-explainer";
import { BalancingStats } from "@/components/balancing/balancing-stats";
import { SeoPage } from "@/components/seo-page";
import { DataStateNotice } from "@/components/ui/data-state";
import { elexonBmrsAttribution } from "@/lib/attribution";
import { BALANCING_ATTRIBUTION, BALANCING_DESCRIPTION, BALANCING_H1, BALANCING_STANDFIRST, BALANCING_TITLE } from "@/lib/balancing/copy";
import { balancingFaqs, balancingPageSchema, balancingSummary, calendarTradeSentence } from "@/lib/balancing/leads";
import { balancingRangeSeries } from "@/lib/balancing/page-model";
import { readBalancingRelease } from "@/lib/balancing/load";
import { buildBalancingPage } from "@/lib/balancing/page-model";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const model = buildBalancingPage(await readBalancingRelease(), new Date());
  return buildPageMetadata({
    title: BALANCING_TITLE,
    description: BALANCING_DESCRIPTION,
    path: "/system/balancing",
    imagePath: "/system/balancing/opengraph-image",
    imageAlt: balancingSummary(model),
  });
}

export default async function BalancingPage() {
  const now = new Date();
  const model = buildBalancingPage(await readBalancingRelease(), now);
  const faqs = balancingFaqs(model);
  const tradeYear = calendarTradeSentence(model);
  const dailyRange = balancingRangeSeries(model, "90d");
  const monthlyRange = balancingRangeSeries(model, "1y");
  return (
    <SeoPage
      section="Balancing"
      title={BALANCING_H1}
      breadcrumb={[{ label: "System" }, { label: "Balancing" }]}
      schema={balancingPageSchema(model, faqs)}
      cite={<p>{BALANCING_STANDFIRST}</p>}
      citation={`Grid, "GB grid balancing costs and BSUoS", grid.vahaah.com/system/balancing, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${BALANCING_ATTRIBUTION} ${elexonBmrsAttribution(now.getUTCFullYear())}`}
      header={
        <section>
          <h1 className="text-heading-32 text-gray-1000">{BALANCING_H1}</h1>
          <p id="summary" className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">
            {balancingSummary(model)}
          </p>
          {tradeYear ? <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">{tradeYear}</p> : null}
          <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">{BALANCING_STANDFIRST}</p>
        </section>
      }
    >
      {model.available ? (
        <div className="flex min-w-0 flex-col gap-4">
          <BalancingStats model={model} />
          <BalancingBoard
            today={model.today}
            daily={dailyRange.daily}
            monthly={monthlyRange.monthly}
            trade={dailyRange.trade}
          />
          <BalancingExplainer model={model} faqs={faqs} />
        </div>
      ) : (
        <DataStateNotice state="not_yet_available" />
      )}
    </SeoPage>
  );
}
