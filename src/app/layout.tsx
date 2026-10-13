import type { Metadata } from "next";
import Script from "next/script";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import {
  PLAUSIBLE_DOMAIN,
  PLAUSIBLE_EVENT_PATH,
  PLAUSIBLE_QUEUE_STUB,
  PLAUSIBLE_SCRIPT_PATH,
  isPlausibleEnabled,
} from "@/lib/plausible";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_OG_IMAGE, SITE_ORIGIN, SITE_TWITTER_CARD } from "@/lib/site";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    url: "/",
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    ...SITE_TWITTER_CARD,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausible = isPlausibleEnabled();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="font-sans antialiased tabular-nums">
        <NuqsAdapter>{children}</NuqsAdapter>
        {plausible ? (
          <>
            <Script id="plausible-queue" strategy="afterInteractive">
              {PLAUSIBLE_QUEUE_STUB}
            </Script>
            <Script
              id="plausible"
              src={PLAUSIBLE_SCRIPT_PATH}
              strategy="afterInteractive"
              data-domain={PLAUSIBLE_DOMAIN}
              data-api={PLAUSIBLE_EVENT_PATH}
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
