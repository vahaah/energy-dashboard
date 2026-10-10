import Link from "next/link";

export const SITE_NAV_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/records", label: "Records" },
  { href: "/prices/gas", label: "Gas price" },
  { href: "/explained/price-cap", label: "Price cap" },
  { href: "/methodology", label: "Methodology" },
  { href: "/api", label: "API" },
] as const;

export function SitePublicNav({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Site"
      className={`flex flex-wrap gap-x-4 gap-y-2 text-label-13 text-gray-900 ${className}`.trim()}
    >
      {SITE_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-blue-700 underline-offset-2 hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
