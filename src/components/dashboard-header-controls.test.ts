import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard header controls", () => {
  it("keeps date, Refresh, and Share 44px at every viewport", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");

    expect(source).toContain("h-11");
    expect(source).not.toContain("sm:h-9");
  });
});

describe("info tooltip hit area", () => {
  it("keeps a 44px tap target and opens on tap or focus", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./ui/info-tooltip.tsx"),
      "utf8"
    );

    expect(source).toContain("size-11");
    expect(source).toContain("onFocus");
    expect(source).toContain("onClick");
    expect(source).not.toContain("size-6");
  });
});
