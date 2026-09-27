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
