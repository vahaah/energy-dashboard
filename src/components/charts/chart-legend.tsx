export type ChartLegendItem = {
  id: string;
  label: string;
  color: string;
  /** SVG dash array. Omit, or pass "0", for a solid line. */
  dash?: string;
};

/** Text plus a swatch, so a series is not identified by colour alone. */
export function ChartLegend({ items, label = "Chart legend" }: { items: readonly ChartLegendItem[]; label?: string }) {
  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2" aria-label={label}>
      {items.map((item) => {
        const solid = item.dash == null || item.dash === "0";
        return (
          <li key={item.id} className="flex min-w-0 items-center gap-2 text-copy-14 text-gray-900">
            <svg aria-hidden="true" viewBox="0 0 16 8" className="h-2 w-4 shrink-0">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={solid ? undefined : item.dash}
              />
            </svg>
            <span className="break-words">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
