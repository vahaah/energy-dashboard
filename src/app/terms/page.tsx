import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { pageJsonLd } from "@/lib/jsonld";
import { TERMS_DESCRIPTION, TERMS_TITLE, termsPageMetadata } from "@/lib/page-metadata";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  LEGAL_CONTROLLER,
  LEGAL_JURISDICTION,
  SITE_ORIGIN,
} from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = termsPageMetadata();

export default function TermsPage() {
  return (
    <LegalPage
      section="Terms"
      title="Terms"
      lede="Grid is a public dashboard of GB energy data for information only. It is not a trading tool, a forecast to rely on, or financial advice."
      schema={pageJsonLd({
        name: TERMS_TITLE,
        description: TERMS_DESCRIPTION,
        url: `${SITE_ORIGIN}/terms`,
        breadcrumbs: [{ name: "Terms", item: `${SITE_ORIGIN}/terms` }],
      })}
    >
      <LegalSection title="Informational use">
        <p>
          Figures come from third-party feeds, are refreshed every hour or less often, and can be
          late, incomplete, or wrong. Do not use Grid as the sole basis for operational, trading, or
          investment decisions. Third-party data stays under the licences listed on{" "}
          <a href="/data-sources" className="text-blue-700 underline-offset-2 hover:underline">
            Data sources
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The site is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of
          any kind, express or implied, including merchantability, fitness for a particular purpose,
          and non-infringement. {LEGAL_CONTROLLER} does not warrant that the data is accurate,
          current, or uninterrupted.
        </p>
      </LegalSection>

      <LegalSection title="Not financial advice">
        <p>
          Nothing on Grid is advice on securities, commodities, electricity contracts, or any other
          financial instrument. Market Index, imbalance prices, and oil or gas series are republished
          context, not a recommendation.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the fullest extent permitted by law, {LEGAL_CONTROLLER} and its contributors are not
          liable for any indirect, incidental, special, consequential, or punitive loss, or for lost
          profits, data, or goodwill, arising from your use of Grid or reliance on its figures. Our
          aggregate liability for any claim relating to the site is limited to £0, because the
          service is free.
        </p>
        <p>Nothing in these terms limits liability that cannot be limited under applicable law.</p>
      </LegalSection>

      <LegalSection title="Law">
        <p>
          These terms are governed by the laws of {LEGAL_JURISDICTION}. Contact{" "}
          <a
            href={LEGAL_CONTACT_MAILTO}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
