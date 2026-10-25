import type { Metadata } from "next";
import { PowerCutsView } from "@/components/power-cuts/view";
import { SeoPage } from "@/components/seo-page";
import { FaqList } from "@/components/ui/faq-list";
import { pageJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { buildPageMetadata } from "@/lib/page-metadata";
import { OFGEM_CREDIT, POWER_CUT_CREDITS, POWER_CUTS_CALL_105, POWER_CUTS_CALL_NI, POWER_CUTS_DESCRIPTION, POWER_CUTS_H1, POWER_CUTS_TITLE } from "@/lib/power-cuts/copy";
import { buildPowerCutsModel } from "@/lib/power-cuts/model";
import { loadOfgemCiCml } from "@/lib/power-cuts/ofgem";
import { readCachedPowerCuts } from "@/lib/power-cuts/reader";
import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: POWER_CUTS_TITLE,
  description: POWER_CUTS_DESCRIPTION,
  path: "/power-cuts",
  imagePath: "/power-cuts/opengraph-image",
  imageAlt: "Power cuts by area",
});

export default async function PowerCutsPage() {
  const now = new Date();
  const snapshot = await readCachedPowerCuts();
  const ofgem = loadOfgemCiCml();
  const model = snapshot ? buildPowerCutsModel(snapshot, now) : null;
  const faqs = [
    {
      question: "What number do I call in a power cut?",
      answer: `${POWER_CUTS_CALL_105}. 105 is free from a landline or a mobile. ${POWER_CUTS_CALL_NI}. Northern Ireland is not in this feed.`,
    },
    {
      question: "How many power cuts are there?",
      answer: model?.answer ?? "Not yet available.",
    },
  ];
  const url = `${SITE_ORIGIN}/power-cuts`;
  return (
    <SeoPage
      section="Power cuts"
      title={POWER_CUTS_H1}
      breadcrumb={[{ label: "Power cuts" }]}
      schema={pageJsonLd({
        name: POWER_CUTS_TITLE,
        description: POWER_CUTS_DESCRIPTION,
        url,
        breadcrumbs: [
          { name: "Grid", item: SITE_ORIGIN },
          { name: "Power cuts", item: url },
        ],
        faqs,
        dateModified: snapshot?.fetchedAt,
        extra: [
          {
            "@type": "Dataset",
            "@id": `${url}#dataset`,
            name: "Power cuts by area",
            description: POWER_CUTS_DESCRIPTION,
            url,
            isBasedOn: [
              ...POWER_CUT_CREDITS.map((credit) => ({
                "@type": "CreativeWork",
                name: credit.name,
                url: credit.url,
                ...(credit.licenceUrl ? { license: credit.licenceUrl } : {}),
              })),
              {
                "@type": "CreativeWork",
                name: OFGEM_CREDIT.name,
                url: OFGEM_CREDIT.url,
                license: OFGEM_CREDIT.licenceUrl,
              },
            ],
          },
        ],
      })}
      cite={<p>{POWER_CUTS_DESCRIPTION}</p>}
      citation={`Grid, "Power cuts by area", grid.vahaah.com/power-cuts, accessed ${formatLondonDayMonthYear(getLondonDate(now))}. ${POWER_CUT_CREDITS.map((credit) => credit.attribution).join(" ")}`}
    >
      <PowerCutsView snapshot={snapshot} nowIso={now.toISOString()} ofgem={ofgem} />
      <FaqList items={faqs} />
    </SeoPage>
  );
}
