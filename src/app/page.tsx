import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { JsonLd } from "@/components/json-ld";
import { SiteTopBar } from "@/components/site-top-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PAGE_STACK_CLASS } from "@/components/ui/card";
import { homepageCiteFromPayload, homepageCitePlainText } from "@/lib/homepage-briefing";
import { buildHomeCard } from "@/lib/balancing/build";
import { readBalancingRelease } from "@/lib/balancing/load";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { getLondonDate } from "@/lib/london-time";
import { homepageJsonLd } from "@/lib/jsonld";
import { homepageOgImage } from "@/lib/page-metadata";
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_TYPE,
  SITE_TWITTER_CARD,
} from "@/lib/site";

/**
 * Homepage shell. Static/ISR so the CDN can HIT `/`. The cite sentence is in
 * the initial HTML. The suspense fallback repeats the title as a paragraph
 * with the same type styles; the dashboard header is the only h1. `?date=`
 * is hidden on the client only — the canonical strips it. Homepage metadata
 * versions `/og?p=` with the settlement period and does not use `?focus=`.
 * Per-section cards stay on the `/og` route for the share menu only.
 */
export const revalidate = 300;
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const payload = await loadHomepagePayload();
  const image = homepageOgImage(payload);
  const alt = homepageCitePlainText(homepageCiteFromPayload(payload));
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      type: SITE_OG_TYPE,
      locale: "en_GB",
      siteName: SITE_NAME,
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: "/",
      images: [{ ...SITE_OG_IMAGE, url: image.url, alt }],
    },
    twitter: {
      ...SITE_TWITTER_CARD,
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      images: [{ url: image.url, alt }],
    },
  };
}

export default async function Home() {
  const payload = await loadHomepagePayload();
  const cite = homepageCiteFromPayload(payload);
  const balancingRelease = await readBalancingRelease();
  const balancingCard = balancingRelease ? buildHomeCard(balancingRelease, getLondonDate(new Date())) : null;
  const briefing = <HomepageBriefing cite={cite} heading="p" />;

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
        <Dashboard initialPayload={payload} cite={cite} balancingCard={balancingCard} />
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
      <SiteTopBar idPrefix="home-fallback" trailing={<ThemeToggle />} />
    </>
  );
}
