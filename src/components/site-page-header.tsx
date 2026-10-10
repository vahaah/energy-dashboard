import Link from "next/link";
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
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
