"use client";

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  onOptionIntent?: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; accessibleName?: string }>;
  pending?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  variant?: "segmented" | "tabs";
}

export function TimeRangeSelector<T extends string>({
  value,
  onChange,
  onOptionIntent,
  options,
  pending = false,
  compact = false,
  ariaLabel,
  variant = "segmented",
}: Props<T>) {
  if (variant === "tabs") {
    return (
      <div
        className={`flex items-center gap-4 ${pending ? "opacity-70" : ""}`}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            aria-label={opt.accessibleName}
            onClick={() => onChange(opt.value)}
            onMouseEnter={() => onOptionIntent?.(opt.value)}
            onFocus={() => onOptionIntent?.(opt.value)}
            disabled={pending}
            className={`inline-flex h-11 min-w-11 items-center justify-center border-b-2 px-1 text-label-13 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
              value === opt.value
                ? "border-blue-700 text-gray-1000"
                : "border-transparent text-gray-900 hover:text-gray-1000"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-md border border-gray-alpha-400 bg-background-200 ${
        pending ? "opacity-70" : ""
      }`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          aria-label={opt.accessibleName}
          onClick={() => onChange(opt.value)}
          onMouseEnter={() => onOptionIntent?.(opt.value)}
          onFocus={() => onOptionIntent?.(opt.value)}
          disabled={pending}
          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 font-medium motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100 ${
            compact ? "text-xs" : "text-sm"
          } ${
            value === opt.value
              ? "bg-background-100 text-gray-1000"
              : "text-gray-900 hover:text-gray-1000"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
