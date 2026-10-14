import { SiteTopBar } from "@/components/site-top-bar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SitePageHeader({ section }: { section: string }) {
  return <SiteTopBar idPrefix="page" section={section} trailing={<ThemeToggle />} />;
}
