import Link from "next/link";
import { routeExists } from "@/lib/site-nav";

export const SITE_NAV_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/map", label: "Map" },
  { href: "/assets", label: "Assets" },
  { href: "/records", label: "Records" },
  { href: "/prices/gas", label: "Gas price" },
  { href: "/explained/price-cap", label: "Price cap" },
  { href: "/methodology", label: "Methodology" },
  { href: "/data-health", label: "Data health" },
  { href: "/tools", label: "Tools" },
  { href: "/changes", label: "Changes" },
  { href: "/api", label: "API" },
] as const;

export function SitePublicNav({ className = "" }: { className?: string }) {
  const links = SITE_NAV_LINKS.filter((link) => routeExists(link.href));
  return (
    <nav
      aria-label="Site"
      className={`flex flex-wrap gap-x-4 gap-y-2 text-label-13 text-gray-900 ${className}`.trim()}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-6 items-center text-blue-700 underline-offset-2 hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
