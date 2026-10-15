import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { invokedDirectly } from "../../scripts/indexnow";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_KEY_PATH,
  INDEXNOW_MAX_BATCH,
  INDEXNOW_RELEASE_MARKER,
  INDEXNOW_SITEMAP_URL,
  batchUrlList,
  indexNowReleaseReady,
  indexNowReleaseSitemapUrl,
  redactIndexNow,
  runIndexNow,
  sitemapLocs,
  unsubmittedIndexNowUrls,
} from "@/lib/indexnow";

describe("IndexNow", () => {
  it("serves the public key as the entire file body", () => {
    const body = readFileSync(resolve(process.cwd(), `public${INDEXNOW_KEY_PATH}`));
    expect(body.toString("utf8")).toBe(INDEXNOW_KEY);
    expect(body.length).toBe(INDEXNOW_KEY.length);
  });

  it("collects unique absolute <loc> URLs in document order", () => {
    const xml = `
      <urlset>
        <url><loc>https://grid.vahaah.com/</loc></url>
        <url><loc>
          <![CDATA[https://grid.vahaah.com/today]]>
        </loc></url>
        <url><loc>https://grid.vahaah.com/prices/gas?x=1&amp;y=2</loc></url>
        <url><loc>https://grid.vahaah.com/</loc></url>
        <url><loc>   </loc></url>
        <image:loc>https://grid.vahaah.com/ignored.png</image:loc>
      </urlset>
    `;
    expect(sitemapLocs(xml)).toEqual([
      "https://grid.vahaah.com/",
      "https://grid.vahaah.com/today",
      "https://grid.vahaah.com/prices/gas?x=1&y=2",
    ]);
  });

  it("refuses batches above the IndexNow limit", () => {
    expect(batchUrlList(["https://grid.vahaah.com/"], 1)).toEqual([["https://grid.vahaah.com/"]]);
    expect(batchUrlList(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
    expect(() => batchUrlList(["a"], INDEXNOW_MAX_BATCH + 1)).toThrow(/10000/);
    expect(() => batchUrlList(["a"], 0)).toThrow(/10000/);
  });

  it("posts sitemap URLs in batches of at most 10000", async () => {
    const count = INDEXNOW_MAX_BATCH + 1;
    const urls = Array.from({ length: count }, (_, index) => `https://grid.vahaah.com/p/${index}`);
    const xml = `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
    const posts: Array<{ urlList: string[]; contentType: string | null }> = [];
    const lines: string[] = [];

    const code = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        expect(input).toBe(INDEXNOW_ENDPOINT);
        expect(init?.method).toBe("POST");
        const headers = new Headers(init?.headers);
        const payload = JSON.parse(String(init?.body)) as {
          host: string;
          key: string;
          keyLocation: string;
          urlList: string[];
        };
        posts.push({ urlList: payload.urlList, contentType: headers.get("content-type") });
        expect(payload.host).toBe(INDEXNOW_HOST);
        expect(payload.key).toBe(INDEXNOW_KEY);
        expect(payload.keyLocation).toBe(INDEXNOW_KEY_LOCATION);
        const status = posts.length === 1 ? 200 : 202;
        return new Response(posts.length === 1 ? "" : "Accepted", { status });
      },
    });

    expect(code).toBe(0);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.urlList).toHaveLength(INDEXNOW_MAX_BATCH);
    expect(posts[1]?.urlList).toEqual([urls[INDEXNOW_MAX_BATCH]]);
    expect(posts[0]?.contentType).toBe("application/json; charset=utf-8");
    expect(lines).toEqual([
      `batch 1/2: 200 (${INDEXNOW_MAX_BATCH} urls)`,
      `batch 2/2: 202 (1 urls) Accepted`,
    ]);
  });

  it("prints a failed batch and exits non-zero", async () => {
    const xml = `
      <urlset>
        <url><loc>https://grid.vahaah.com/</loc></url>
        <url><loc>https://grid.vahaah.com/today</loc></url>
      </urlset>
    `;
    const lines: string[] = [];
    const code = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        return new Response("nope", { status: 403 });
      },
    });

    expect(code).toBe(1);
    expect(lines).toEqual(["batch 1/1: 403 (2 urls) nope"]);
  });

  it("prints every batch and exits non-zero when a later batch fails", async () => {
    const count = INDEXNOW_MAX_BATCH + 1;
    const urls = Array.from({ length: count }, (_, index) => `https://grid.vahaah.com/q/${index}`);
    const xml = `<urlset>${urls.map((url) => `<loc>${url}</loc>`).join("")}</urlset>`;
    const lines: string[] = [];
    let posts = 0;
    const code = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        posts += 1;
        if (posts === 1) throw new Error("socket hang up");
        return new Response("Invalid key", { status: 422 });
      },
    });

    expect(code).toBe(1);
    expect(posts).toBe(2);
    expect(lines).toEqual([
      "batch 1/2: error socket hang up",
      "batch 2/2: 422 (1 urls) Invalid key",
    ]);
  });

  it("exits non-zero when the sitemap cannot be read", async () => {
    const lines: string[] = [];
    const missing = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async () => new Response("down", { status: 503 }),
    });
    const empty = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async () => new Response("<urlset></urlset>", { status: 200 }),
    });
    const thrown = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async () => {
        throw new Error("network down");
      },
    });
    expect(missing).toBe(1);
    expect(empty).toBe(1);
    expect(thrown).toBe(1);
    expect(lines).toEqual([
      "sitemap: 503 down",
      "sitemap: error no <loc> URLs",
      "sitemap: error network down",
    ]);
  });

  it("accepts the phase 1A marker and ignores a bare 200", () => {
    const marker = readFileSync(resolve(process.cwd(), "public/release-1a.txt"), "utf8");
    expect(marker.trim()).toBe(INDEXNOW_RELEASE_MARKER);
    expect(indexNowReleaseReady(200, marker)).toBe(true);
    expect(indexNowReleaseReady(200, "phase-1a")).toBe(true);
    expect(indexNowReleaseReady(200, "")).toBe(false);
    expect(indexNowReleaseReady(404, INDEXNOW_RELEASE_MARKER)).toBe(false);
    expect(indexNowReleaseSitemapUrl()).toBe(
      "https://grid.vahaah.com/sitemap.xml?release=phase-1a",
    );
  });

  it("submits only urls outside the settled set and redacts the key", async () => {
    const secret = "super-secret-indexnow-key";
    const urls = unsubmittedIndexNowUrls([
      "https://grid.vahaah.com/",
      "https://grid.vahaah.com/prices/gas",
      "https://grid.vahaah.com/gas",
      "https://grid.vahaah.com/map",
      "https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa",
    ]);
    expect(urls).toEqual([
      "https://grid.vahaah.com/gas",
      "https://grid.vahaah.com/map",
      "https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa",
    ]);
    const lines: string[] = [];
    const code = await runIndexNow({
      key: secret,
      urls,
      log: (line) => lines.push(line),
      fetch: async (_input, init) => {
        const payload = JSON.parse(String(init?.body)) as { key: string; urlList: string[] };
        expect(payload.key).toBe(secret);
        expect(payload.urlList).toEqual(urls);
        return new Response(`rejected ${secret}`, { status: 422 });
      },
    });
    expect(code).toBe(1);
    expect(lines.join("\n")).not.toContain(secret);
    expect(lines[0]).toContain("[redacted]");
    expect(redactIndexNow(`key ${secret}`, secret)).toBe("key [redacted]");
  });

  it("runs only as the tsx entrypoint", () => {
    const entry = resolve(process.cwd(), "scripts/indexnow.ts");
    expect(invokedDirectly(pathToFileURL(entry).href, entry)).toBe(true);
    expect(invokedDirectly(pathToFileURL(entry).href, undefined)).toBe(false);
    expect(invokedDirectly(pathToFileURL(entry).href, "/usr/bin/vitest")).toBe(false);
  });
});
