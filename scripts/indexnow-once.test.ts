import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INDEXNOW_KEY } from "@/lib/indexnow";
import { publishedIndexNowKey } from "./indexnow-once";

describe("indexnow once key", () => {
  it("uses the checked-in public key when no environment variable is set", () => {
    const previous = process.env.INDEXNOW_KEY;
    delete process.env.INDEXNOW_KEY;
    try {
      expect(publishedIndexNowKey()).toBe(INDEXNOW_KEY);
    } finally {
      if (previous === undefined) delete process.env.INDEXNOW_KEY;
      else process.env.INDEXNOW_KEY = previous;
    }
  });

  it("does not read an Actions secret in the IndexNow workflow", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/indexnow.yml"), "utf8");
    expect(workflow).not.toContain("secrets.INDEXNOW_KEY");
    expect(workflow).toContain("npm run indexnow:once");
    const script = readFileSync(resolve(process.cwd(), "scripts/indexnow-once.ts"), "utf8");
    expect(script).not.toContain("INDEXNOW_KEY is unset");
  });
});
