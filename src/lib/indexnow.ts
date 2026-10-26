export const INDEXNOW_HOST = "grid.vahaah.com";
export const INDEXNOW_KEY = "79e85fd471ac4c8e8327acd532d0a9c9";
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}${INDEXNOW_KEY_PATH}`;
export const INDEXNOW_SITEMAP_URL = `https://${INDEXNOW_HOST}/sitemap.xml`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_BATCH = 10_000;

/** Body of `public/release-1a.txt`. The previous production deploy does not serve it. */
export const INDEXNOW_RELEASE_MARKER = "phase-1a";
export const INDEXNOW_RELEASE_PROBE_PATH = "/release-1a.txt";

/** Body of `public/release-1b.txt`. The Phase 1A deployment does not serve it. */
export const INDEXNOW_PHASE_1B_MARKER = "phase-1b";
export const INDEXNOW_PHASE_1B_PROBE_PATH = "/release-1b.txt";

export function indexNowReleaseReady(status: number, body: string): boolean {
  return indexNowPhaseReady(status, body, INDEXNOW_RELEASE_MARKER);
}

export function indexNowPhaseReady(status: number, body: string, marker: string): boolean {
  return status === 200 && body.trim() === marker;
}

/** Sitemap URL that misses a CDN entry cached for the previous deployment. */
export function indexNowReleaseSitemapUrl(origin = `https://${INDEXNOW_HOST}`): string {
  return indexNowPhaseSitemapUrl(INDEXNOW_RELEASE_MARKER, origin);
}

export function indexNowPhaseSitemapUrl(marker: string, origin = `https://${INDEXNOW_HOST}`): string {
  const url = new URL("/sitemap.xml", origin);
  url.searchParams.set("release", marker);
  return url.toString();
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export type IndexNowSubmission = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export type IndexNowFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type IndexNowRunOptions = {
  fetch?: IndexNowFetch;
  log?: (line: string) => void;
  /** Defaults to the published key. The post-deploy one-shot passes the env key. */
  key?: string;
  /** When set, submit these URLs and do not read the sitemap. */
  urls?: readonly string[];
};

/** Paths already submitted before the Phase 1A routes. The one-shot posts the rest. */
export const INDEXNOW_SETTLED_PATHS = [
  "/",
  "/today",
  "/llms.txt",
  "/records",
  "/explained/price-cap",
  "/prices/gas",
  "/methodology",
  "/data-health",
  "/api",
  "/privacy",
  "/terms",
  "/data-sources",
] as const;

/** Exact paths the Phase 1A one-shot already posted, on top of the pre-1A set. */
export const INDEXNOW_PHASE_1A_PATHS = ["/gas", "/map", "/assets"] as const;

/** Asset pages posted with Phase 1A. The Phase 1B one-shot leaves them alone. */
export const INDEXNOW_PHASE_1A_PREFIXES = ["/assets/"] as const;

export function phase1bSettledPaths(): readonly string[] {
  return [...INDEXNOW_SETTLED_PATHS, ...INDEXNOW_PHASE_1A_PATHS];
}

export function indexNowPath(url: string): string {
  return new URL(url).pathname;
}

/** Sitemap locs that are not in the settled set. Order is preserved. */
export function unsubmittedIndexNowUrls(
  urls: readonly string[],
  settled: readonly string[] = INDEXNOW_SETTLED_PATHS,
  prefixes: readonly string[] = [],
): string[] {
  const done = new Set(settled);
  return urls.filter((url) => {
    const path = indexNowPath(url);
    if (done.has(path)) {
      return false;
    }
    return !prefixes.some((prefix) => path.startsWith(prefix));
  });
}

export function redactIndexNow(line: string, key: string): string {
  if (key.length === 0) {
    return line;
  }
  return line.split(key).join("[redacted]");
}

function decodeXmlText(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (match, name: string) => XML_ENTITIES[name] ?? match);
}

const SITEMAP_READ_TIMEOUT_MS = 20_000;

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/.test(xml);
}

export function sitemapLocs(xml: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  for (const match of xml.matchAll(pattern)) {
    const loc = locText(match[1] ?? "");
    if (!loc || seen.has(loc)) continue;
    seen.add(loc);
    urls.push(loc);
  }
  return urls;
}

