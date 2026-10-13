import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("live mix favicon route", () => {
  it("reuses the cached 24h snapshots_range query and does not add a pipe", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/icon.tsx"), "utf8");

    expect(source).toContain('queryPipe<EnergySnapshot>');
    expect(source).toContain('"snapshots_range"');
    expect(source).toContain("getHeadlineSnapshotsQueryParams");
    expect(source).toContain('range: "24h"');
    expect(source).toContain("revalidate = 300");
    expect(source).not.toContain("latest_snapshot");
    expect(source).not.toContain("latest_generation");
    expect(source).not.toContain("latest_prices");
  });

  it("does not ship a static favicon that would shadow the mix icon", () => {
    const root = process.cwd();
    for (const file of [
      "src/app/favicon.ico",
      "src/app/icon.svg",
      "src/app/icon.png",
      "src/app/apple-icon.png",
      "public/favicon.ico",
      "public/apple-touch-icon.png",
    ]) {
      expect(existsSync(resolve(root, file)), file).toBe(false);
    }
  });
});
