import { THIN_SPACE } from "@/lib/format/quantity";

export function Quantity({
  value,
  unit,
  className = "",
}: {
  value: string;
  unit: string;
  className?: string;
}) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`.trim()}>
      <span data-value>{value}</span>
      <span
        data-unit={unit}
        className={`align-baseline font-medium text-gray-900 ${unit === "customers" ? "unit-customers" : "unit-label"}`}
      >
        {THIN_SPACE}
        {unit}
      </span>
    </span>
  );
}
