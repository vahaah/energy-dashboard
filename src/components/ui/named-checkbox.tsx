"use client";

import type { ReactNode } from "react";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";

export function NamedCheckbox({
  name,
  label,
  checked,
  onCheckedChange,
  children,
}: {
  name: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 text-copy-14 text-gray-1000">
      <Checkbox
        name={name}
        checked={checked}
        aria-label={label}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-gray-alpha-400 bg-background-100 data-checked:border-gray-1000 data-checked:bg-gray-1000"
      >
        <CheckboxIndicator className="size-2 rounded-sm bg-background-100" />
      </Checkbox>
      {children ?? label}
    </label>
  );
}
