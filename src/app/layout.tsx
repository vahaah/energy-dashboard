import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Energy Grid Monitor — UK Grid + Oil & Gas Prices",
  description:
    "Real-time UK electricity grid data (carbon intensity, generation mix, demand, prices) combined with global oil and gas commodity prices. Data from Carbon Intensity API, Elexon BMRS, and US EIA.",
  openGraph: {
    title: "Energy Grid Monitor",
    description: "Live UK grid + global energy commodity dashboard",
    type: "website",
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
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
