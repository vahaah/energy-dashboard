import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { JsonLd } from "@/components/json-ld";
import { PAGE_STACK_CLASS } from "@/components/ui/card";
import { isLatestDashboardDate } from "@/lib/dashboard-search-params";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { homepageJsonLd } from "@/lib/jsonld";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_OG_IMAGE, SITE_TWITTER_CARD } from "@/lib/site";

/**
 * Homepage shell. Default-period ("day") headline copy is a Server Component so
 * the H1 and cite sentence are real HTML for crawlers. Chart range switching
 * stays client-side after hydrate from the same cached dashboard payload.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    ...SITE_TWITTER_CARD,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  const showLiveBriefing = isLatestDashboardDate(params.date);
  const payload = await loadHomepagePayload();
  const cite = homepageCiteFromPayload(showLiveBriefing ? payload : null);
  const briefing = showLiveBriefing ? <HomepageBriefing cite={cite} /> : null;

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <JsonLd data={homepageJsonLd(showLiveBriefing ? (payload?.facts ?? null) : null)} />
      <Suspense
        fallback={
          <div className="min-h-0 bg-background-100">
            <HomepageFallbackHeader />
            {briefing ? <div className={`${PAGE_STACK_CLASS} pb-0 sm:pb-0`}>{briefing}</div> : null}
          </div>
        }
      >
        <Dashboard initialPayload={payload}>{briefing}</Dashboard>
      </Suspense>
    </div>
  );
}

function HomepageFallbackHeader() {
  return (
    <>
      <a
        href="#section-overview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-gray-1000">
            <span className="flex size-6 items-center justify-center rounded-md border border-gray-alpha-400 text-[11px] font-semibold">
              G
            </span>
            <span className="text-heading-16">Grid</span>
          </Link>
        </div>
      </header>
    </>
  );
}
