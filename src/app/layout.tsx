import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
