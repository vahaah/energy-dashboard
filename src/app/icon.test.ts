import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MARK_PATH = "M4 4h24v4H8v16h16v-8h-8v-4h12v16H4z";

describe("brand icons", () => {
  it("ships the pixel-grid favicon, ico and apple icon instead of the live mix donut", () => {
    const root = process.cwd();
    expect(existsSync(resolve(root, "src/app/icon.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "src/lib/mix-favicon.ts"))).toBe(false);

    const svg = readFileSync(resolve(root, "src/app/icon.svg"), "utf8");
    expect(svg).toContain("@media (prefers-color-scheme:dark)");
    expect(svg).toContain(MARK_PATH);
    expect(svg).not.toContain("queryPipe");

    const ico = readFileSync(resolve(root, "src/app/favicon.ico"));
    expect(ico.readUInt16LE(4)).toBe(3);

    const png = readFileSync(resolve(root, "src/app/apple-icon.png"));
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});
