import type { ReactNode } from "react";

export const TABLE_SCROLL_CUE = "Swipe for more columns";

/** Horizontal table scroller with a mobile cue and a right-edge fade. */
export function TableScroll({
  children,
  className = "",
  label = TABLE_SCROLL_CUE,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`min-w-0 max-w-full ${className}`.trim()}>
      <p className="mb-2 text-label-13 text-gray-900 sm:hidden">{label}</p>
      <div className="relative min-w-0 max-w-full">
        <div className="min-w-0 max-w-full overflow-x-auto [&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:left-0 [&_tbody_td:first-child]:z-10 [&_tbody_td:first-child]:bg-background-100 [&_tbody_th:first-child]:sticky [&_tbody_th:first-child]:left-0 [&_tbody_th:first-child]:z-10 [&_tbody_th:first-child]:bg-background-100 [&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:z-10 [&_thead_th:first-child]:bg-background-100">
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-background-100 to-transparent sm:hidden"
        />
      </div>
    </div>
  );
}
