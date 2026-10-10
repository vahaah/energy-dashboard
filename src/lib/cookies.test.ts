import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cookies", () => {
  it("does not set non-essential cookies, so there is no banner", () => {
    const theme = readFileSync(resolve(process.cwd(), "src/lib/theme.ts"), "utf8");
    const api = readFileSync(resolve(process.cwd(), "src/lib/api-route.ts"), "utf8");
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    const privacy = readFileSync(resolve(process.cwd(), "src/app/privacy/page.tsx"), "utf8");
    const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");

    expect(theme).toContain("localStorage");
    expect(theme).not.toContain("document.cookie");
    expect(api).toContain('response.headers.delete("Set-Cookie")');
    expect(proxy).not.toContain("Set-Cookie");
    expect(packageJson).not.toContain("@vercel/analytics");
    expect(privacy).toContain("does not show a cookie banner");
    expect(privacy).toContain("does not set first-party cookies");
  });
});
