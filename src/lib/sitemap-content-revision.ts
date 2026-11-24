import { execFileSync } from "node:child_process";
import fallbackRevisions from "@/lib/sitemap-content-revisions.json";

/**
 * Source files whose latest commit is the page's content stamp.
 * A live data stamp still wins when the sitemap has one.
 * The commit date stays put across a rebuild of the same sources.
 */
const CONTENT_FILES: Record<string, readonly string[]> = {
  "": ["src/app/page.tsx", "src/components/homepage-briefing.tsx", "src/components/dashboard.tsx", "src/lib/site.ts"],
  "/today": ["src/app/today/page.tsx", "src/lib/today-page.ts", "src/lib/site.ts"],
  "/gas": ["src/app/gas/page.tsx", "src/lib/gas/copy.ts"],
  "/power-cuts": ["src/app/power-cuts/page.tsx"],
  "/system/constraints": ["src/app/system/constraints/page.tsx"],
  "/system/balancing": ["src/app/system/balancing/page.tsx"],
  "/system/storage": ["src/app/system/storage/page.tsx"],
  "/system/whole-energy": ["src/app/system/whole-energy/page.tsx", "data/catalogue/whole-energy.json"],
  "/electricity/northern-ireland": ["src/app/electricity/northern-ireland/page.tsx"],
  "/map": ["src/app/map/page.tsx"],
  "/assets": ["src/app/assets/page.tsx"],
  "/projects": ["src/app/projects/page.tsx", "src/lib/projects/copy.ts", "data/catalogue/energy_projects.ndjson"],
  "/pipeline": ["src/app/pipeline/page.tsx", "data/catalogue/repd_pipeline.json"],
  "/directory": ["src/app/directory/page.tsx", "src/lib/directory/copy.ts", "src/lib/directory/preview.ts"],
  "/directory/identifiers": [
    "src/app/directory/identifiers/page.tsx",
    "src/lib/directory/copy.ts",
    "src/lib/directory/preview.ts",
  ],
  "/tools": ["src/app/tools/page.tsx", "src/lib/tools/copy.ts", "src/lib/tools/ena.ts", "data/catalogue/tools.json"],
  "/changes": ["src/app/changes/page.tsx", "data/catalogue/change_events.json"],
  "/records": ["src/app/records/page.tsx", "src/lib/records-standfirst.ts", "src/lib/site.ts"],
  "/explained/price-cap": ["src/app/explained/price-cap/page.tsx", "src/lib/price-cap.ts", "src/lib/site.ts"],
  "/prices/gas": ["src/app/prices/gas/page.tsx", "src/lib/gas-page.ts", "src/lib/site.ts"],
  "/methodology": ["src/app/methodology/page.tsx"],
  "/data-health": ["src/app/data-health/page.tsx"],
  "/api": ["src/app/api/page.tsx", "src/lib/api/copy.ts"],
  "/privacy": ["src/app/privacy/page.tsx"],
  "/terms": ["src/app/terms/page.tsx"],
  "/data-sources": ["src/app/data-sources/page.tsx"],
};

const cache = new Map<string, Date | undefined>();

/** Latest commit that touched this page's sources. Used when no live data stamp exists. */
export function contentRevision(path: string): Date | undefined {
  if (cache.has(path)) {
    return cache.get(path);
  }
  const date = gitCommitDate(CONTENT_FILES[path] ?? []) ?? fallbackRevision(path);
  cache.set(path, date);
  return date;
}

function gitCommitDate(files: readonly string[]): Date | undefined {
  if (files.length === 0) {
    return undefined;
  }
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...files], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return parseRevision(output);
  } catch {
    return undefined;
  }
}

function fallbackRevision(path: string): Date | undefined {
  const revisions = fallbackRevisions as Record<string, string>;
  return parseRevision(revisions[path]);
}

function parseRevision(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
