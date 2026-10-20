import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS_FILE, toolsFileSchema, type ToolsFile } from "@/lib/tools/schema";

export function loadToolsFile(cwd = process.cwd()): ToolsFile {
  return toolsFileSchema.parse(JSON.parse(readFileSync(join(cwd, "data", "catalogue", TOOLS_FILE), "utf8")));
}
