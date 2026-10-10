import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("share focus redirect", () => {
  it("client-replaces onto /?focus= so crawlers keep the /share/{focus} metadata", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./share-focus-redirect.tsx"), "utf8");
    expect(source).toContain("window.location.replace");
    expect(source).toContain("shareFocusRedirectPath");
    expect(source).not.toContain("redirect(");
  });
});
