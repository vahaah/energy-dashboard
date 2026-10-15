import type { Metadata } from "next";
import { GasBoard } from "@/components/gas/gas-board";
import { SeoPage } from "@/components/seo-page";
import { DataStateNotice } from "@/components/ui/data-state";
import { GAS_ATTRIBUTION, GAS_EYEBROW, GAS_SYSTEM_H1, GAS_SYSTEM_STANDFIRST, GAS_SYSTEM_TITLE } from "@/lib/gas/copy";
import { loadWarmedGasGeneration } from "@/lib/gas/generation";
import { buildGasDocument } from "@/lib/gas/page-model";
import { getGasReleaseReader } from "@/lib/gas/release-reader";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 900;

export const metadata: Metadata = buildPageMetadata({
  title: GAS_SYSTEM_TITLE,
  description: GAS_SYSTEM_STANDFIRST,
  path: "/gas",
  imagePath: "/gas/opengraph-image",
  imageAlt: GAS_SYSTEM_TITLE,
});

export default async function GasSystemPage() {
  const now = new Date();
  const history = await getGasReleaseReader().readGasReleaseHistory();
  const generation = await loadWarmedGasGeneration(now).catch(() => null);
  const document = buildGasDocument(history, now, generation);

  return (
    <SeoPage
      section="Gas"
      title={GAS_SYSTEM_H1}
      breadcrumb={[{ label: "Gas" }]}
      cite={<p>{GAS_SYSTEM_STANDFIRST}</p>}
      citation={`Grid, "Britain's gas system", grid.vahaah.com/gas, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${GAS_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{GAS_EYEBROW}</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{GAS_SYSTEM_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{GAS_SYSTEM_STANDFIRST}</p>
        </section>
      }
    >
      {document.available ? <GasBoard document={document} /> : <DataStateNotice state="not_yet_available" />}
    </SeoPage>
  );
}
