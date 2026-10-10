import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { JsonLd } from "@/components/json-ld";
import { PAGE_STACK_CLASS } from "@/components/ui/card";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { homepageJsonLd } from "@/lib/jsonld";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/site";

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
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default async function Home() {
  const payload = await loadHomepagePayload();
  const cite = homepageCiteFromPayload(payload);

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <JsonLd data={homepageJsonLd(payload?.facts ?? null)} />
      <div className={`${PAGE_STACK_CLASS} pb-0 sm:pb-0`}>
        <HomepageBriefing cite={cite} />
      </div>
      <Suspense fallback={<div className="min-h-0 bg-background-100" />}>
        <Dashboard initialPayload={payload} />
      </Suspense>
    </div>
  );
}
