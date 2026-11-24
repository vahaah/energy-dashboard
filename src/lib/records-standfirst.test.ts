import { describe, expect, it } from "vitest";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import { recordsStandfirst } from "@/lib/records-standfirst";

describe("records standfirst", () => {
  it("names highest wind, renewable share, lowest carbon and days since coal", () => {
    const records = emptyRecordsWithDocumentedCoal(new Date("2026-11-24T12:00:00Z"));
    records.maxWind = { value: 22_400, timestampUtc: "2026-01-01T00:00:00.000Z", basis: "wind" };
    records.highestRenewableShare = { value: 72.4, timestampUtc: "2026-01-01T00:00:00.000Z", basis: "renewable" };
    records.lowestCarbon = { value: 14, timestampUtc: "2026-01-01T00:00:00.000Z", basis: "carbon" };
    const text = recordsStandfirst(records);
    expect(text).toContain("Highest wind");
    expect(text).toContain("highest renewable share");
    expect(text).toContain("lowest carbon");
    expect(text).toContain("days since coal");
    expect(text).toContain("22.4 GW");
    expect(text).toContain("72.4%");
    expect(text).toContain("14 gCO₂/kWh");
    expect(text).not.toContain("0 days");
  });
});
