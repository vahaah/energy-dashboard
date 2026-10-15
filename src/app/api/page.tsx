import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { Card } from "@/components/ui/card";
import { CC_BY_4_0_LICENSE_URL, elexonBmrsAttribution } from "@/lib/attribution";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { apiDocsJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { apiDocsPageMetadata } from "@/lib/page-metadata";
import { API_DOCS_H1 } from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = apiDocsPageMetadata();

const ENDPOINTS = [
  {
    path: "/api/snapshots?range=24h",
    name: "Snapshots",
    fields: "Half-hourly carbon intensity, demand, market index, system price, generation mix.",
  },
  {
    path: "/api/generation?range=24h",
    name: "Generation",
    fields:
      "FUELINST plus NESO embedded wind and Sheffield Solar PV Live, by fuel. Mix percentages elsewhere on Grid are a share of generation, not of demand.",
  },
  {
    path: "/api/interconnectors?range=24h",
    name: "Interconnectors",
    fields: "Metered interconnector flows. range is 24h or 7d.",
  },
  {
    path: "/api/prices?range=90d",
    name: "Prices",
    fields: "Brent, WTI, Henry Hub, World Bank Europe gas and Japan LNG, GB gas SAP. No key.",
  },
  {
    path: "/api/dashboard?period=day",
    name: "Dashboard",
    fields: "Assembled homepage payload. period is day, week, year or all.",
  },
  {
    path: "/api/look-ahead",
    name: "Look-ahead",
    fields: "Derived cleanest-window answer from the NESO carbon forecast.",
  },
  {
    path: "/api/v1/constraints?from=2026-10-01&to=2026-10-08",
    name: "Constraints",
    fields:
      "Published constraint activity. Only the breakdowns the source publishes. from and to are inclusive settlement dates. boundary is optional. An unsupported filter returns 400.",
  },
  {
    path: "/api/v1/data-health",
    name: "Data health",
    fields:
      "Published time from the source and when Grid retrieved it, per metric, with the expected cadence and publication lag. Read from warmed envelopes.",
  },
] as const;

export default async function ApiDocsPage() {
  const payload = await loadHomepagePayload();

  return (
    <>
      <JsonLd data={apiDocsJsonLd(payload?.facts ?? null)} />
      <SeoPage
        section="API"
        title={API_DOCS_H1}
        breadcrumb={[{ label: "API" }]}
        cite={
          <p data-cite>
            Grid publishes JSON for GB carbon intensity, generation mix, demand, interconnectors,
            market prices and commodities. Generation mix percentages are a share of generation.
            Interconnectors are separate and are not part of that mix. No API key. 60 requests a
            minute. Derived data is CC BY 4.0 with upstream attributions.
          </p>
        }
        citation={`Grid, "Free GB electricity data API", grid.vahaah.com/api, accessed ${formatLondonDayMonthYear(getLondonDate(new Date()))}.`}
      >
        <section>
          <h2 className="text-heading-24 text-gray-1000">Endpoints</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Base URL <code>https://grid.vahaah.com</code>. CORS is open. Invalid{" "}
            <code>range</code> values return 400. Allowed ranges: 24h, 7d, 30d, 90d, 1y where the
            route documents them.
          </p>
          <div className="mt-4 space-y-4">
            {ENDPOINTS.map((endpoint) => (
              <Card key={endpoint.path} title={endpoint.name}>
                <p className="text-mono-12 text-gray-1000">
                  <code>GET {endpoint.path}</code>
                </p>
                <p className="mt-2 text-copy-14 text-gray-900">{endpoint.fields}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-gray-alpha-400 bg-background-200 p-3 text-mono-12 text-gray-1000">
                  {`curl -s "https://grid.vahaah.com${endpoint.path}"`}
                </pre>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Example response</h2>
          <Card className="mt-4">
            <pre className="overflow-x-auto text-mono-12 text-gray-1000">
              {`{
  "data": [
    {
      "timestamp": "2026-10-10 11:00:00",
      "carbon_intensity": 148,
      "demand_mw": 32400,
      "price_mid_gbp_mwh": 45.2,
      "price_gbp_mwh": 67
    }
  ],
  "range": "24h",
  "count": 1
}`}
            </pre>
          </Card>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Licence and how to cite</h2>
          <p className="mt-2 max-w-3xl text-copy-16 text-gray-900">
            Derived JSON is{" "}
            <a
              href={CC_BY_4_0_LICENSE_URL}
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              CC BY 4.0
            </a>
            , with upstream licences on{" "}
            <Link href="/data-sources" className="text-blue-700 underline-offset-2 hover:underline">
              Data sources
            </Link>
            . {elexonBmrsAttribution()} Cite: Grid (grid.vahaah.com), data from Elexon BMRS and NESO,{" "}
            {formatLondonDayMonthYear(getLondonDate(new Date()))}.
          </p>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Changelog</h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-copy-16 text-gray-900">
            <li>2026-10: public docs page; Dataset JSON-LD; snapshots, generation, prices, interconnectors.</li>
            <li>2026: dashboard payload and look-ahead added; commodity series exclude leftover daily monthly rows.</li>
          </ul>
        </section>
      </SeoPage>
    </>
  );
}
