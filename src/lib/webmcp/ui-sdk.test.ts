import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { agentTools, registerTools } from "@ui-sdk/react/agent";
import { UI_SDK_REGISTER_TOOLS_SUPPORTS_CUSTOM_TOOLS } from "@/lib/webmcp/ui-sdk";

describe("UI SDK WebMCP helper", () => {
  it("does not accept custom tools, so Grid does not register act", () => {
    expect(UI_SDK_REGISTER_TOOLS_SUPPORTS_CUSTOM_TOOLS).toBe(false);
    expect(typeof registerTools).toBe("function");
    expect(agentTools.map((tool) => tool.name).sort()).toEqual(["act", "query", "snapshot"]);
    const source = readFileSync(resolve(process.cwd(), "src/lib/webmcp/register.ts"), "utf8");
    const island = readFileSync(resolve(process.cwd(), "src/app/webmcp-registrar.tsx"), "utf8");
    expect(source).not.toContain("registerTools");
    expect(source).not.toContain("createAgent");
    expect(island).not.toContain("registerTools");
    const manifest = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
    expect(manifest).toContain("@ui-sdk/react");
    expect(manifest).toContain("@ui-sdk/core");
    expect(manifest).toContain("@w3c/webmcp-polyfill");
  });
});
