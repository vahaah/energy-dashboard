"use client";

import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";

type Option<T extends string> = {
  value: T;
  label: string;
  accessibleName?: string;
};

const SEGMENTED_ITEM =
  "inline-flex h-11 min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-label-13 text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-700 data-checked:bg-background-100 data-checked:text-gray-1000 sm:h-8 sm:min-h-8";

const UNDERLINE_ITEM =
  "inline-flex h-11 min-h-11 min-w-11 items-center justify-center border-b-2 border-transparent px-1 text-label-13 text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-700 data-checked:border-blue-700 data-checked:text-gray-1000 sm:min-h-8";

const CHIP_ITEM =
  "inline-flex h-11 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-900 capitalize focus-visible:ring-2 focus-visible:ring-blue-700 data-checked:border-gray-1000 data-checked:text-gray-1000 sm:h-8 sm:min-h-8";

export function ChoiceRow<T extends string>({
  value,
  onChange,
  onOptionIntent,
  options,
  pending = false,
  compact = false,
  ariaLabel,
  variant = "segmented",
}: {
  value: T | null;
  onChange: (value: T) => void;
  onOptionIntent?: (value: T) => void;
  options: ReadonlyArray<Option<T>>;
  pending?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  variant?: "segmented" | "underline" | "chips";
}) {
  const itemClass =
    variant === "underline" ? UNDERLINE_ITEM : variant === "chips" ? CHIP_ITEM : compact ? `${SEGMENTED_ITEM} text-xs` : SEGMENTED_ITEM;
  const rootClass =
    variant === "underline"
      ? `flex flex-wrap items-center gap-x-4 gap-y-1 ${pending ? "opacity-70" : ""}`
      : variant === "chips"
        ? "mt-3 flex flex-wrap gap-2"
        : `inline-flex max-w-full flex-wrap items-center rounded-md border border-gray-alpha-400 bg-background-200 ${pending ? "opacity-70" : ""}`;

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      value={value}
      disabled={pending}
      onValueChange={(next) => {
        if (next) {
          onChange(next as T);
        }
      }}
      className={rootClass}
    >
      {options.map((option) => (
        <SegmentedControlItem
          key={option.value}
          value={option.value}
          aria-label={option.accessibleName}
          disabled={pending}
          className={itemClass}
          onMouseEnter={() => onOptionIntent?.(option.value)}
          onFocus={() => onOptionIntent?.(option.value)}
        >
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
