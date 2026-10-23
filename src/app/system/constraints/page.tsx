import type { Metadata } from "next";
import { ConstraintsBoard } from "@/components/constraints/constraints-board";
import { SeoPage } from "@/components/seo-page";
import { DataStateNotice } from "@/components/ui/data-state";
import {
  CONSTRAINTS_ATTRIBUTION,
  CONSTRAINTS_H1,
  CONSTRAINTS_STANDFIRST,
  CONSTRAINTS_TITLE,
} from "@/lib/constraints/copy";
import { buildConstraintsPage } from "@/lib/constraints/page-model";
import { readPublishedHistory } from "@/lib/constraints/reader";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: CONSTRAINTS_TITLE,
  description: CONSTRAINTS_STANDFIRST,
  path: "/system/constraints",
  imagePath: "/system/constraints/opengraph-image",
  imageAlt: CONSTRAINTS_TITLE,
});

export default async function ConstraintsPage() {
  const now = new Date();
  const history = await readPublishedHistory();
  const model = buildConstraintsPage({
    breakdown: history.breakdown.latest,
    breakdownPrevious: history.breakdown.previous,
    dayAhead: history.dayAhead.latest,
    now,
  });

  return (
    <SeoPage
      section="Constraints"
      title={CONSTRAINTS_H1}
      breadcrumb={[{ label: "System" }, { label: "Constraints" }]}
      cite={<p>{CONSTRAINTS_STANDFIRST}</p>}
      citation={`Grid, "Grid constraints and their cost", grid.vahaah.com/system/constraints, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${CONSTRAINTS_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">System</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{CONSTRAINTS_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{CONSTRAINTS_STANDFIRST}</p>
        </section>
      }
    >
      {model.available ? <ConstraintsBoard model={model} /> : <DataStateNotice state="not_yet_available" />}
    </SeoPage>
  );
}
