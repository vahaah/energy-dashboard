import { describe, expect, it } from "vitest";
import { parseInstantaneousFlow } from "@/lib/ingest/national-gas/instantaneous";

const PUBLISHED = "2026-10-22T06:47:24.000Z";
const AT = "2026-10-22T06:46:00.000Z";

function detail(name: string, flowRate: number, quality = "") {
  return {
    siteName: name,
    siteGasDetail: [{ applicableAt: "2026-10-22T07:46:00+01:00", flowRate, qualityIndicator: quality }],
  };
}

describe("instantaneous national gas feed", () => {
  it("keeps demand, linepack and storage sites and drops LNG and unknown names", () => {
    const text = JSON.stringify({
      publishedTime: "2026-10-22T07:47:24+01:00",
      currentGasDay: "2026-10-22",
      instantaneousFlow: [
        {
          description: "Demand by category",
          sites: [
            detail("Industrial Demand Flow", 2.06666),
            detail("Interconnector Export Demand Flow", 39.08287),
            detail("LDZ Offtake Flow", 134.11892, "E"),
            detail("Power Station Demand Flow", 20.28498, "E"),
            detail("Storage Demand Flow", 1.123),
          ],
        },
        { description: "Total Demand", sites: [detail("NTS Demand Flow", 197.40028, "E")] },
        { description: "Actual linepack", sites: [detail("NTS Actual Linepack", 343.21306)] },
        {
          description: "Supply from entry points",
          sites: [
            detail("ALDBROUGH", 15.54475),
            detail("STUBLACH", 0),
            detail("MILFORD HAVEN - DRAGON", 4.9),
            detail("GRAIN NTS 1", 1),
            detail("SOUTH HOOK", 2),
            detail("NOT A STORAGE SITE", 9),
          ],
        },
      ],
    });
    const samples = parseInstantaneousFlow(text);
    const demand = samples.find((sample) => sample.role === "demand");
    expect(demand).toMatchObject({
      name: "NTS Demand Flow",
      value: 197.40028,
      unit: "mscm/d",
      applicable_at: AT,
      published_at: PUBLISHED,
    });
    expect(samples.filter((sample) => sample.role === "demand_part").map((sample) => sample.name).sort()).toEqual([
      "Industrial Demand Flow",
      "Interconnector Export Demand Flow",
      "LDZ Offtake Flow",
      "Power Station Demand Flow",
      "Storage Demand Flow",
    ]);
    expect(samples.find((sample) => sample.role === "linepack")).toMatchObject({
      name: "NTS Actual Linepack",
      value: 343.21306,
      unit: "mscm",
    });
    const withdrawal = samples.filter((sample) => sample.role === "storage_withdrawal");
    expect(withdrawal.map((sample) => sample.name).sort()).toEqual(["ALDBROUGH", "STUBLACH"]);
    expect(withdrawal.find((sample) => sample.name === "STUBLACH")?.value).toBe(0);
    expect(samples.some((sample) => sample.name.includes("DRAGON") || sample.name.includes("GRAIN") || sample.name.includes("SOUTH"))).toBe(
      false,
    );
    expect(parseInstantaneousFlow("not json")).toEqual([]);
    expect(parseInstantaneousFlow("{}")).toEqual([]);
  });
});