/** Page URLs from a urlset, or from one level of sitemap index. */
export async function pageUrlsFromSitemap(xml: string, fetchImpl: IndexNowFetch): Promise<string[]> {
  if (!isSitemapIndex(xml)) {
    return sitemapLocs(xml);
  }
  const pages: string[] = [];
  const seen = new Set<string>();
  for (const loc of sitemapLocs(xml)) {
    let response: Response;
    try {
      response = await fetchImpl(loc, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(SITEMAP_READ_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`sitemap child: ${errorMessage(error)}`);
    }
    if (!response.ok) {
      throw new Error(`sitemap child: ${response.status}`);
    }
    const body = await response.text();
    if (!/<urlset[\s>]/.test(body) || /<sitemapindex[\s>]/.test(body)) {
      throw new Error("sitemap child: not a urlset");
    }
    for (const url of sitemapLocs(body)) {
      if (seen.has(url)) continue;
      seen.add(url);
      pages.push(url);
    }
  }
  return pages;
}

export function batchUrlList(urls: readonly string[], size = INDEXNOW_MAX_BATCH): string[][] {
  if (!Number.isInteger(size) || size < 1 || size > INDEXNOW_MAX_BATCH) {
    throw new Error(`IndexNow batch size must be an integer from 1 to ${INDEXNOW_MAX_BATCH}`);
  }
  const batches: string[][] = [];
  for (let index = 0; index < urls.length; index += size) {
    batches.push(urls.slice(index, index + size));
  }
  return batches;
}

function indexNowSubmission(urlList: readonly string[], key: string): IndexNowSubmission {
  return {
    host: INDEXNOW_HOST,
    key,
    keyLocation: `https://${INDEXNOW_HOST}/${key}.txt`,
    urlList: [...urlList],
  };
}

export async function runIndexNow(options: IndexNowRunOptions = {}): Promise<number> {
  const key = options.key ?? INDEXNOW_KEY;
  const fetchImpl = options.fetch ?? fetch;
  const write = options.log ?? ((line: string) => console.log(line));
  const log = (line: string) => write(redactIndexNow(line, key));

  if (options.urls) {
    return postIndexNow(options.urls, key, fetchImpl, log);
  }

  let sitemapResponse: Response;
  try {
    sitemapResponse = await fetchImpl(INDEXNOW_SITEMAP_URL, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(SITEMAP_READ_TIMEOUT_MS),
    });
  } catch (error) {
    log(`sitemap: error ${errorMessage(error)}`);
    return 1;
  }

  if (!sitemapResponse.ok) {
    const body = await readBody(sitemapResponse);
    log(`sitemap: ${sitemapResponse.status}${body ? ` ${body}` : ""}`);
    return 1;
  }

  let urls: string[];
  try {
    urls = await pageUrlsFromSitemap(await sitemapResponse.text(), fetchImpl);
  } catch (error) {
    log(`sitemap: error ${errorMessage(error)}`);
    return 1;
  }
  if (urls.length === 0) {
    log("sitemap: error no <loc> URLs");
    return 1;
  }

  return postIndexNow(urls, key, fetchImpl, log);
}

async function postIndexNow(
  urls: readonly string[],
  key: string,
  fetchImpl: IndexNowFetch,
  log: (line: string) => void,
): Promise<number> {
  if (urls.length === 0) {
    log("no urls");
    return 0;
  }
  const batches = batchUrlList(urls);
  let failed = false;
  for (const [index, urlList] of batches.entries()) {
    const label = `batch ${index + 1}/${batches.length}`;
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowSubmission(urlList, key)),
      });
      const body = await readBody(response);
      log(`${label}: ${response.status} (${urlList.length} urls)${body ? ` ${body}` : ""}`);
      if (!response.ok) failed = true;
    } catch (error) {
      log(`${label}: error ${errorMessage(error)}`);
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

function locText(raw: string): string {
  const trimmed = raw.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(trimmed);
  return decodeXmlText((cdata?.[1] ?? trimmed).trim());
}

async function readBody(response: Response): Promise<string> {
  try {
    return (await response.text()).trim().replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
