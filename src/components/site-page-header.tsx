import { SiteTopBar } from "@/components/site-top-bar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SitePageHeader({
  section,
  skipHref,
  skipLabel,
}: {
  section: string;
  skipHref?: string;
  skipLabel?: string;
}) {
  return (
    <SiteTopBar
      idPrefix="page"
      section={section}
      trailing={<ThemeToggle />}
      skipHref={skipHref}
      skipLabel={skipLabel}
    />
  );
}
