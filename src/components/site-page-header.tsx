import Link from "next/link";
import { SITE_NAV_LINKS } from "@/components/site-public-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SitePageHeader({ section }: { section: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-gray-1000">
          <span className="flex size-6 items-center justify-center rounded-md border border-gray-alpha-400 text-[11px] font-semibold">
            G
          </span>
          <span className="text-heading-16">Grid</span>
        </Link>
        <p className="text-label-13 text-gray-900">{section}</p>
        <nav
          aria-label="Site"
          className="ml-4 hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto md:flex"
        >
          {SITE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 text-label-13 text-gray-900 underline-offset-2 hover:text-gray-1000 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
