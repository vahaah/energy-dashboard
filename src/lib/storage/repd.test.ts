import { describe, expect, it } from "vitest";
import { parseRepdStorage } from "@/lib/storage/repd";
import { storageRecordId } from "@/lib/storage/records";

const HEADER = [
  "Ref ID",
  "Site Name",
  "Technology Type",
  "Storage Co-location REPD Ref ID",
  "Installed Capacity (MWelec)",
  "Development Status (short)",
  "Country",
].join(",");

describe("REPD storage rows", () => {
  it("keeps GB batteries and pumped storage, including projects that are not operating", () => {
    const records = parseRepdStorage(
      [
        HEADER,
        "1,Operating battery,Battery,,12.5,Operational,England",
        "2,Kilroot,Battery,,10,Operational,Northern Ireland",
        "3,Proposed,Battery,4,7,Awaiting Construction,Scotland",
        "4,Linked,Battery,3,7,Awaiting Construction,Scotland",
        "5,Self,Battery,5,1,Operational,Wales",
        "6,Solar,Solar Photovoltaics,1,5,Operational,England",
        "7,Flywheel,Flywheels,,1,Operational,England",
        "8,Dinorwig,Pumped Storage Hydroelectricity,,1728,Operational,Wales",
        "9,Coire Glas,Pumped Storage Hydroelectricity,,1500,Awaiting Construction,Scotland",
      ].join("\n"),
    );
    expect(records.map((record) => record.external_ref)).toEqual(["1", "3", "4", "5", "8", "9"]);
    expect(records.find((record) => record.external_ref === "1")).toMatchObject({
      record_id: storageRecordId("1"),
      technology: "battery",
      status: "operational",
      rated_mw: 12.5,
      energy_mwh: null,
      colocated_ref: null,
      country: "England",
    });
    expect(records.find((record) => record.external_ref === "3")?.status).toBe("not_operating");
    expect(records.find((record) => record.external_ref === "3")?.colocated_ref).toBe("4");
    expect(records.find((record) => record.external_ref === "5")?.colocated_ref).toBeNull();
    expect(records.find((record) => record.external_ref === "9")?.technology).toBe("pumped_storage");
    expect(records.some((record) => record.name === "Kilroot")).toBe(false);
  });
});
