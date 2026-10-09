import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grid.vahaah.com"),
  title: "Grid — GB electricity dashboard",
  description:
    "Great Britain electricity dashboard: half-hourly carbon intensity, generation mix, demand, and system prices, with commodity context. Sources: Carbon Intensity API, Elexon BMRS/Insights, NESO, Sheffield Solar PV Live, EIA, World Bank Pink Sheet, and National Gas.",
  openGraph: {
    title: "Grid — GB electricity dashboard",
    description:
      "Half-hourly GB electricity: carbon, generation, demand, and system prices. Sources include Carbon Intensity API, Elexon BMRS/Insights, NESO, and Sheffield Solar PV Live, plus EIA, World Bank Pink Sheet, and National Gas for commodities.",
    type: "website",
    url: "https://grid.vahaah.com",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Grid — GB electricity dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grid — GB electricity dashboard",
    description:
      "Half-hourly GB electricity: carbon, generation, demand, and system prices from Carbon Intensity API, Elexon, NESO, and Sheffield Solar PV Live.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="font-sans antialiased tabular-nums">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
