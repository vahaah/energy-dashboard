import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CiteButton } from "@/components/cite-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ProjectProfileView } from "@/components/projects/project-profile";
import { SeoPage } from "@/components/seo-page";
import { ShareButton } from "@/components/share-button";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { projectDetailIndexable } from "@/lib/seo/indexable";
import {
  PROJECTS_ATTRIBUTION,
  PROJECTS_EYEBROW,
  PROJECTS_PATH,
  PROJECT_PROFILE_SOURCE,
  PROJECT_PROFILE_STANDFIRST,
  displayProjectName,
  projectProfileH1,
} from "@/lib/projects/copy";
import { pageJsonLd } from "@/lib/jsonld";
import { projectSeoDescription, projectSeoTitle } from "@/lib/seo/project-meta";
import { SITE_ORIGIN } from "@/lib/site";
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
  const title = projectSeoTitle(project);
  const description = projectSeoDescription(project);
  return buildPageMetadata({
    title,
    description,
    path: profile.href,
    imagePath: `${profile.href}/opengraph-image`,
    imageAlt: title,
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
  const displayName = displayProjectName(project.name);
  const pageUrl = `${SITE_ORIGIN}${profile.href}`;
  const citation = `Grid, "${displayName}", grid.vahaah.com${profile.href}, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${PROJECTS_ATTRIBUTION}`;
  return (
    <SeoPage
      section={PROJECTS_EYEBROW}
      title={projectProfileH1(project.name)}
      breadcrumb={[{ href: PROJECTS_PATH, label: PROJECTS_EYEBROW }, { label: displayName }]}
      schema={pageJsonLd({
        name: projectSeoTitle(project),
        description: projectSeoDescription(project),
        url: `${SITE_ORIGIN}${profile.href}`,
        breadcrumbs: [
          { name: PROJECTS_EYEBROW, item: `${SITE_ORIGIN}${PROJECTS_PATH}` },
          { name: displayName, item: `${SITE_ORIGIN}${profile.href}` },
        ],
      })}
      cite={<p>{PROJECT_PROFILE_STANDFIRST}</p>}
      citation={citation}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{PROJECTS_EYEBROW}</p>
          <h1 className="mt-2 break-words text-heading-32 text-gray-1000">{projectProfileH1(project.name)}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{PROJECT_PROFILE_STANDFIRST}</p>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">{PROJECT_PROFILE_SOURCE}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyLinkButton url={pageUrl} />
            <ShareButton url={pageUrl} title={projectSeoTitle(project)} />
            <CiteButton text={citation} />
          </div>
        </section>
      }
    >
      <ProjectProfileView profile={profile} />
    </SeoPage>
  );
}
