import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { pageJsonLd } from "@/lib/jsonld";
import { PRIVACY_DESCRIPTION, PRIVACY_TITLE, privacyPageMetadata } from "@/lib/page-metadata";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  LEGAL_CONTROLLER,
  SITE_ORIGIN,
} from "@/lib/site";

export const revalidate = 86_400;
export const dynamic = "force-static";
export const metadata: Metadata = privacyPageMetadata();

export default function PrivacyPage() {
  return (
    <LegalPage
      section="Privacy"
      title="Privacy"
      lede="Grid has no accounts and does not set non-essential cookies. This notice is for visitors in the UK and explains what Comonad Ltd collects when you use grid.vahaah.com."
      schema={pageJsonLd({
        name: PRIVACY_TITLE,
        description: PRIVACY_DESCRIPTION,
        url: `${SITE_ORIGIN}/privacy`,
        breadcrumbs: [{ name: "Privacy", item: `${SITE_ORIGIN}/privacy` }],
      })}
    >
      <LegalSection title="Who is responsible">
        <p>
          The data controller is {LEGAL_CONTROLLER}. Contact:{" "}
          <a
            href={LEGAL_CONTACT_MAILTO}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>Grid does not ask you to create an account, and we do not store a user profile.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Vercel platform logs for the site and its APIs: request path, status, timestamp, user
            agent, and IP address, used to operate, debug, and secure the service.
          </li>
          <li>
            An in-memory rate limiter on public <code>/api/*</code> routes (60 requests per minute
            per IP). The counting window is one minute. After that window ends, or when the server
            instance recycles, the IP entry is dropped. Counts are not written to a database.
          </li>
          <li>
            Optional theme preference in <code>localStorage</code> on your device. That is not a
            cookie and is not sent to our servers.
          </li>
          <li>
            Cookieless Plausible analytics on the production site: page URL, referrer, browser,
            operating system, device type, and approximate location. See Analytics below.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Grid does not set first-party cookies. The app deletes any <code>Set-Cookie</code> header
          on cached JSON responses. Theme is stored in <code>localStorage</code>, not a cookie. There
          is no advertising, no cross-site tracker, and no non-essential analytics cookie, so Grid
          does not show a cookie banner.
        </p>
        <p>
          Vercel, as the host, may process connection data as a processor under its own terms. That
          is infrastructure logging, not a Grid marketing cookie.
        </p>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>
          The production site measures visits with cookieless Plausible analytics. Plausible does
          not use cookies and does not collect personal data. It records the page URL, referrer,
          browser, operating system, device type, and an approximate location derived from the IP
          address. The IP address and the raw user agent are not stored. A salt that rotates every
          day turns them into a visitor count for that day only, on this site only.
        </p>
        <p>
          Plausible is EU-hosted. Visitor data is processed and stored in the EU on European-owned
          infrastructure and does not leave the EU. The browser sends the measurement to this site,
          and Grid forwards it to Plausible without a cookie. See{" "}
          <a
            href="https://plausible.io/data-policy"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            Plausible&apos;s data policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Lawful basis and retention">
        <p>
          We process this information under UK GDPR legitimate interests: keeping a public
          electricity dashboard available, preventing abuse of the public API, diagnosing outages,
          and understanding which pages are used. Logs follow Vercel&apos;s retention. Rate-limit
          counters last about 60 seconds. Plausible keeps aggregate analytics under its own
          retention, described in its data policy.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask {LEGAL_CONTROLLER} for access, rectification, erasure, restriction, or
          objection, and for a copy of your personal data, by emailing {LEGAL_CONTACT_EMAIL}. You
          can complain to the Information Commissioner&apos;s Office if you are unhappy with how we
          handle your information.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          The site is hosted on Vercel. Request logs may be processed outside the UK under
          Vercel&apos;s transfer mechanisms. Plausible analytics data stays in the EU. We do not
          sell personal data.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
