import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { JsonLd } from "@/components/json-ld";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import { homepageJsonLd } from "@/lib/jsonld";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/site";

/**
 * Homepage shell. Default-period ("day") headline copy is server-rendered from
 * the cached dashboard payload so crawlers see numbers without running JS.
 * Range switching stays client-side after hydrate.
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
  const payload = await loadDashboardPayload({ period: "day" }).catch(() => null);
  const cite = homepageCiteFromPayload(payload);

  return (
    <>
      <JsonLd data={homepageJsonLd(payload?.facts ?? null)} />
      <Suspense fallback={<div className="min-h-screen bg-background-100" />}>
        <Dashboard initialPayload={payload}>
          <HomepageBriefing cite={cite} />
        </Dashboard>
      </Suspense>
    </>
  );
}
