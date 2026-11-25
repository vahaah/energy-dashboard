"use client";

import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { announce } from "@/components/ui/announce";

export function CiteButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          announce("Citation copied");
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label={copied ? "Citation copied" : "Copy citation"}
      className="inline-flex h-8 min-h-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000 sm:min-h-8"
    >
      {copied ? "Copied" : "Cite this"}
    </Button>
  );
}
