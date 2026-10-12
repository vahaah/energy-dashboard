import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MARK_PATH = "M4 4h24v4H8v16h16v-8h-8v-4h12v16H4z";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("GridMark", () => {
  it("is the currentColor pixel-grid path, 24px in headers and 40px on OG", () => {
    const mark = source("src/components/grid-mark.tsx");
    expect(mark).toContain(MARK_PATH);
    expect(mark).toContain('color = "currentColor"');
    expect(mark).toContain('size == null ? "size-6"');

    for (const file of [
      "src/components/site-header.tsx",
      "src/components/site-page-header.tsx",
      "src/app/page.tsx",
      "src/app/records/page.tsx",
    ]) {
      const text = source(file);
      expect(text).toContain("<GridMark />");
      expect(text).not.toContain("text-[11px]");
    }

    const og = source("src/lib/og/image.tsx");
    expect(og).toContain("<GridMark size={40} color={FG} />");
    expect(og).not.toContain(">G<");
    expect(source("src/app/page.tsx")).toContain('export const dynamic = "force-static"');
    expect(source("src/app/page.tsx")).not.toContain("queryPipe");
  });
});
