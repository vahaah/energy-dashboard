"use client";

import { Info } from "lucide-react";

interface Props {
  text: string;
}

export function InfoTooltip({ text }: Props) {
  return (
    <span className="relative group inline-flex items-center">
      <Info className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-zinc-100 bg-zinc-800 dark:bg-zinc-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-normal w-56 text-center z-50">
        {text}
      </span>
    </span>
  );
}
