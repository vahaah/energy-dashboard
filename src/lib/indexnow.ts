export const INDEXNOW_HOST = "grid.vahaah.com";
export const INDEXNOW_KEY = "79e85fd471ac4c8e8327acd532d0a9c9";
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}${INDEXNOW_KEY_PATH}`;
export const INDEXNOW_SITEMAP_URL = `https://${INDEXNOW_HOST}/sitemap.xml`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_BATCH = 10_000;

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
};

function decodeXmlText(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (match, name: string) => XML_ENTITIES[name] ?? match);
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

function indexNowSubmission(urlList: readonly string[]): IndexNowSubmission {
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: [...urlList],
  };
}

export async function runIndexNow(options: IndexNowRunOptions = {}): Promise<number> {
  const fetchImpl = options.fetch ?? fetch;
  const log = options.log ?? ((line: string) => console.log(line));

  let sitemapResponse: Response;
  try {
    sitemapResponse = await fetchImpl(INDEXNOW_SITEMAP_URL);
  } catch (error) {
    log(`sitemap: error ${errorMessage(error)}`);
    return 1;
  }

  if (!sitemapResponse.ok) {
    const body = await readBody(sitemapResponse);
    log(`sitemap: ${sitemapResponse.status}${body ? ` ${body}` : ""}`);
    return 1;
  }

  const urls = sitemapLocs(await sitemapResponse.text());
  if (urls.length === 0) {
    log("sitemap: error no <loc> URLs");
    return 1;
  }

  const batches = batchUrlList(urls);
  let failed = false;
  for (const [index, urlList] of batches.entries()) {
    const label = `batch ${index + 1}/${batches.length}`;
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowSubmission(urlList)),
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
