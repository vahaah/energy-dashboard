import type { Metadata } from "next";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { SeoPage } from "@/components/seo-page";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import {
  PIPELINE_CREDIT,
  PIPELINE_DESCRIPTION,
  PIPELINE_H1,
  PIPELINE_PATH,
  PIPELINE_TITLE,
} from "@/lib/pipeline/copy";
import { pipelineEditionStale, pipelinePublicationDay } from "@/lib/pipeline/freshness";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: PIPELINE_TITLE,
  description: PIPELINE_DESCRIPTION,
  path: PIPELINE_PATH,
  imagePath: "/pipeline/opengraph-image",
  imageAlt: PIPELINE_TITLE,
});

export default function PipelinePage() {
  const catalogue = loadPipelineCatalogue();
  const now = new Date();
  const stale = pipelineEditionStale(pipelinePublicationDay(catalogue.edition), now);
  return (
    <SeoPage
      section="Pipeline"
      title={PIPELINE_H1}
      breadcrumb={[{ label: "Pipeline" }]}
      cite={<p>{PIPELINE_DESCRIPTION}</p>}
      citation={`Grid, "What's in GB's pipeline of new energy projects?", grid.vahaah.com/pipeline, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${PIPELINE_CREDIT}.`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Pipeline</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{PIPELINE_H1}</h1>
        </section>
      }
    >
      <PipelineBoard figures={catalogue.figures} stamp={catalogue.stamp} stale={stale} />
    </SeoPage>
  );
}
