"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeFromSystem,
  type Theme,
} from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const next = resolveTheme(readStoredTheme(), themeFromSystem());
      setTheme(next);
      applyTheme(next);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        persistTheme(next);
        applyTheme(next);
        setTheme(next);
      }}
      className="relative inline-flex h-8 min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 text-gray-1000 sm:min-h-8"
    >
      {theme === "dark" ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
    </button>
  );
}
