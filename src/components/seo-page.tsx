import type { ReactNode } from "react";
import { CiteButton } from "@/components/cite-button";
import { ShareButton } from "@/components/share-button";
import { JsonLd } from "@/components/json-ld";
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
  share,
  updated,
  header,
  schema,
  children,
}: {
  section: string;
  title: string;
  breadcrumb: BreadcrumbItem[];
  cite: ReactNode;
  citation: string;
  share?: { url: string; title: string };
  updated?: ReactNode;
  header?: ReactNode;
  schema?: { "@context": "https://schema.org"; "@graph": Array<Record<string, unknown>> };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      {schema ? <JsonLd data={schema} /> : null}
      <SitePageHeader section={section} />
      <main id="content" className={PAGE_STACK_CLASS}>
        <SiteBreadcrumb items={breadcrumb} />
        {header ?? (
          <section>
            <h1 className="text-heading-32 text-gray-1000">{title}</h1>
            <div className="mt-3 max-w-3xl text-copy-16 text-gray-900">{cite}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CiteButton text={citation} />
              {share ? <ShareButton url={share.url} title={share.title} /> : null}
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
              className="inline-flex min-h-6 items-center text-blue-700 underline-offset-2 hover:underline"
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
