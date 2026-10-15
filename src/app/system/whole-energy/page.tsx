import type { Metadata } from "next";
import { WholeEnergyBoard } from "@/components/whole-energy/whole-energy-board";
import { SeoPage } from "@/components/seo-page";
import {
  WHOLE_ENERGY_ATTRIBUTION,
  WHOLE_ENERGY_H1,
  WHOLE_ENERGY_TITLE,
  wholeEnergyStandfirst,
} from "@/lib/whole-energy/copy";
import { loadWholeEnergyEdition } from "@/lib/whole-energy/load";
import { buildWholeEnergyPage } from "@/lib/whole-energy/model";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 86400;

const edition = loadWholeEnergyEdition();

export const metadata: Metadata = buildPageMetadata({
  title: WHOLE_ENERGY_TITLE,
  description: wholeEnergyStandfirst(edition.year),
  path: "/system/whole-energy",
  imagePath: "/system/whole-energy/opengraph-image",
  imageAlt: WHOLE_ENERGY_TITLE,
});

export default function WholeEnergyPage() {
  const model = buildWholeEnergyPage(edition);
  const now = new Date();
  const standfirst = wholeEnergyStandfirst(model.year);
  return (
    <SeoPage
      section="Whole energy"
      title={WHOLE_ENERGY_H1}
      breadcrumb={[{ label: "System" }, { label: "Whole energy" }]}
      cite={<p>{standfirst}</p>}
      citation={`Grid, "How Britain's energy fits together", grid.vahaah.com/system/whole-energy, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${WHOLE_ENERGY_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">System</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{WHOLE_ENERGY_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{standfirst}</p>
        </section>
      }
    >
      <WholeEnergyBoard model={model} />
    </SeoPage>
  );
}
