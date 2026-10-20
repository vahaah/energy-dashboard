import type { Metadata } from "next";
import { attributionLine, ChangesBoard, type ChangeCard } from "@/components/changes/changes-board";
import { SeoPage } from "@/components/seo-page";
import { allChangeRows, readCheckedInChanges } from "@/lib/changes/query";
import { CHANGES_H1, CHANGES_STANDFIRST, CHANGES_TITLE } from "@/lib/changes/copy";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { projectPath } from "@/lib/projects/href";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: CHANGES_TITLE,
  description: CHANGES_STANDFIRST,
  path: "/changes",
  imagePath: "/changes/opengraph-image",
  imageAlt: CHANGES_TITLE,
});

export default function ChangesPage() {
  const model = allChangeRows(readCheckedInChanges());
  const cards: ChangeCard[] = (model?.changes ?? []).map((row, index) => ({
    key: `${row.entity_id}:${row.field}:${index}`,
    name: row.name,
    href: row.name === row.entity_id ? null : projectPath(row.entity_id, row.name),
    sentence: row.sentence,
    evidence: row.evidence,
    status: row.status,
    observedAt: row.observed_at,
    effectiveAt: row.effective_at,
  }));
  const today = getLondonDate(new Date());
  return (
    <SeoPage
      section="Changes"
      title={CHANGES_H1}
      breadcrumb={[{ label: "Changes" }]}
      cite={<p>{CHANGES_STANDFIRST}</p>}
      citation={`Grid, "What changed in Britain's energy system", grid.vahaah.com/changes, accessed ${formatLondonDayMonthYear(today)}.`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Changes</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{CHANGES_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{CHANGES_STANDFIRST}</p>
        </section>
      }
    >
      <ChangesBoard rows={cards} attribution={attributionLine(model?.sources ?? [])} />
    </SeoPage>
  );
}
