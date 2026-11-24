import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

type WebMcpTool = {
  name: string;
  annotations: { readOnlyHint?: boolean } | null;
};

type WebMcpContext = {
  getTools: () => Promise<WebMcpTool[]>;
  executeTool: (tool: WebMcpTool, input?: object) => Promise<string>;
};

declare global {
  interface Document {
    modelContext?: WebMcpContext;
  }
}

const polyfillPath = resolve(process.cwd(), "node_modules/@w3c/webmcp-polyfill/dist/polyfill.js");

const TOOL_NAMES = [
  "get_balancing_summary",
  "get_carbon_intensity",
  "get_data_health",
  "get_live_mix",
  "get_page_dataset",
  "get_price_cap",
  "get_wholesale_price",
  "search_grid",
];

test("lists and calls the read-only tools with the polyfill", async ({ page }) => {
  const dated: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("date=")) {
      dated.push(request.url());
    }
  });
  await page.addInitScript({ path: polyfillPath });
  await page.goto("/");
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const context = document.modelContext;
      if (!context) {
        return [];
      }
      const tools = await context.getTools();
      return tools.map((tool) => tool.name);
    });
  }).toEqual(TOOL_NAMES);

  const called = await page.evaluate(async () => {
    const context = document.modelContext;
    if (!context) {
      throw new Error("document.modelContext is missing");
    }
    const tools = await context.getTools();
    if (tools.some((tool) => tool.name === "act" || tool.name === "snapshot" || tool.name === "query")) {
      throw new Error("UI SDK act tools are registered");
    }
    if (tools.some((tool) => tool.annotations?.readOnlyHint !== true)) {
      throw new Error("A tool is missing readOnlyHint");
    }
    const priceCap = tools.find((tool) => tool.name === "get_price_cap");
    const search = tools.find((tool) => tool.name === "search_grid");
    const dataset = tools.find((tool) => tool.name === "get_page_dataset");
    if (!priceCap || !search || !dataset) {
      throw new Error("A Grid tool is missing");
    }
    const cap = JSON.parse(await context.executeTool(priceCap, {})) as {
      readOnly: boolean;
      data: { current: { typicalDualFuelDirectDebitGbp: number }; january2027: null };
      sources: { attribution: string }[];
      retrievedAt: string;
    };
    const found = JSON.parse(await context.executeTool(search, { query: "price cap" })) as {
      data: { hits: { href: string }[] } | null;
    };
    const pageData = JSON.parse(await context.executeTool(dataset, {})) as {
      data: { path: string; sources: { attribution: string }[] } | null;
    };
    return { cap, found, pageData };
  });

  expect(called.cap.readOnly).toBe(true);
  expect(called.cap.data.current.typicalDualFuelDirectDebitGbp).toBe(1723);
  expect(called.cap.data.january2027).toBeNull();
  expect(called.cap.sources.some((source) => source.attribution.includes("Ofgem"))).toBe(true);
  expect(called.cap.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(called.found.data?.hits.some((hit) => hit.href === "/explained/price-cap")).toBe(true);
  expect(called.pageData.data?.path).toBe("/");
  expect(called.pageData.data?.sources.length).toBeGreaterThan(0);
  expect(dated).toEqual([]);
});

test("does not download the tool module without document.modelContext", async ({ page }) => {
  const toolScripts: string[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/_next/static/")) {
      return;
    }
    const body = await response.text().catch(() => "");
    if (body.includes("get_live_mix") || body.includes("@w3c/webmcp-polyfill")) {
      toolScripts.push(url);
    }
  });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(toolScripts).toEqual([]);
});
