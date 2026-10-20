import { isIndexablePath } from "@/lib/site-nav";

const SITEMAP_CANDIDATES = [
  { path: "", changeFrequency: "hourly" as const, priority: 1 },
  { path: "/today", changeFrequency: "hourly" as const, priority: 0.9 },
  { path: "/gas", changeFrequency: "hourly" as const, priority: 0.8 },
  { path: "/system/constraints", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/system/storage", changeFrequency: "hourly" as const, priority: 0.7 },
  { path: "/system/whole-energy", changeFrequency: "yearly" as const, priority: 0.7 },
  { path: "/electricity/northern-ireland", changeFrequency: "hourly" as const, priority: 0.7 },
  { path: "/map", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/assets", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/projects", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/directory", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/directory/identifiers", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/llms.txt", changeFrequency: "hourly" as const, priority: 0.4 },
  { path: "/records", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/explained/price-cap", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/prices/gas", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/methodology", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/data-health", changeFrequency: "hourly" as const, priority: 0.4 },
  { path: "/api", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/data-sources", changeFrequency: "monthly" as const, priority: 0.4 },
];

export const SITEMAP_PATHS = SITEMAP_CANDIDATES.filter((entry) => isIndexablePath(entry.path));
