import { foldSearch } from "@/lib/assets/query";

export type SearchTask = {
  id: string;
  title: string;
  detail: string;
  href: string;
  keywords: string;
};

/**
 * Pages a header query should reach without loading a catalogue.
 * `keywords` is for matching only. It is not shown in the dialog.
 */
export const SEARCH_TASKS: readonly SearchTask[] = [
  {
    id: "price-cap",
    title: "Price cap",
    detail: "Ofgem household energy price cap",
    href: "/explained/price-cap",
    keywords: "price cap energy bills ofgem january",
  },
  {
    id: "today",
    title: "Electricity today",
    detail: "Mix, carbon and the wholesale price",
    href: "/today",
    keywords: "today electricity mix wholesale price energy mix live",
  },
  {
    id: "tools",
    title: "Tools",
    detail: "Official services, including the ENA search",
    href: "/tools",
    keywords: "tools ena official network operator power cut mpan mprn meter",
  },
  {
    id: "pipeline",
    title: "Pipeline",
    detail: "Planning applications and grid capacity",
    href: "/pipeline",
    keywords: "pipeline grid capacity connection repd renewable energy planning database",
  },
  {
    id: "directory",
    title: "Directory",
    detail: "MPID, BM Unit ID and GSP group",
    href: "/directory",
    keywords: "directory codes mpid bm unit gsp identifier",
  },
  {
    id: "data-sources",
    title: "Data sources",
    detail: "Licences and attribution",
    href: "/data-sources",
    keywords: "data sources licence license attribution",
  },
  {
    id: "records",
    title: "Records",
    detail: "Highest and lowest half-hours since 2009",
    href: "/records",
    keywords: "records highest wind historic mix over time",
  },
  {
    id: "balancing",
    title: "Balancing",
    detail: "Balancing cost and traded electricity",
    href: "/system/balancing",
    keywords: "balancing bsuos balancing cost",
  },
  {
    id: "api",
    title: "API",
    detail: "Published figures as JSON",
    href: "/api",
    keywords: "api market data electricity data flows accessing energy data json",
  },
];

export function searchTasks(query: string): SearchTask[] {
  const tokens = foldSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return [...SEARCH_TASKS];
  }
  return SEARCH_TASKS.filter((task) => {
    const haystack = foldSearch(`${task.title} ${task.detail} ${task.keywords}`);
    return tokens.every((token) => haystack.includes(token));
  });
}
