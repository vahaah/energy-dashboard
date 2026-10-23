import { describe, expect, it } from "vitest";
import { formatEnergy, formatEnergyText, formatGrouped, THIN_SPACE } from "@/lib/format/quantity";

describe("formatEnergy", () => {
  it("groups thousands and switches to GW at 1,000 MW", () => {
    expect(formatEnergy(1102)).toEqual({ value: "1.1", unit: "GW" });
    expect(formatEnergy(57440.4)).toEqual({ value: "57.4", unit: "GW" });
    expect(formatEnergy(689908.6)).toEqual({ value: "689.9", unit: "GW" });
    expect(formatEnergy(7846.3)).toEqual({ value: "7.8", unit: "GW" });
    expect(formatEnergy(999.4)).toEqual({ value: "999", unit: "MW" });
    expect(formatEnergy(6.1)).toEqual({ value: "6.1", unit: "MW" });
    expect(formatEnergy(0)).toEqual({ value: "0", unit: "MW" });
    expect(formatEnergy(-1500)).toEqual({ value: "-1.5", unit: "GW" });
  });

  it("puts a thin space before the unit", () => {
    expect(formatEnergyText(30.3)).toBe(`30.3${THIN_SPACE}MW`);
    expect(formatEnergyText(30300)).toBe(`30.3${THIN_SPACE}GW`);
    expect(formatGrouped(10126, 0)).toBe("10,126");
  });
});
