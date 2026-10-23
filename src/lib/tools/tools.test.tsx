import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolsBoard } from "@/components/tools/tools-board";
import { checkToolsFile } from "@/lib/tools/check";
import { TOOLS_H1, TOOLS_STANDFIRST, TOOLS_TITLE, toolTaskLabel } from "@/lib/tools/copy";
import { loadToolsFile } from "@/lib/tools/load";
import { TOOL_TASKS } from "@/lib/tools/schema";

describe("tools catalogue", () => {
  it("validates the curated file and groups every task", () => {
    const dir = join(process.cwd(), "data", "catalogue");
    expect(checkToolsFile(dir, { required: true })).toEqual([]);
    const file = loadToolsFile();
    expect(file.report_broken_link.mailto.startsWith("mailto:")).toBe(true);
    expect(file.report_broken_link.github_issue).toContain("https://github.com/vahaah/energy-dashboard/issues/new");
    const tasks = new Set(file.tools.map((tool) => tool.task));
    expect([...tasks]).toEqual([...TOOL_TASKS]);
    expect(file.tools.some((tool) => tool.relation === "integrates")).toBe(true);
    expect(file.tools.some((tool) => tool.relation === "links_out")).toBe(true);
    for (const tool of file.tools) {
      expect(tool.url.startsWith("https://")).toBe(true);
      expect(tool.cost === undefined || tool.cost === "Free").toBe(true);
      expect(tool.geographic_coverage).not.toMatch(/\bUK\b/);
      expect(`${tool.name} ${tool.purpose}`).not.toMatch(/\breal-time\b|\bright now\b|\blive\b/i);
    }
    expect(TOOLS_TITLE).toBe("GB energy tools and official services | Grid");
    expect(TOOLS_H1).toBe("Where do I go to do this?");
    expect(TOOLS_STANDFIRST).toBe(
      "Official and useful services, grouped by task. Grid links to these services. Ones marked Runs on Grid are Grid pages.",
    );
    const page = readFileSync(resolve(process.cwd(), "src/app/tools/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 86400");
    expect(page).not.toContain("<form");
    expect(page).not.toContain("queryPipe");
  });

  it("renders tasks in catalogue order with a report link and no form", () => {
    const html = renderToStaticMarkup(<ToolsBoard file={loadToolsFile()} />);
    let previous = -1;
    for (const task of TOOL_TASKS) {
      const index = html.indexOf(toolTaskLabel(task));
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(html).toContain("Runs on Grid");
    expect(html).toContain("mailto:");
    expect(html).toContain("https://github.com/vahaah/energy-dashboard/issues/new");
    expect(html).not.toContain("<form");
  });
});
