import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { INDEXNOW_MARKER_FILE_ENV } from "@/lib/indexnow-marker";
import { invokedDirectly, parseIndexNowArgs } from "../../scripts/indexnow";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_KEY_PATH,
  INDEXNOW_MAX_BATCH,
  INDEXNOW_POST_ATTEMPTS,
  INDEXNOW_PHASE_1A_PREFIXES,
  INDEXNOW_PHASE_1B_MARKER,
  INDEXNOW_PHASE_1B_PROBE_PATH,
  INDEXNOW_RELEASE_MARKER,
  INDEXNOW_SITEMAP_URL,
  indexNowPhaseReady,
  indexNowPhaseSitemapUrl,
  phase1bSettledPaths,
  batchUrlList,
  changedIndexNowUrls,
  advanceIndexNowMarker,
  indexNowDeploymentOnMain,
  maxLastmod,
  sitemapUrlEntries,
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

  it("follows one sitemap index and posts the child page URLs", async () => {
    const index = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://grid.vahaah.com/sitemap/pages.xml</loc><lastmod>2026-10-26T00:00:00.000Z</lastmod></sitemap>
        <sitemap><loc>https://grid.vahaah.com/sitemap/assets.xml</loc><lastmod>2026-10-26T00:00:00.000Z</lastmod></sitemap>
      </sitemapindex>`;
    const pages = `<urlset><url><loc>https://grid.vahaah.com/</loc></url><url><loc>https://grid.vahaah.com/gas</loc></url></urlset>`;
    const assets = `<urlset><url><loc>https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa</loc></url></urlset>`;
    const posts: string[][] = [];
    const code = await runIndexNow({
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(index, { status: 200 });
        if (input === "https://grid.vahaah.com/sitemap/pages.xml") return new Response(pages, { status: 200 });
        if (input === "https://grid.vahaah.com/sitemap/assets.xml") return new Response(assets, { status: 200 });
        expect(input).toBe(INDEXNOW_ENDPOINT);
        const payload = JSON.parse(String(init?.body)) as { urlList: string[] };
        posts.push(payload.urlList);
        return new Response("", { status: 200 });
      },
    });
    expect(code).toBe(0);
    expect(posts).toEqual([[
      "https://grid.vahaah.com/",
      "https://grid.vahaah.com/gas",
      "https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa",
    ]]);
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
      sleep: async () => undefined,
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        posts += 1;
        if (posts <= INDEXNOW_POST_ATTEMPTS) throw new Error("socket hang up");
        return new Response("Invalid key", { status: 422 });
      },
    });

    expect(code).toBe(1);
    expect(posts).toBe(INDEXNOW_POST_ATTEMPTS + 1);
    expect(lines).toEqual([
      "batch 1/2: error socket hang up retry",
      "batch 1/2: error socket hang up retry",
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

  it("accepts the phase 1B marker and skips routes the 1A one-shot already posted", () => {
    const marker = readFileSync(resolve(process.cwd(), `public${INDEXNOW_PHASE_1B_PROBE_PATH}`), "utf8");
    expect(marker.trim()).toBe(INDEXNOW_PHASE_1B_MARKER);
    expect(indexNowPhaseReady(200, marker, INDEXNOW_PHASE_1B_MARKER)).toBe(true);
    expect(indexNowPhaseReady(200, "phase-1a", INDEXNOW_PHASE_1B_MARKER)).toBe(false);
    expect(indexNowPhaseSitemapUrl(INDEXNOW_PHASE_1B_MARKER)).toBe(
      "https://grid.vahaah.com/sitemap.xml?release=phase-1b",
    );
    const urls = unsubmittedIndexNowUrls(
      [
        "https://grid.vahaah.com/",
        "https://grid.vahaah.com/gas",
        "https://grid.vahaah.com/map",
        "https://grid.vahaah.com/assets",
        "https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa",
        "https://grid.vahaah.com/system/constraints",
        "https://grid.vahaah.com/system/storage",
        "https://grid.vahaah.com/system/whole-energy",
        "https://grid.vahaah.com/electricity/northern-ireland",
        "https://grid.vahaah.com/projects",
        "https://grid.vahaah.com/projects/epj_12b1f540736598a6/example",
        "https://grid.vahaah.com/directory",
        "https://grid.vahaah.com/directory/identifiers",
        "https://grid.vahaah.com/tools",
        "https://grid.vahaah.com/changes",
      ],
      phase1bSettledPaths(),
      INDEXNOW_PHASE_1A_PREFIXES,
    );
    expect(urls.map((url) => new URL(url).pathname)).toEqual([
      "/system/constraints",
      "/system/storage",
      "/system/whole-energy",
      "/electricity/northern-ireland",
      "/projects",
      "/projects/epj_12b1f540736598a6/example",
      "/directory",
      "/directory/identifiers",
      "/tools",
      "/changes",
    ]);
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

  it("retries a transient batch status and accepts only 200 or 202", async () => {
    const xml = `<urlset><url><loc>https://grid.vahaah.com/</loc><lastmod>2026-10-26T00:00:00.000Z</lastmod></url></urlset>`;
    const lines: string[] = [];
    const waits: number[] = [];
    let posts = 0;
    const retried = await runIndexNow({
      log: (line) => lines.push(line),
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        posts += 1;
        if (posts === 1) return new Response("busy", { status: 503 });
        return new Response("", { status: 200 });
      },
    });
    const rejected = await runIndexNow({
      log: (line) => lines.push(line),
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        return new Response(null, { status: 204 });
      },
    });
    expect(retried).toBe(0);
    expect(rejected).toBe(1);
    expect(waits).toEqual([200]);
    expect(lines).toEqual([
      "batch 1/1: 503 (1 urls) busy retry",
      "batch 1/1: 200 (1 urls)",
      "batch 1/1: 204 (1 urls)",
    ]);
  });

  it("submits lastmods newer than the marker and stores the high water mark", async () => {
    const index = `<sitemapindex>
      <sitemap><loc>https://grid.vahaah.com/sitemap/pages.xml</loc><lastmod>2026-10-02T00:00:00.000Z</lastmod></sitemap>
    </sitemapindex>`;
    const pages = `<urlset>
      <url><loc>https://grid.vahaah.com/old</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/same</loc><lastmod>2026-10-02T00:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/new</loc><lastmod>2026-10-03T12:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/blank</loc></url>
    </urlset>`;
    const pagesStream = "https://grid.vahaah.com/sitemap/pages.xml";
    let stored: { streams: Record<string, string> } | null = {
      streams: {
        [pagesStream]: "2026-10-02T00:00:00.000Z",
        "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z",
      },
    };
    const posts: string[][] = [];
    const lines: string[] = [];
    const code = await runIndexNow({
      mode: "changed",
      marker: {
        read: async () => stored,
        write: async (marker) => {
          stored = marker;
        },
      },
      log: (line) => lines.push(line),
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(index, { status: 200 });
        if (input === "https://grid.vahaah.com/sitemap/pages.xml") return new Response(pages, { status: 200 });
        const payload = JSON.parse(String(init?.body)) as { urlList: string[] };
        posts.push(payload.urlList);
        return new Response("", { status: 202 });
      },
    });
    expect(code).toBe(0);
    expect(posts).toEqual([["https://grid.vahaah.com/new"]]);
    expect(stored).toEqual({
      streams: {
        "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z",
        [pagesStream]: "2026-10-03T12:00:00.000Z",
      },
    });
    expect(lines).toEqual([
      "changed: 1 urls",
      "batch 1/1: 202 (1 urls)",
      'marker: {"streams":{"https://grid.vahaah.com/sitemap/assets.xml":"2026-08-03T09:00:03.000Z","https://grid.vahaah.com/sitemap/pages.xml":"2026-10-03T12:00:00.000Z"}}',
    ]);
    expect(
      changedIndexNowUrls(sitemapUrlEntries(pages, pagesStream), {
        streams: { [pagesStream]: "2026-10-02T00:00:00.000Z" },
      }).map((entry) => entry.url),
    ).toEqual(["https://grid.vahaah.com/new"]);
    expect(maxLastmod(sitemapUrlEntries(pages, pagesStream))).toBe("2026-10-03T12:00:00.000Z");
  });

  it("submits a catalogue URL published before the pages checkpoint", () => {
    const pages = "https://grid.vahaah.com/sitemap/pages.xml";
    const assets = "https://grid.vahaah.com/sitemap/assets.xml";
    const entries = [
      { url: "https://grid.vahaah.com/", lastmod: "2026-10-26T17:00:00.000Z", stream: pages },
      { url: "https://grid.vahaah.com/assets/new", lastmod: "2026-10-20T00:00:00.000Z", stream: assets },
      { url: "https://grid.vahaah.com/assets/old", lastmod: "2026-08-03T09:00:03.000Z", stream: assets },
    ];
    const marker = {
      streams: {
        [pages]: "2026-10-26T17:00:00.000Z",
        [assets]: "2026-08-03T09:00:03.000Z",
      },
    };
    expect(changedIndexNowUrls(entries, marker).map((entry) => entry.url)).toEqual([
      "https://grid.vahaah.com/assets/new",
    ]);
    expect(advanceIndexNowMarker(marker, changedIndexNowUrls(entries, marker))).toEqual({
      streams: {
        [pages]: "2026-10-26T17:00:00.000Z",
        [assets]: "2026-10-20T00:00:00.000Z",
      },
    });
  });

  it("treats main and a SHA on main as the production branch", () => {
    expect(indexNowDeploymentOnMain("refs/heads/main", false)).toBe(true);
    expect(indexNowDeploymentOnMain("main", false)).toBe(true);
    expect(indexNowDeploymentOnMain("5da675f58aeb72266c87c42c5bbcf475beac82fd", true)).toBe(true);
    expect(indexNowDeploymentOnMain("5da675f58aeb72266c87c42c5bbcf475beac82fd", false)).toBe(false);
  });

  it("leaves the marker in place when a changed batch fails", async () => {
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/a</loc><lastmod>2026-10-04T00:00:00.000Z</lastmod></url>
    </urlset>`;
    let writes = 0;
    const code = await runIndexNow({
      mode: "changed",
      marker: {
        read: async () => null,
        write: async () => {
          writes += 1;
        },
      },
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        return new Response("no", { status: 400 });
      },
    });
    expect(code).toBe(1);
    expect(writes).toBe(0);
  });

  it("submits every sitemap URL when the marker store is unset", async () => {
    delete process.env[INDEXNOW_MARKER_FILE_ENV];
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/dated</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/blank</loc></url>
    </urlset>`;
    const lines: string[] = [];
    const posts: string[][] = [];
    const code = await runIndexNow({
      mode: "changed",
      log: (line) => lines.push(line),
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        const payload = JSON.parse(String(init?.body)) as { urlList: string[] };
        posts.push(payload.urlList);
        return new Response("", { status: 200 });
      },
    });
    expect(code).toBe(0);
    expect(posts).toEqual([["https://grid.vahaah.com/dated", "https://grid.vahaah.com/blank"]]);
    expect(lines).toEqual(["marker: none", "changed: 2 urls", "batch 1/1: 200 (2 urls)"]);
  });

  it("submits every URL when --all has no marker store", async () => {
    delete process.env[INDEXNOW_MARKER_FILE_ENV];
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/a</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
    </urlset>`;
    const lines: string[] = [];
    const posts: string[][] = [];
    const code = await runIndexNow({
      mode: "all",
      log: (line) => lines.push(line),
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        const payload = JSON.parse(String(init?.body)) as { urlList: string[] };
        posts.push(payload.urlList);
        return new Response("", { status: 200 });
      },
    });
    expect(code).toBe(0);
    expect(posts).toEqual([["https://grid.vahaah.com/a"]]);
    expect(lines).toEqual(["batch 1/1: 200 (1 urls)", "marker: none"]);
  });

  it("writes the file marker after the first changed run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "indexnow-file-"));
    const path = join(dir, "marker.json");
    process.env[INDEXNOW_MARKER_FILE_ENV] = path;
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/dated</loc><lastmod>2026-10-06T00:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/blank</loc></url>
    </urlset>`;
    const lines: string[] = [];
    try {
      const code = await runIndexNow({
        mode: "changed",
        log: (line) => lines.push(line),
        fetch: async (input) => {
          if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
          return new Response("", { status: 202 });
        },
      });
      expect(code).toBe(0);
      expect(lines[0]).toBe("marker: none");
      expect(readFileSync(path, "utf8")).toBe(
        '{"streams":{"https://grid.vahaah.com/sitemap.xml":"2026-10-06T00:00:00.000Z"}}\n',
      );
    } finally {
      delete process.env[INDEXNOW_MARKER_FILE_ENV];
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("submits every URL when the marker cannot be read", async () => {
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/a</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
    </urlset>`;
    let writes = 0;
    const lines: string[] = [];
    const code = await runIndexNow({
      mode: "changed",
      marker: {
        read: async () => {
          throw new Error("marker: invalid");
        },
        write: async () => {
          writes += 1;
        },
      },
      log: (line) => lines.push(line),
      fetch: async (input) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        return new Response("", { status: 200 });
      },
    });
    expect(code).toBe(0);
    expect(writes).toBe(1);
    expect(lines[0]).toBe("marker: error marker: invalid");
    expect(lines).toContain("changed: 1 urls");
  });

  it("keeps the Actions marker off Blob and Redis", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/indexnow-submit.yml"), "utf8");
    expect(workflow).not.toMatch(/BLOB_READ_WRITE_TOKEN|UPSTASH_REDIS|KV_REST_API|secrets\./);
    expect(workflow).toContain("INDEXNOW_MARKER_FILE: .indexnow/marker.json");
    expect(workflow).toContain("name: indexnow-marker");
    expect(workflow).toContain("github.token");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("npx tsx scripts/indexnow.ts --all");
    expect(workflow).toContain("if gh run download");
  });

  it("submits every URL in --all mode and advances the marker", async () => {
    const xml = `<urlset>
      <url><loc>https://grid.vahaah.com/old</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
      <url><loc>https://grid.vahaah.com/new</loc><lastmod>2026-10-05T00:00:00.000Z</lastmod></url>
    </urlset>`;
    let stored: { streams: Record<string, string> } | null = {
      streams: { "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z" },
    };
    const posts: string[][] = [];
    const code = await runIndexNow({
      mode: "all",
      marker: {
        read: async () => stored,
        write: async (marker) => {
          stored = marker;
        },
      },
      fetch: async (input, init) => {
        if (input === INDEXNOW_SITEMAP_URL) return new Response(xml, { status: 200 });
        const payload = JSON.parse(String(init?.body)) as { urlList: string[] };
        posts.push(payload.urlList);
        return new Response("", { status: 200 });
      },
    });
    expect(code).toBe(0);
    expect(posts).toEqual([["https://grid.vahaah.com/old", "https://grid.vahaah.com/new"]]);
    expect(stored).toEqual({
      streams: {
        "https://grid.vahaah.com/sitemap.xml": "2026-10-05T00:00:00.000Z",
        "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z",
      },
    });
  });

  it("parses the script flags", () => {
    expect(parseIndexNowArgs([])).toBe("changed");
    expect(parseIndexNowArgs(["--all"])).toBe("all");
    expect(() => parseIndexNowArgs(["--changed"])).toThrow(/usage/);
  });

  it("runs only as the tsx entrypoint", () => {
    const entry = resolve(process.cwd(), "scripts/indexnow.ts");
    expect(invokedDirectly(pathToFileURL(entry).href, entry)).toBe(true);
    expect(invokedDirectly(pathToFileURL(entry).href, undefined)).toBe(false);
    expect(invokedDirectly(pathToFileURL(entry).href, "/usr/bin/vitest")).toBe(false);
  });
});
