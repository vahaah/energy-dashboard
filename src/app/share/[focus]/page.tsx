import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareFocusRedirect } from "@/components/share-focus-redirect";
import { DASHBOARD_FOCUSES } from "@/lib/dashboard-search-params";
import { isDashboardFocus, sharePageMetadata } from "@/lib/page-metadata";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ focus: string }> {
  return DASHBOARD_FOCUSES.map((focus) => ({ focus }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ focus: string }>;
}): Promise<Metadata> {
  const { focus } = await params;
  if (!isDashboardFocus(focus)) {
    return {};
  }
  return sharePageMetadata(focus);
}

export default async function ShareFocusPage({
  params,
}: {
  params: Promise<{ focus: string }>;
}) {
  const { focus } = await params;
  if (!isDashboardFocus(focus)) {
    notFound();
  }
  return <ShareFocusRedirect focus={focus} />;
}
