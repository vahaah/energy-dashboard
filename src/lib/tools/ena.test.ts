import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_METER_NUMBERS } from "@/lib/directory/copy";
import { DESCRIPTION_MAX_CHARS, pageDescriptionLength } from "@/lib/site";
import { TOOLS_DESCRIPTION } from "@/lib/tools/copy";
import { ENA_SEARCH_TOOLS } from "@/lib/tools/ena";

describe("ENA search tools", () => {
  it("keeps the tools description within the house limit and lists the official pages", () => {
    expect(pageDescriptionLength(TOOLS_DESCRIPTION)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(pageDescriptionLength(TOOLS_DESCRIPTION)).toBeGreaterThanOrEqual(120);
    expect(TOOLS_DESCRIPTION).toContain("ENA search tools");
    expect(ENA_SEARCH_TOOLS.map((tool) => tool.href)).toEqual([
      "https://www.energynetworks.org/customers/find-my-network-operator",
      "https://www.energynetworks.org/customers/power-cut",
      "https://www.energynetworks.org/customers/",
    ]);
    const page = readFileSync(resolve(process.cwd(), "src/app/tools/page.tsx"), "utf8");
    expect(page).toContain("Energy Networks Association search tools");
    expect(page).toContain("NO_METER_NUMBERS");
    expect(NO_METER_NUMBERS).toBe("Grid does not publish MPAN, MPRN or meter serial numbers.");
  });
});
