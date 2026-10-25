"use client";

export function JumpTo({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  return (
    <nav aria-label="On this page" className="sticky top-16 z-10 -mx-[var(--card-pad)] border-b border-gray-alpha-400 bg-background-100 px-[var(--card-pad)] py-2">
      <label className="flex items-center gap-2 text-label-13 text-gray-900 lg:hidden">
        <span>Jump to</span>
        <select
          aria-label="Jump to"
          defaultValue=""
          onChange={(event) => {
            const href = event.target.value;
            if (href) {
              window.location.hash = href;
            }
          }}
          className="h-8 min-h-6 min-w-0 flex-1 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-copy-14 text-gray-1000"
        >
          <option value="">Choose a section</option>
          {items.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <ul className="hidden flex-wrap gap-x-4 gap-y-1 lg:flex">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="inline-flex min-h-6 items-center text-label-13 text-gray-900 underline-offset-2 hover:text-gray-1000 hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
