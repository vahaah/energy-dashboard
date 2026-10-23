import type { Metadata } from "next";
import { StorageBoard } from "@/components/storage/storage-board";
import { SeoPage } from "@/components/seo-page";
import { buildPageMetadata } from "@/lib/page-metadata";
import {
  STORAGE_EYEBROW,
  STORAGE_H1,
  STORAGE_PATH,
  STORAGE_DESCRIPTION,
  STORAGE_STANDFIRST,
  STORAGE_TITLE,
} from "@/lib/storage/copy";
import { pageJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/site";
import { loadStorageInventory, loadWarmedStorageGeneration } from "@/lib/storage/load";
import { storageOperations } from "@/lib/storage/operations";
import { buildStorageDocument } from "@/lib/storage/page-model";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";

export const dynamic = "force-static";
export const revalidate = 1800;

export const metadata: Metadata = buildPageMetadata({
  title: STORAGE_TITLE,
  description: STORAGE_DESCRIPTION,
  path: STORAGE_PATH,
  imagePath: "/system/storage/opengraph-image",
  imageAlt: STORAGE_TITLE,
});

export default async function StoragePage() {
  const now = new Date();
  const inventory = loadStorageInventory();
  const generation = await loadWarmedStorageGeneration(now).catch(() => null);
  const document = buildStorageDocument(inventory, storageOperations(generation, now), now.getUTCFullYear());

  return (
    <SeoPage
      section={STORAGE_EYEBROW}
      title={STORAGE_H1}
      breadcrumb={[{ label: STORAGE_EYEBROW }]}
      schema={pageJsonLd({
        name: STORAGE_TITLE,
        description: STORAGE_DESCRIPTION,
        url: `${SITE_ORIGIN}${STORAGE_PATH}`,
        breadcrumbs: [{ name: STORAGE_EYEBROW, item: `${SITE_ORIGIN}${STORAGE_PATH}` }],
      })}
      cite={<p>{STORAGE_STANDFIRST}</p>}
      citation={`Grid, "Electricity storage in Britain", grid.vahaah.com${STORAGE_PATH}, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${document.inventoryAttribution} ${document.monitoredAttribution}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">{STORAGE_EYEBROW}</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{STORAGE_H1}</h1>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900">{STORAGE_STANDFIRST}</p>
        </section>
      }
    >
      <StorageBoard document={document} />
    </SeoPage>
  );
}
