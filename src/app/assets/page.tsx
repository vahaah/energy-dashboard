import type { Metadata } from "next";
import { AssetDirectory } from "@/components/asset-directory";
import { SeoPage } from "@/components/seo-page";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { assetsPageMetadata } from "@/lib/page-metadata";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = assetsPageMetadata();

export default function AssetsPage() {
  const catalogue = loadAssetCatalogue();

  return (
    <SeoPage
      section="Assets"
      title="Power assets"
      breadcrumb={[{ label: "Assets" }]}
      cite={
        <p>
          Operational stations from the DESNZ Renewable Energy Planning Database and DUKES 5.11.
          Capacity is the megawatts the register counts, so a matched site is not added twice.
        </p>
      }
      citation={`Grid, "Power assets", grid.vahaah.com/assets, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <AssetDirectory rows={catalogue.rows} regions={catalogue.regions} />
    </SeoPage>
  );
}
