import type { Metadata } from "next";
import Link from "next/link";
import { GasBoard } from "@/components/gas/gas-board";
import { SeoPage } from "@/components/seo-page";
import { DataStateNotice } from "@/components/ui/data-state";
import { FaqList } from "@/components/ui/faq-list";
import { GAS_ATTRIBUTION, GAS_EYEBROW, GAS_SYSTEM_DESCRIPTION, GAS_SYSTEM_H1, GAS_SYSTEM_STANDFIRST, GAS_SYSTEM_TITLE } from "@/lib/gas/copy";
import { gasSystemFaqs } from "@/lib/gas/faq";
import { pageJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/site";
import { loadWarmedGasGeneration } from "@/lib/gas/generation";
import { buildGasDocument } from "@/lib/gas/page-model";
import { getGasReleaseReader } from "@/lib/gas/release-reader";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 900;

export const metadata: Metadata = buildPageMetadata({
  title: GAS_SYSTEM_TITLE,
  description: GAS_SYSTEM_DESCRIPTION,
  path: "/gas",
  imagePath: "/gas/opengraph-image",
  imageAlt: GAS_SYSTEM_TITLE,
});

export default async function GasSystemPage() {
  const now = new Date();
  const history = await getGasReleaseReader().readGasReleaseHistory();
  const generation = await loadWarmedGasGeneration(now).catch(() => null);
  const document = buildGasDocument(history, now, generation);
  const faqs = gasSystemFaqs(document);

  return (
    <SeoPage
      section="Gas"
      title={GAS_SYSTEM_H1}
      breadcrumb={[{ label: "Gas" }]}
      schema={pageJsonLd({
        name: GAS_SYSTEM_TITLE,
        description: GAS_SYSTEM_DESCRIPTION,
        url: `${SITE_ORIGIN}/gas`,
        breadcrumbs: [{ name: "Gas", item: `${SITE_ORIGIN}/gas` }],
        faqs,
        dateModified: history[0]?.components[0]?.retrieved_at,
      })}
      cite={<p>{GAS_SYSTEM_STANDFIRST}</p>}
      citation={`Grid, "Britain's gas system", grid.vahaah.com/gas, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${GAS_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{GAS_EYEBROW}</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{GAS_SYSTEM_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">
            {GAS_SYSTEM_STANDFIRST}{" "}
            <Link href="/prices/gas" className="text-blue-700 underline-offset-2 hover:underline">
              GB wholesale gas price
            </Link>
            .
          </p>
        </section>
      }
    >
      {document.available ? <GasBoard document={document} /> : <DataStateNotice state="not_yet_available" />}
      <FaqList items={faqs} />
    </SeoPage>
  );
}
