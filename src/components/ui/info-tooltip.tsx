"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";

interface Props {
  text: ReactNode;
  label: string;
  align?: "center" | "end";
}

export function InfoTooltip({ text, label, align = "center" }: Props) {
  return (
    <Tooltip toggleable>
      <TooltipTrigger
        aria-label={label}
        className="inline-grid size-11 place-items-center text-gray-900 hover:text-gray-1000"
      >
        <span
          className="inline-flex size-3.5 items-center justify-center rounded-full border border-gray-alpha-400 text-[10px] leading-none"
          aria-hidden="true"
        >
          ?
        </span>
      </TooltipTrigger>
      <TooltipContent
        align={align}
        className="z-50 max-w-[280px] rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-2 text-left text-copy-14 text-gray-1000"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
