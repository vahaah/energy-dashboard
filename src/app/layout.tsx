import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grid.vahaah.com"),
  title: "Grid — GB electricity dashboard",
  description:
    "Great Britain electricity dashboard: half-hourly carbon intensity, generation mix, demand, and imbalance prices, with commodity context. Sources: Carbon Intensity API, Elexon BMRS/Insights, NESO, Sheffield Solar PV Live, EIA, and National Gas.",
  openGraph: {
    title: "Grid — GB electricity dashboard",
    description:
      "Half-hourly GB electricity: carbon, generation, demand, and imbalance prices. Sources include Carbon Intensity API, Elexon BMRS/Insights, NESO, and Sheffield Solar PV Live, plus EIA and National Gas for commodities.",
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
      "Half-hourly GB electricity: carbon, generation, demand, and imbalance prices from Carbon Intensity API, Elexon, NESO, and Sheffield Solar PV Live.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%2310b981'/><text x='16' y='22' text-anchor='middle' font-size='18' fill='white'>⚡</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="font-sans antialiased tabular-nums">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
