import { describe, expect, it } from "vitest";
import {
  documentTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function themeRoot(classes: readonly string[], colorScheme = ""): HTMLElement {
  return {
    classList: {
      contains(name: string) {
        return classes.includes(name);
      },
    },
    style: { colorScheme },
  } as HTMLElement;
}

describe("theme", () => {
  it("follows the system when nothing is stored", () => {
    expect(resolveTheme(null, "light")).toBe("light");
    expect(resolveTheme(null, "dark")).toBe("dark");
  });

  it("prefers an explicit stored theme over the system", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("lets the light class beat a stale dark color-scheme", () => {
    expect(documentTheme(themeRoot(["light"], "dark"))).toBe("light");
    expect(documentTheme(themeRoot(["dark"], "light"))).toBe("dark");
    expect(documentTheme(themeRoot(["light", "dark"], "light"))).toBe("dark");
    expect(documentTheme(themeRoot([], "dark"))).toBe("dark");
    expect(documentTheme(themeRoot([], "light"))).toBe("light");
  });

  it("bootstraps from localStorage before paint", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("colorScheme");
    expect(THEME_BOOTSTRAP_SCRIPT).toMatch(/try\{s=localStorage\.getItem\(k\);\}catch/);
    expect(THEME_BOOTSTRAP_SCRIPT).toMatch(/catch\(e\)\{\}var t=/);
  });

  it("keeps the system theme when storage is denied", () => {
    const denied = {
      getItem(): string {
        throw new Error("denied");
      },
      setItem(): void {
        throw new Error("denied");
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: denied },
    });

    expect(readStoredTheme()).toBeNull();
    expect(() => persistTheme("dark")).not.toThrow();
  });
});
