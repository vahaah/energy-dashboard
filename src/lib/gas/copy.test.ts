import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAS_ATTRIBUTION,
  GAS_COVERAGE_HREF,
  GAS_LDZ_NOTE,
  GAS_SAP_DEFINITION,
  GAS_SYSTEM_H1,
  GAS_SYSTEM_STANDFIRST,
  GAS_SYSTEM_TITLE,
  bannedGasPhrases,
} from "@/lib/gas/copy";
import { NATIONAL_GAS_ATTRIBUTION } from "@/lib/attribution";

const FILES = [
  "src/lib/gas/view.ts",
  "src/lib/gas/page-model.ts",
  "src/components/gas/gas-board.tsx",
  "src/components/gas/gas-series-chart.tsx",
  "src/app/gas/page.tsx",
];

describe("gas page copy", () => {
  it("uses the National Gas attribution and the required sentences", () => {
    expect(GAS_ATTRIBUTION).toBe("Data sourced from the National Gas Transmission Data Portal.");
    expect(GAS_ATTRIBUTION).toBe(NATIONAL_GAS_ATTRIBUTION);
    expect(GAS_COVERAGE_HREF).toBe("/data-health#nts");
    expect(GAS_SYSTEM_TITLE).toBe("GB gas supply, demand and linepack by gas day | Grid");
    expect(GAS_SYSTEM_H1).toBe("Where is Britain's gas coming from, and where is it going?");
    expect(GAS_SYSTEM_STANDFIRST).toContain("Updated hourly.");
    expect(GAS_SAP_DEFINITION).toBe("System Average Price, a wholesale benchmark. It is not a household tariff.");
    expect(GAS_LDZ_NOTE).not.toMatch(/\blive\b/i);
  });

  it("rejects banned wording outside the LDZ note", () => {
    const text = FILES.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    expect(GAS_SYSTEM_STANDFIRST).toContain("Updated hourly");
    expect(text).toContain("GAS_SYSTEM_STANDFIRST");
    expect(bannedGasPhrases(text)).toEqual([]);
  });
});
