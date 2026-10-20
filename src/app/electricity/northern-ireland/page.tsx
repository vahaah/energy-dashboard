import type { Metadata } from "next";
import { NiBoard } from "@/components/northern-ireland/ni-board";
import { SeoPage } from "@/components/seo-page";
import { EIRGRID_GROUP_ATTRIBUTION, EIRGRID_GROUP_LICENCE_URL } from "@/lib/attribution";
import {
  NI_ATTRIBUTION,
  NI_H1,
  NI_PATH,
  NI_SCOPE_BANNER,
  NI_TITLE,
} from "@/lib/eirgrid/copy";
import { buildNiPage, pageStatus } from "@/lib/eirgrid/page-model";
import { readNiRelease } from "@/lib/eirgrid/reader";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";
export const revalidate = 1800;

export const metadata: Metadata = buildPageMetadata({
  title: NI_TITLE,
  description: NI_SCOPE_BANNER,
  path: NI_PATH,
  imagePath: "/electricity/northern-ireland/opengraph-image",
  imageAlt: NI_TITLE,
});

export default async function NorthernIrelandPage() {
  const now = new Date();
  const release = await readNiRelease().catch(() => null);
  const model = buildNiPage(release, NI_ATTRIBUTION);
  const status = pageStatus(model);

  return (
    <SeoPage
      section="Northern Ireland"
      title={NI_H1}
      breadcrumb={[{ label: "System" }, { label: "Northern Ireland" }]}
      cite={<p>{NI_SCOPE_BANNER}</p>}
      citation={`Grid, "Northern Ireland electricity (outside GB)", grid.vahaah.com${NI_PATH}, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${EIRGRID_GROUP_ATTRIBUTION}`}
      header={
        <section>
          <p className="text-label-12 text-gray-900">Outside GB</p>
          <h1 className="mt-2 text-heading-32 text-gray-1000">{NI_H1}</h1>
          <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">{NI_SCOPE_BANNER}</p>
          <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-1000">{status}</p>
        </section>
      }
    >
      {model.available ? <NiBoard model={model} /> : null}
      <p className="break-words text-copy-14 text-gray-900">
        {model.attribution}{" "}
        <a
          href={EIRGRID_GROUP_LICENCE_URL}
          className="text-blue-700 underline-offset-2 hover:underline"
        >
          EirGrid Group Open Data Licence
        </a>
        .
      </p>
    </SeoPage>
  );
}
