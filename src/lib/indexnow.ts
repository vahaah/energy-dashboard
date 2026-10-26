import {
  formatIndexNowMarker,
  resolveIndexNowMarkerStore,
  type IndexNowMarker,
  type IndexNowMarkerStore,
} from "@/lib/indexnow-marker";

export const INDEXNOW_HOST = "grid.vahaah.com";
export const INDEXNOW_KEY = "79e85fd471ac4c8e8327acd532d0a9c9";
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}${INDEXNOW_KEY_PATH}`;
export const INDEXNOW_SITEMAP_URL = `https://${INDEXNOW_HOST}/sitemap.xml`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_BATCH = 10_000;
export const INDEXNOW_POST_ATTEMPTS = 3;
export const INDEXNOW_POST_TIMEOUT_MS = 30_000;
export const INDEXNOW_POST_BACKOFF_MS = [200, 800] as const;

const SECRET_ENV = [
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "INDEXNOW_KEY",
] as const;

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

export type IndexNowMode = "all" | "changed";

export type IndexNowRunOptions = {
  fetch?: IndexNowFetch;
  log?: (line: string) => void;
  /** Defaults to the published key. The post-deploy one-shot passes the env key. */
  key?: string;
  /** When set, submit these URLs and do not read the sitemap. */
  urls?: readonly string[];
  /** Default is every sitemap URL. The script's default is `changed`. */
  mode?: IndexNowMode;
  /** Changed mode reads this store. When omitted, Redis or Blob is used. */
  marker?: IndexNowMarkerStore;
  sleep?: (ms: number) => Promise<void>;
};

export type SitemapUrlEntry = {
  url: string;
  lastmod: string | null;
  /** Sitemap child this URL came from. Checkpoints are per stream. */
  stream: string;
};

/** A production deployment ref of `main`, `refs/heads/main`, or a SHA that is on main. */
export function indexNowDeploymentOnMain(ref: string, shaIsOnMain: boolean): boolean {
  switch (ref) {
    case "main":
    case "refs/heads/main":
      return true;
    default:
      return shaIsOnMain;
  }
}

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

/** `<loc>` values paired with the `<lastmod>` that follows each one. */
export function sitemapUrlEntries(xml: string, stream: string): SitemapUrlEntry[] {
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];
  const pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc>([\s\S]*?)(?=<loc\b|<\/url>|<\/sitemap>|$)/gi;
  for (const match of xml.matchAll(pattern)) {
    const url = locText(match[1] ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const lastmodMatch = /<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i.exec(match[2] ?? "");
    const raw = lastmodMatch ? locText(lastmodMatch[1] ?? "") : "";
    entries.push({ url, stream, lastmod: lastmodTime(raw) == null ? null : raw.trim() });
  }
  return entries;
}

export function lastmodTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** URLs whose lastmod is strictly newer than that sitemap stream's checkpoint. */
export function changedIndexNowUrls(
  entries: readonly SitemapUrlEntry[],
  marker: IndexNowMarker | null,
): SitemapUrlEntry[] {
  const streams = marker?.streams ?? {};
  return entries.filter((entry) => {
    const time = lastmodTime(entry.lastmod);
    if (time == null) return false;
    const floor = lastmodTime(streams[entry.stream]);
    if (floor == null) return true;
    return time > floor;
  });
}

/** Advance only the streams represented in `submitted`. Other checkpoints stay. */
export function advanceIndexNowMarker(
  previous: IndexNowMarker | null,
  submitted: readonly SitemapUrlEntry[],
): IndexNowMarker {
  const streams = { ...(previous?.streams ?? {}) };
  const best = new Map<string, number>();
  for (const entry of submitted) {
    const time = lastmodTime(entry.lastmod);
    if (time == null) continue;
    const current = best.get(entry.stream);
    if (current == null || time > current) best.set(entry.stream, time);
  }
  for (const [stream, time] of best) {
    streams[stream] = new Date(time).toISOString();
  }
  return { streams };
}

export function maxLastmod(entries: readonly SitemapUrlEntry[]): string | null {
  let best: number | null = null;
  for (const entry of entries) {
    const time = lastmodTime(entry.lastmod);
    if (time == null) continue;
    if (best == null || time > best) best = time;
  }
  return best == null ? null : new Date(best).toISOString();
}

/** Page URLs from a urlset, or from one level of sitemap index. */
export async function pageEntriesFromSitemap(xml: string, fetchImpl: IndexNowFetch): Promise<SitemapUrlEntry[]> {
  if (!isSitemapIndex(xml)) {
    return sitemapUrlEntries(xml, INDEXNOW_SITEMAP_URL);
  }
  const pages: SitemapUrlEntry[] = [];
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
    for (const entry of sitemapUrlEntries(body, loc)) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      pages.push(entry);
    }
  }
  return pages;
}

