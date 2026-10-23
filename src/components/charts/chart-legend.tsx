export type ChartLegendItem = {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
};

/** Text plus a swatch, so a series is not identified by colour alone. */
export function ChartLegend({ items, label = "Chart legend" }: { items: readonly ChartLegendItem[]; label?: string }) {
  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-2 text-copy-14 text-gray-900">
          <span
            aria-hidden="true"
            className={`inline-block h-0.5 w-4 shrink-0 ${item.dashed ? "border-t border-dashed" : ""}`}
            style={
              item.dashed
                ? { borderColor: item.color }
                : { backgroundColor: item.color, height: "3px" }
            }
          />
          <span className="break-words">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
