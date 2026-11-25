export const THEME_STORAGE_KEY = "grid-theme";

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function themeFromSystem(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function resolveTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system;
}

/**
 * The class is what Tailwind paints. A stale inline `color-scheme` must not
 * win, or the page is light and the basemap stays on the dark style. When
 * both classes are present, `.dark` wins: it is later in `globals.css`.
 */
export function documentTheme(root: HTMLElement): Theme {
  const light = root.classList.contains("light");
  const dark = root.classList.contains("dark");
  if (light !== dark) {
    return light ? "light" : "dark";
  }
  if (light && dark) {
    return "dark";
  }
  const scheme = root.style.colorScheme;
  if (scheme === "light" || scheme === "dark") {
    return scheme;
  }
  return themeFromSystem();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#ffffff");
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=null;try{s=localStorage.getItem(k);}catch(e){}var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.classList.toggle("light",t==="light");r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0a0a0a":"#ffffff");})();`;