/** Page URLs from a urlset, or from one level of sitemap index. */
export async function pageUrlsFromSitemap(xml: string, fetchImpl: IndexNowFetch): Promise<string[]> {
  const entries = await pageEntriesFromSitemap(xml, fetchImpl);
  return entries.map((entry) => entry.url);
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

export function redactConfiguredSecrets(line: string): string {
  let out = line;
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value && value.length >= 8) {
      out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

export async function runIndexNow(options: IndexNowRunOptions = {}): Promise<number> {
  const key = options.key ?? INDEXNOW_KEY;
  const fetchImpl = options.fetch ?? fetch;
  const write = options.log ?? ((line: string) => console.log(line));
  const log = (line: string) => write(redactConfiguredSecrets(redactIndexNow(line, key)));
  const sleep = options.sleep ?? defaultSleep;
  const mode = options.mode ?? "all";

  if (options.urls) {
    return postIndexNow(options.urls, key, fetchImpl, log, sleep);
  }

  let markerStore: IndexNowMarkerStore | null = null;
  if (mode === "changed") {
    markerStore = options.marker ?? resolveIndexNowMarkerStore();
    if (!markerStore) {
      log("marker: store unset");
      return 1;
    }
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

  let entries: SitemapUrlEntry[];
  try {
    entries = await pageEntriesFromSitemap(await sitemapResponse.text(), fetchImpl);
  } catch (error) {
    log(`sitemap: error ${errorMessage(error)}`);
    return 1;
  }
  if (entries.length === 0) {
    log("sitemap: error no <loc> URLs");
    return 1;
  }

  switch (mode) {
    case "all":
      return submitAll(entries, options.marker, options.mode === "all", key, fetchImpl, log, sleep);
    case "changed":
      return submitChanged(entries, markerStore, key, fetchImpl, log, sleep);
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

async function submitAll(
  entries: readonly SitemapUrlEntry[],
  marker: IndexNowMarkerStore | undefined,
  reportMissingStore: boolean,
  key: string,
  fetchImpl: IndexNowFetch,
  log: (line: string) => void,
  sleep: (ms: number) => Promise<void>,
): Promise<number> {
  const code = await postIndexNow(entries.map((entry) => entry.url), key, fetchImpl, log, sleep);
  if (code !== 0) return code;
  const store = marker ?? resolveIndexNowMarkerStore();
  if (!store) {
    if (reportMissingStore) log("marker: store unset");
    return 0;
  }
  let previous: IndexNowMarker | null;
  try {
    previous = await store.read();
  } catch (error) {
    log(`marker: error ${errorMessage(error)}`);
    return 1;
  }
  return writeMarker(store, advanceIndexNowMarker(previous, entries), log);
}

async function submitChanged(
  entries: readonly SitemapUrlEntry[],
  markerStore: IndexNowMarkerStore | null,
  key: string,
  fetchImpl: IndexNowFetch,
  log: (line: string) => void,
  sleep: (ms: number) => Promise<void>,
): Promise<number> {
  if (!markerStore) {
    log("marker: store unset");
    return 1;
  }
  let marker: IndexNowMarker | null;
  try {
    marker = await markerStore.read();
  } catch (error) {
    log(`marker: error ${errorMessage(error)}`);
    return 1;
  }
  const selected = changedIndexNowUrls(entries, marker);
  log(`changed: ${selected.length} urls`);
  if (selected.length === 0) return 0;
  const code = await postIndexNow(selected.map((entry) => entry.url), key, fetchImpl, log, sleep);
  if (code !== 0) return code;
  return writeMarker(markerStore, advanceIndexNowMarker(marker, selected), log);
}

async function writeMarker(
  store: IndexNowMarkerStore,
  marker: IndexNowMarker,
  log: (line: string) => void,
): Promise<number> {
  if (Object.keys(marker.streams).length === 0) {
    log("marker: no lastmod");
    return 0;
  }
  try {
    await store.write(marker);
  } catch (error) {
    log(`marker: error ${errorMessage(error)}`);
    return 1;
  }
  log(`marker: ${formatIndexNowMarker(marker)}`);
  return 0;
}

async function postIndexNow(
  urls: readonly string[],
  key: string,
  fetchImpl: IndexNowFetch,
  log: (line: string) => void,
  sleep: (ms: number) => Promise<void>,
): Promise<number> {
  if (urls.length === 0) {
    log("no urls");
    return 0;
  }
  const batches = batchUrlList(urls);
  let failed = false;
  for (const [index, urlList] of batches.entries()) {
    const label = `batch ${index + 1}/${batches.length}`;
    const posted = await postBatch(label, urlList, key, fetchImpl, log, sleep);
    if (!posted) failed = true;
  }

  return failed ? 1 : 0;
}

async function postBatch(
  label: string,
  urlList: readonly string[],
  key: string,
  fetchImpl: IndexNowFetch,
  log: (line: string) => void,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  for (let attempt = 0; attempt < INDEXNOW_POST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        redirect: "manual",
        cache: "no-store",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowSubmission(urlList, key)),
        signal: AbortSignal.timeout(INDEXNOW_POST_TIMEOUT_MS),
      });
      const body = await readBody(response);
      const retry = isRetryableStatus(response.status) && attempt < INDEXNOW_POST_ATTEMPTS - 1;
      log(`${label}: ${response.status} (${urlList.length} urls)${body ? ` ${body}` : ""}${retry ? " retry" : ""}`);
      if (isIndexNowOk(response.status)) return true;
      if (!retry) return false;
    } catch (error) {
      const retry = isRetryablePostError(error) && attempt < INDEXNOW_POST_ATTEMPTS - 1;
      log(`${label}: error ${errorMessage(error)}${retry ? " retry" : ""}`);
      if (!retry) return false;
    }
    const wait = INDEXNOW_POST_BACKOFF_MS[attempt];
    if (wait != null) await sleep(wait);
  }
  return false;
}

function isIndexNowOk(status: number): boolean {
  return status === 200 || status === 202;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function isRetryablePostError(error: unknown): boolean {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") return true;
  }
  if (!(error instanceof Error)) return false;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|Network request failed|network timeout|^fetch failed$/i.test(
    error.message,
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
