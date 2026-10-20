import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHIPPED_PAGE_ROUTES } from "@/lib/site-nav";
import { TOOL_TASKS, TOOLS_FILE, toolsFileSchema } from "@/lib/tools/schema";

const GRID_ORIGIN = "https://grid.vahaah.com";
const BANNED = [/\breal-time\b/i, /\bright now\b/i, /\blive\b/i];

export function checkToolsFile(dir: string, options: { required: boolean }): string[] {
  const path = join(dir, TOOLS_FILE);
  if (!existsSync(path)) {
    return options.required ? [`missing ${TOOLS_FILE}`] : [];
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [`${TOOLS_FILE}: invalid JSON`];
  }
  const parsed = toolsFileSchema.safeParse(json);
  if (!parsed.success) {
    return [`${TOOLS_FILE}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`];
  }
  const errors: string[] = [];
  const ids = new Set<string>();
  const tasks = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const shipped = new Set<string>(SHIPPED_PAGE_ROUTES);
  for (const tool of parsed.data.tools) {
    if (ids.has(tool.tool_id)) {
      errors.push(`${TOOLS_FILE}: duplicate ${tool.tool_id}`);
    }
    ids.add(tool.tool_id);
    tasks.add(tool.task);
    if (tool.last_verified > today) {
      errors.push(`${TOOLS_FILE}: ${tool.tool_id} was verified in the future`);
    }
    if (tool.geographic_coverage === "UK" || /\bUK\b/.test(tool.geographic_coverage)) {
      errors.push(`${TOOLS_FILE}: ${tool.tool_id} uses UK for a coverage label`);
    }
    const prose = `${tool.name} ${tool.purpose} ${tool.provider} ${tool.access} ${tool.cost ?? ""}`;
    for (const pattern of BANNED) {
      if (pattern.test(prose)) {
        errors.push(`${TOOLS_FILE}: ${tool.tool_id} uses a banned freshness word`);
      }
    }
    if (tool.url.startsWith(GRID_ORIGIN)) {
      const route = tool.url.slice(GRID_ORIGIN.length) || "/";
      if (!shipped.has(route)) {
        errors.push(`${TOOLS_FILE}: ${tool.tool_id} links to an unknown Grid route`);
      }
    }
  }
  for (const task of TOOL_TASKS) {
    if (!tasks.has(task)) {
      errors.push(`${TOOLS_FILE}: missing task ${task}`);
    }
  }
  if (!parsed.data.tools.some((tool) => tool.relation === "integrates")) {
    errors.push(`${TOOLS_FILE}: no Grid tool is marked`);
  }
  if (!parsed.data.tools.some((tool) => tool.relation === "links_out")) {
    errors.push(`${TOOLS_FILE}: no external service is listed`);
  }
  return errors;
}
