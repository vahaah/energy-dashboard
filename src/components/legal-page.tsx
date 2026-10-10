import type { ReactNode } from "react";
import { PAGE_STACK_CLASS } from "@/components/ui/card";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { SitePageHeader } from "@/components/site-page-header";

export function LegalPage({
  section,
  title,
  lede,
  children,
}: {
  section: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <SitePageHeader section={section} />
      <main className={PAGE_STACK_CLASS}>
        <section>
          <p className="text-label-13 text-gray-900">Grid</p>
          <h1 className="mt-1 text-heading-32 text-gray-1000">{title}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{lede}</p>
        </section>
        <div className="max-w-3xl space-y-8 text-copy-16 text-gray-900">{children}</div>
        <footer className="border-t border-gray-alpha-400 pt-8 pb-4">
          <SiteLegalNav />
        </footer>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-heading-24 text-gray-1000">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
