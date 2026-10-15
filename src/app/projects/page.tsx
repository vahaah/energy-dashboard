import type { Metadata } from "next";
import { ProjectsBoard } from "@/components/projects/projects-board";
import { SeoPage } from "@/components/seo-page";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import {
  PROJECTS_ATTRIBUTION,
  PROJECTS_EYEBROW,
  PROJECTS_H1,
  PROJECTS_PATH,
  PROJECTS_STANDFIRST,
  PROJECTS_TITLE,
} from "@/lib/projects/copy";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { buildProjectsDocument } from "@/lib/projects/page-model";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = buildPageMetadata({
  title: PROJECTS_TITLE,
  description: PROJECTS_STANDFIRST,
  path: PROJECTS_PATH,
  imagePath: "/projects/opengraph-image",
  imageAlt: PROJECTS_TITLE,
});

export default function ProjectsPage() {
  const now = new Date();
  const document = buildProjectsDocument(loadProjectCatalogue().projects);
  return (
    <SeoPage
      section={PROJECTS_EYEBROW}
      title={PROJECTS_H1}
      breadcrumb={[{ label: PROJECTS_EYEBROW }]}
      cite={<p>{PROJECTS_STANDFIRST}</p>}
      citation={`Grid, "Energy projects in Britain", grid.vahaah.com${PROJECTS_PATH}, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${PROJECTS_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{PROJECTS_EYEBROW}</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{PROJECTS_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{PROJECTS_STANDFIRST}</p>
        </section>
      }
    >
      <ProjectsBoard document={document} />
    </SeoPage>
  );
}
