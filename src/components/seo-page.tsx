import type { ReactNode } from "react";
import { CiteButton } from "@/components/cite-button";
import { SiteBreadcrumb, type BreadcrumbItem } from "@/components/site-breadcrumb";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { SitePageHeader } from "@/components/site-page-header";
import { SitePublicNav } from "@/components/site-public-nav";
import { PAGE_STACK_CLASS } from "@/components/ui/card";

export function SeoPage({
  section,
  title,
  breadcrumb,
  cite,
  citation,
  updated,
  header,
  skipHref,
  skipLabel = "Skip to content",
  children,
}: {
  section: string;
  title: string;
  breadcrumb: BreadcrumbItem[];
  cite: ReactNode;
  citation: string;
  updated?: ReactNode;
  header?: ReactNode;
  skipHref?: string;
  skipLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      {skipHref ? (
        <a
          href={skipHref}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
        >
          {skipLabel}
        </a>
      ) : null}
      <SitePageHeader section={section} />
      <main className={PAGE_STACK_CLASS}>
        <SiteBreadcrumb items={breadcrumb} />
        {header ?? (
          <section>
            <h1 className="text-heading-32 text-gray-1000">{title}</h1>
            <div className="mt-3 max-w-3xl text-copy-16 text-gray-900">{cite}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CiteButton text={citation} />
              {updated}
            </div>
          </section>
        )}
        {children}
        <footer className="border-t border-gray-alpha-400 pt-8 pb-4 text-copy-14 text-gray-900">
          <SitePublicNav />
          <SiteLegalNav className="mt-4" />
          <p className="mt-4">
            Made by{" "}
            <a
              href="https://vahaah.com/"
              rel="author"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Alex Vakhitov
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
