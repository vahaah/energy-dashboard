import Link from "next/link";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function SiteBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-label-13 text-gray-900">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="text-blue-700 underline-offset-2 hover:underline">
            Grid
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            {item.href ? (
              <Link href={item.href} className="text-blue-700 underline-offset-2 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
