"use client";

import { ChoiceRow } from "@/components/ui/choice-row";

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

export function TimeRangeSelector<T extends string>(props: Props<T>) {
  return (
    <ChoiceRow
      value={props.value}
      onChange={props.onChange}
      onOptionIntent={props.onOptionIntent}
      options={props.options}
      pending={props.pending}
      compact={props.compact}
      ariaLabel={props.ariaLabel}
      variant={props.variant === "tabs" ? "underline" : "segmented"}
    />
  );
}
