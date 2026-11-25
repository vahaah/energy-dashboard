import Link from "next/link";

export const LEGAL_NAV_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-sources", label: "Data sources" },
] as const;

export function SiteLegalNav({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={`flex flex-wrap gap-x-4 gap-y-2 text-label-13 text-gray-900 ${className}`.trim()}
    >
      {LEGAL_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-11 items-center text-label-13 text-blue-700 underline-offset-2 hover:underline sm:min-h-8"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
