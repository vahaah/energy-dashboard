import { z } from "zod";
import { CATALOGUE_SCHEMA_VERSION } from "@/lib/catalogue/schema";

export const TOOL_TASKS = [
  "understand_a_bill",
  "find_a_network_operator",
  "find_an_official_outage_service",
  "investigate_a_connection",
  "find_a_code",
  "access_a_dataset",
  "explore_planning_or_network_evidence",
] as const;

export const TOOL_SECTORS = ["electricity", "gas", "oil", "heat", "whole_energy", "multi"] as const;

export const TOOL_RELATIONS = ["integrates", "links_out"] as const;

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "expected a real date");

const text = z.string().refine((value) => value.trim().length > 0, "required");

export const toolSchema = z
  .object({
    tool_id: z.string().regex(/^tool_[a-z0-9_]+$/),
    name: text,
    provider: text,
    purpose: text,
    sector: z.enum(TOOL_SECTORS),
    geographic_coverage: text,
    url: z.string().regex(/^https:\/\/\S+$/),
    access: text,
    cost: text.optional(),
    last_verified: day,
    relation: z.enum(TOOL_RELATIONS),
    task: z.enum(TOOL_TASKS),
  })
  .strict();

export const toolsFileSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    report_broken_link: z
      .object({
        mailto: z.string().regex(/^mailto:[^\s]+$/),
        github_issue: z.string().regex(/^https:\/\/github\.com\/vahaah\/energy-dashboard\/issues\/new(?:\?\S+)?$/),
      })
      .strict(),
    tools: z.array(toolSchema).min(1),
  })
  .strict();

export type ToolTask = (typeof TOOL_TASKS)[number];
export type ToolSector = (typeof TOOL_SECTORS)[number];
export type ToolRelation = (typeof TOOL_RELATIONS)[number];
export type ToolRecord = z.infer<typeof toolSchema>;
export type ToolsFile = z.infer<typeof toolsFileSchema>;

export const TOOLS_FILE = "tools.json";
