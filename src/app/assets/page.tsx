import type { Metadata } from "next";
import { AssetDirectory } from "@/components/asset-directory";
import { SeoPage } from "@/components/seo-page";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { pageJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { assetsPageMetadata } from "@/lib/page-metadata";
import { ASSETS_TITLE, SITE_ORIGIN, assetsDirectoryDescription } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = assetsPageMetadata(loadAssetCatalogue().rows.length);

export default function AssetsPage() {
  const catalogue = loadAssetCatalogue();

  return (
    <SeoPage
      section="Assets"
      title="Power stations and assets in Great Britain"
      breadcrumb={[{ label: "Assets" }]}
      schema={pageJsonLd({
        name: ASSETS_TITLE,
        description: assetsDirectoryDescription(catalogue.rows.length),
        url: `${SITE_ORIGIN}/assets`,
        breadcrumbs: [{ name: "Assets", item: `${SITE_ORIGIN}/assets` }],
      })}
      cite={
        <p>
          Operational stations from the DESNZ Renewable Energy Planning Database and DUKES 5.11, schematic
          interconnectors from Elexon BMRS, and National Gas terminal names. Capacity is the megawatts the
          register counts, so a matched site is not added twice.
        </p>
      }
      citation={`Grid, "Power assets", grid.vahaah.com/assets, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <AssetDirectory rows={catalogue.rows} regions={catalogue.regions} />
    </SeoPage>
  );
}
