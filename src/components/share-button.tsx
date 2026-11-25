"use client";

import { useState } from "react";

const BUTTON =
  "inline-flex h-8 min-h-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000 sm:min-h-8";

export async function shareOrCopy(url: string, title: string): Promise<"shared" | "copied" | "dismissed"> {
  const absolute = url.startsWith("http://") || url.startsWith("https://") ? url : new URL(url, window.location.origin).href;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url: absolute });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "dismissed";
      }
    }
  }
  await navigator.clipboard.writeText(absolute);
  return "copied";
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [label, setLabel] = useState("Share");

  return (
    <button
      type="button"
      data-share
      aria-live="polite"
      className={BUTTON}
      onClick={() => {
        void shareOrCopy(url, title).then((result) => {
          if (result === "dismissed") {
            return;
          }
          setLabel(result === "copied" ? "Copied" : "Shared");
          window.setTimeout(() => setLabel("Share"), 1400);
        });
      }}
    >
      {label}
    </button>
  );
}
