import { describe, expect, it } from "vitest";
import type { Generation5min } from "@/lib/types";
import { buildStorageDocument } from "@/lib/storage/page-model";
import { storageOperations } from "@/lib/storage/operations";
import { buildStorageInventory, type StorageInput } from "@/lib/storage/inventory";
import { STORAGE_BATTERIES_UNREPORTED, STORAGE_SIGN } from "@/lib/storage/copy";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function sample(fuel: string, mw: number, timestamp = "2026-10-10 11:00:00"): Generation5min {
  return { timestamp, fuel_type: fuel, generation_mw: mw, source: "fuelinst" };
}

function emptyInventory() {
  const row: StorageInput = {
    id: "sto_op",
    name: "Battery",
    technology: "battery",
    status: "operational",
    country: "England",
    ratedMw: 10,
    energyMwh: null,
    externalRef: "1",
    colocatedRef: null,
    assetId: null,
    counts: true,
  };
  return buildStorageInventory([row]);
}

describe("FUELINST storage population", () => {
  it("shows discharge and charging separately and does not treat a negative sample as discharge", () => {
    const operations = storageOperations(
      [sample("ps", 400), sample("battery", -80), sample("ccgt", 1000)],
      NOW,
    );
    expect(operations).toMatchObject({
      available: true,
      pumped: { dischargeMw: 400, chargeMw: 0 },
      battery: { dischargeMw: 0, chargeMw: 80 },
    });
    const document = buildStorageDocument(emptyInventory(), operations, 2026);
    expect(STORAGE_SIGN).toBe("A positive FUELINST sample is discharge. A negative sample is charging.");
    expect(document.monitored.available).toBe(true);
    if (!document.monitored.available) {
      return;
    }
    expect(document.monitored.discharge.totalLabel).toBe("400.0");
    expect(document.monitored.charge.totalLabel).toBe("80.0");
    expect(document.monitored.discharge.shares?.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
    expect(document.monitored.discharge.rows.map((row) => row.mwLabel)).toEqual(["400.0", "0.0"]);
    expect(document.monitored.charge.rows.map((row) => row.mwLabel)).toEqual(["0.0", "80.0"]);
  });

  it("leaves an absent fuel out of the total", () => {
    const operations = storageOperations([sample("pumped", -200)], NOW);
    expect(operations).toMatchObject({
      available: true,
      pumped: { dischargeMw: 0, chargeMw: 200 },
      battery: null,
    });
    const document = buildStorageDocument(emptyInventory(), operations, 2026);
    expect(document.monitored.available).toBe(true);
    if (!document.monitored.available) {
      return;
    }
    expect(document.monitored.discharge.totalLabel).toBeNull();
    expect(document.monitored.charge.totalLabel).toBeNull();
    expect(document.monitored.charge.missing).toEqual([]);
    expect(document.monitored.charge.unreported).toEqual([STORAGE_BATTERIES_UNREPORTED]);
    expect(document.monitored.charge.rows.map((row) => row.mwLabel)).toEqual(["200.0"]);
  });

  it("is not yet available when the envelope has no storage fuel", () => {
    expect(storageOperations(null, NOW)).toEqual({ available: false });
    expect(storageOperations([sample("wind", 100)], NOW)).toEqual({ available: false });
  });
});
