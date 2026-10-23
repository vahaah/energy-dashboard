import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ProjectProfileView } from "@/components/projects/project-profile";
import { SeoPage } from "@/components/seo-page";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { projectDetailIndexable } from "@/lib/seo/indexable";
import {
  PROJECTS_ATTRIBUTION,
  PROJECTS_EYEBROW,
  PROJECTS_PATH,
  PROJECT_PROFILE_STANDFIRST,
  projectProfileH1,
  projectProfileTitle,
} from "@/lib/projects/copy";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { buildProjectProfile } from "@/lib/projects/page-model";
import { resolveProjectRoute } from "@/lib/projects/route";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86_400;

export function generateStaticParams(): { id: string; slug: string }[] {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id, slug } = await params;
  const catalogue = loadProjectCatalogue();
  const decision = resolveProjectRoute(id, slug, catalogue.projects);
  if (decision.status !== 200) {
    return {};
  }
  const project = catalogue.byId.get(id);
  if (!project) {
    return {};
  }
  const profile = buildProjectProfile(project, catalogue.changes.events);
  return buildPageMetadata({
    title: projectProfileTitle(project.name),
    description: PROJECT_PROFILE_STANDFIRST,
    path: profile.href,
    imagePath: `${profile.href}/opengraph-image`,
    imageAlt: projectProfileTitle(project.name),
    index: projectDetailIndexable(project),
  });
}

export default async function ProjectSlugPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const catalogue = loadProjectCatalogue();
  const decision = resolveProjectRoute(id, slug, catalogue.projects);
  if (decision.status === 404) {
    notFound();
  }
  if (decision.status === 308) {
    permanentRedirect(decision.location);
  }
  const project = catalogue.byId.get(id);
  if (!project) {
    notFound();
  }
  const profile = buildProjectProfile(project, catalogue.changes.events);
  const now = new Date();
  return (
    <SeoPage
      section={PROJECTS_EYEBROW}
      title={projectProfileH1(project.name)}
      breadcrumb={[{ href: PROJECTS_PATH, label: PROJECTS_EYEBROW }, { label: project.name }]}
      cite={<p>{PROJECT_PROFILE_STANDFIRST}</p>}
      citation={`Grid, "${project.name}", grid.vahaah.com${profile.href}, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${PROJECTS_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{PROJECTS_EYEBROW}</p>
          <h1 className="mt-2 break-words text-heading-32 text-gray-1000">{projectProfileH1(project.name)}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{PROJECT_PROFILE_STANDFIRST}</p>
        </section>
      }
    >
      <ProjectProfileView profile={profile} />
    </SeoPage>
  );
}
