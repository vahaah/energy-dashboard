import { describe, expect, it } from "vitest";
import {
  persistTheme,
  readStoredTheme,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

describe("theme", () => {
  it("follows the system when nothing is stored", () => {
    expect(resolveTheme(null, "light")).toBe("light");
    expect(resolveTheme(null, "dark")).toBe("dark");
  });

  it("prefers an explicit stored theme over the system", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("bootstraps from localStorage before paint", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("colorScheme");
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
