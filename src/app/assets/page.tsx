import type { Metadata } from "next";
import { AssetDirectory } from "@/components/asset-directory";
import { CountColumns } from "@/components/count-columns";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { ASSET_LIST_DEFAULT, assetCounts, queryAssetPage, toAssetListRow } from "@/lib/assets/list";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { DIRECTORY_TECHNOLOGIES } from "@/lib/assets/types";
import { pageJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { assetsPageMetadata } from "@/lib/page-metadata";
import { ASSETS_TITLE, SITE_ORIGIN, assetsDirectoryDescription } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 86_400;

export const metadata: Metadata = assetsPageMetadata(loadAssetCatalogue().rows.length);

export default function AssetsPage() {
  const catalogue = loadAssetCatalogue();
  const counts = assetCounts(catalogue.rows);
  const list = queryAssetPage(catalogue.rows, ASSET_LIST_DEFAULT, null);
  const present = new Set(catalogue.rows.map((row) => row.technology));
  const technologies = DIRECTORY_TECHNOLOGIES.filter((technology) => present.has(technology));

  return (
    <SeoPage
      section="Assets"
      title="Power stations, interconnectors and gas terminals in GB"
      breadcrumb={[{ label: "Assets" }]}
      schema={pageJsonLd({
        name: ASSETS_TITLE,
        description: assetsDirectoryDescription(catalogue.rows.length),
        url: `${SITE_ORIGIN}/assets`,
        breadcrumbs: [{ name: "Assets", item: `${SITE_ORIGIN}/assets` }],
      })}
      cite={
        <p>
          Operating stations from DESNZ (REPD) and DESNZ (DUKES 5.11), interconnectors from Elexon and gas terminals from National Gas. A site in both registers is counted once.
        </p>
      }
      citation={`Grid, "Power assets", grid.vahaah.com/assets, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
    >
      <Card title="Counts">
        <CountColumns
          columns={[
            { title: "By technology", rows: counts.technology },
            { title: "By nation", rows: counts.nation },
            { title: "By stage", rows: counts.stage },
          ]}
        />
      </Card>
      <AssetDirectory
        rows={list.rows.map(toAssetListRow)}
        total={list.total}
        pages={list.pages}
        regions={catalogue.regions}
        technologies={technologies}
      />
    </SeoPage>
  );
}
