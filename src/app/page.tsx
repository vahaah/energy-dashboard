import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { GridMark } from "@/components/grid-mark";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { JsonLd } from "@/components/json-ld";
import { PAGE_STACK_CLASS } from "@/components/ui/card";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { homepageJsonLd } from "@/lib/jsonld";
import { homepageOgImage } from "@/lib/page-metadata";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_OG_IMAGE, SITE_OG_TYPE, SITE_TWITTER_CARD } from "@/lib/site";

/**
 * Homepage shell. Static/ISR so the CDN can HIT `/`. Headline copy is a Server
 * Component so the H1 and cite sentence are real HTML for crawlers. `?date=`
 * is hidden on the client only — the canonical strips it. Homepage metadata
 * versions `/og?p=` with the settlement period and does not use `?focus=`.
 * Per-section cards stay on the `/og` route for the share menu only.
 */
export const revalidate = 300;
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const payload = await loadHomepagePayload();
  const image = homepageOgImage(payload);
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      type: SITE_OG_TYPE,
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: "/",
      images: [{ ...SITE_OG_IMAGE, url: image.url, alt: image.alt }],
    },
    twitter: {
      ...SITE_TWITTER_CARD,
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      images: [image.url],
    },
  };
}

export default async function Home() {
  const payload = await loadHomepagePayload();
  const cite = homepageCiteFromPayload(payload);
  const briefing = <HomepageBriefing cite={cite} />;

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <JsonLd data={homepageJsonLd(payload?.facts ?? null)} />
      <Suspense
        fallback={
          <div className="min-h-0 bg-background-100">
            <HomepageFallbackHeader />
            <div className={`${PAGE_STACK_CLASS} pb-0 sm:pb-0`}>{briefing}</div>
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
            <GridMark />
            <span className="text-heading-16">Grid</span>
          </Link>
        </div>
      </header>
    </>
  );
}
