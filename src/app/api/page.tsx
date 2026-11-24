import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SeoPage } from "@/components/seo-page";
import { ApiEndpointList } from "@/components/api/api-endpoint-list";
import {
  API_DOCS_CONVENTIONS,
  API_DOCS_ENDPOINTS,
  API_DOCS_ERRORS,
  API_DOCS_INTRO,
  API_DOCS_LICENCE,
  API_DOCS_WEBMCP,
  API_DOCS_WEBMCP_HEADING,
} from "@/lib/api/copy";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { apiDocsJsonLd } from "@/lib/jsonld";
import { formatLondonDayMonthYear, getLondonDate } from "@/lib/london-time";
import { apiDocsPageMetadata } from "@/lib/page-metadata";
import { API_DOCS_H1 } from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = apiDocsPageMetadata();

export default async function ApiDocsPage() {
  const payload = await loadHomepagePayload();
  const today = formatLondonDayMonthYear(getLondonDate(new Date()));

  return (
    <>
      <JsonLd data={apiDocsJsonLd(payload?.facts ?? null)} />
      <SeoPage
        section="API"
        title={API_DOCS_H1}
        breadcrumb={[{ label: "API" }]}
        cite={<p>{API_DOCS_INTRO}</p>}
        citation={`Grid, "Grid API: public energy data in JSON", grid.vahaah.com/api, accessed ${today}.`}
        header={
          <section>
            <p className="text-label-12 text-gray-900">API</p>
            <h1 className="mt-2 break-words text-heading-32 text-gray-1000">{API_DOCS_H1}</h1>
            <p className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">{API_DOCS_INTRO}</p>
          </section>
        }
      >
        <section>
          <h2 className="text-heading-24 text-gray-1000">Conventions</h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-copy-16 text-gray-900">
            {API_DOCS_CONVENTIONS.map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Endpoints</h2>
          <ApiEndpointList
            endpoints={API_DOCS_ENDPOINTS.map((endpoint) => ({
              ...endpoint,
              curl: curlExample(endpoint.method, endpoint.path),
            }))}
          />
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Errors</h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-copy-16 text-gray-900">
            {API_DOCS_ERRORS.map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">{API_DOCS_WEBMCP_HEADING}</h2>
          {API_DOCS_WEBMCP.map((line) => (
            <p key={line} className="mt-3 max-w-3xl break-words text-copy-16 text-gray-900">
              {line}
            </p>
          ))}
        </section>

        <section>
          <h2 className="text-heading-24 text-gray-1000">Licence</h2>
          <p className="mt-2 max-w-3xl break-words text-copy-16 text-gray-900">
            {API_DOCS_LICENCE}{" "}
            <Link href="/data-sources" className="text-blue-700 underline-offset-2 hover:underline">
              Data sources
            </Link>
          </p>
        </section>
      </SeoPage>
    </>
  );
}

function curlExample(method: "GET" | "POST", path: string): string {
  if (method === "POST") {
    return `curl -s -X POST "https://grid.vahaah.com${path}" -H "content-type: application/json" -d '{"effective_on":"2026-10-14","queries":[{"scheme":"MPID","code":"ABCD"}]}'`;
  }
  const query = exampleQuery(path);
  return `curl -s "https://grid.vahaah.com${path}${query}"`;
}

function exampleQuery(path: string): string {
  switch (path) {
    case "/api/v1/gas/overview":
      return "?gas_day=2026-10-14";
    case "/api/v1/gas/series":
      return "?metric=gas.gb_nts.demand.actual_volume&from=2026-10-14T05:00:00Z&to=2026-10-15T05:00:00Z";
    case "/api/v1/map/layers":
    case "/api/v1/data-health":
      return "";
    case "/api/v1/projects":
      return "?limit=100&offset=0";
    case "/api/v1/constraints":
      return "?from=2026-10-01&to=2026-10-08";
    case "/api/v1/identifiers":
      return "?scheme=MPID&code=ABCD&effective_on=2026-10-14";
    case "/api/v1/changes":
      return "";
    default:
      return "";
  }
}
