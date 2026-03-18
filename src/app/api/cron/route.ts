import { NextResponse } from "next/server";
import { ingestRows } from "@/lib/tinybird";
import type {
  CarbonIntensityResponse,
  GenerationMixResponse,
  ElexonSystemPrice,
  ElexonDemand,
  ElexonGeneration,
  EIAPriceData,
} from "@/lib/types";

/**
 * GET /api/cron
 *
 * Called hourly by Vercel Cron. Fetches data from:
 *   1. Carbon Intensity API  — carbon intensity + generation mix %
 *   2. Elexon BMRS           — system prices, demand, generation by fuel
 *   3. EIA (US Gov)          — Brent, WTI, Henry Hub gas (daily, updates on weekdays)
 *
 * Pushes to Tinybird data sources: energy_snapshots, commodity_prices.
 */

export const maxDuration = 30; // Vercel function timeout (seconds)
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ── Verify cron secret ──────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Round to start of hour for dedup (ReplacingMergeTree key)
  const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
  const timestampStr = timestamp.toISOString().replace("T", " ").slice(0, 19);

  const errors: string[] = [];

  // ── 1. Carbon Intensity + Generation Mix ────────────────
  let carbonIntensity = 0;
  let carbonForecast = 0;
  let carbonIndex = "unknown";
  const genPct: Record<string, number> = {};

  try {
    const [intensityRes, genRes] = await Promise.all([
      fetch("https://api.carbonintensity.org.uk/intensity"),
      fetch("https://api.carbonintensity.org.uk/generation"),
    ]);

    if (intensityRes.ok) {
      const intensity: CarbonIntensityResponse = await intensityRes.json();
      const d = intensity.data[0];
      carbonIntensity = d.intensity.actual ?? d.intensity.forecast;
      carbonForecast = d.intensity.forecast;
      carbonIndex = d.intensity.index;
    }

    if (genRes.ok) {
      const gen: GenerationMixResponse = await genRes.json();
      for (const item of gen.data.generationmix) {
        genPct[item.fuel] = item.perc;
      }
    }
  } catch (e) {
    errors.push(`Carbon Intensity API: ${e}`);
  }

  // ── 2. Elexon — System Price, Demand, Generation by Fuel ─
  let priceGbpMwh = 0;
  let demandMw = 0;
  const genMw: Record<string, number> = {};

  const today = now.toISOString().slice(0, 10);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString().replace(".000", "");
  const nowIso = now.toISOString().replace(".000", "");

  try {
    // Latest settlement period (period 1 of today as fallback, but try to find the current one)
    const currentPeriod = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 30) + 1;

    const [priceRes, demandRes, genRes] = await Promise.all([
      fetch(`https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${today}/${Math.max(1, currentPeriod - 1)}`),
      fetch(`https://data.elexon.co.uk/bmrs/api/v1/datasets/ITSDO?publishDateTimeFrom=${oneHourAgo}&publishDateTimeTo=${nowIso}`),
      fetch(`https://data.elexon.co.uk/bmrs/api/v1/datasets/AGPT?publishDateTimeFrom=${oneHourAgo}&publishDateTimeTo=${nowIso}`),
    ]);

    if (priceRes.ok) {
      const priceData: { data: ElexonSystemPrice[] } = await priceRes.json();
      if (priceData.data.length > 0) {
        priceGbpMwh = priceData.data[0].systemBuyPrice;
      }
    }

    if (demandRes.ok) {
      const demandData: { data: ElexonDemand[] } = await demandRes.json();
      if (demandData.data.length > 0) {
        // Most recent demand reading
        demandMw = demandData.data[0].demand;
      }
    }

    if (genRes.ok) {
      const genData: { data: ElexonGeneration[] } = await genRes.json();
      // Get latest settlement period data, aggregate by fuel type
      const latestPeriod = genData.data.reduce((max, d) => Math.max(max, d.settlementPeriod), 0);
      const latestGen = genData.data.filter((d) => d.settlementPeriod === latestPeriod);
      for (const item of latestGen) {
        const fuel = mapElexonFuel(item.psrType);
        genMw[fuel] = (genMw[fuel] ?? 0) + item.quantity;
      }
    }
  } catch (e) {
    errors.push(`Elexon BMRS: ${e}`);
  }

  // ── Push energy snapshot ────────────────────────────────
  try {
    await ingestRows("energy_snapshots", [
      {
        timestamp: timestampStr,
        carbon_intensity: carbonIntensity,
        carbon_forecast: carbonForecast,
        carbon_index: carbonIndex,
        demand_mw: demandMw,
        price_gbp_mwh: priceGbpMwh,
        gen_gas_pct: genPct["gas"] ?? 0,
        gen_coal_pct: genPct["coal"] ?? 0,
        gen_nuclear_pct: genPct["nuclear"] ?? 0,
        gen_wind_pct: genPct["wind"] ?? 0,
        gen_solar_pct: genPct["solar"] ?? 0,
        gen_hydro_pct: genPct["hydro"] ?? 0,
        gen_biomass_pct: genPct["biomass"] ?? 0,
        gen_imports_pct: genPct["imports"] ?? 0,
        gen_other_pct: genPct["other"] ?? 0,
        gen_gas_mw: genMw["gas"] ?? 0,
        gen_coal_mw: genMw["coal"] ?? 0,
        gen_nuclear_mw: genMw["nuclear"] ?? 0,
        gen_wind_mw: genMw["wind"] ?? 0,
        gen_solar_mw: genMw["solar"] ?? 0,
        gen_hydro_mw: genMw["hydro"] ?? 0,
        gen_biomass_mw: genMw["biomass"] ?? 0,
        gen_other_mw: genMw["other"] ?? 0,
      },
    ]);
  } catch (e) {
    errors.push(`Tinybird ingest (energy_snapshots): ${e}`);
  }

  // ── 3 & 4. FUELINST + NESO — parallel fetch ────────────
  const fuelInstFrom = new Date(now.getTime() - 65 * 60 * 1000).toISOString();
  const fuelInstTo = now.toISOString();
  const nesoToday = now.toISOString().slice(0, 10);

  const [fuelInstResult, nesoResult] = await Promise.allSettled([
    fetch(
      `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${fuelInstFrom}&publishDateTimeTo=${fuelInstTo}`
    ),
    fetch(
      `https://api.neso.energy/api/3/action/datastore_search_sql?sql=SELECT * FROM "177f6fa4-ae49-4182-81ea-0c6b35f26ca6" WHERE "SETTLEMENT_DATE"='${nesoToday}' AND "FORECAST_ACTUAL_INDICATOR"='A' ORDER BY "SETTLEMENT_PERIOD" DESC LIMIT 2`
    ),
  ]);

  // Process FUELINST
  if (fuelInstResult.status === "fulfilled" && fuelInstResult.value.ok) {
    try {
      const fuelInstData: Array<{
        startTime: string;
        fuelType: string;
        generation: number;
      }> = await fuelInstResult.value.json();

      if (fuelInstData.length > 0) {
        const genRows = fuelInstData.map((row) => ({
          timestamp: row.startTime.replace("T", " ").replace("Z", "").slice(0, 19),
          fuel_type: row.fuelType.toLowerCase(),
          generation_mw: row.generation,
          source: "fuelinst",
        }));
        await ingestRows("generation_5min", genRows);
      }
    } catch (e) {
      errors.push(`FUELINST: ${e}`);
    }
  } else if (fuelInstResult.status === "rejected") {
    errors.push(`FUELINST: ${fuelInstResult.reason}`);
  }

  // Process NESO
  if (nesoResult.status === "fulfilled" && nesoResult.value.ok) {
    try {
      const nesoJson = await nesoResult.value.json();
      const records: Array<Record<string, string>> = nesoJson?.result?.records ?? [];

      if (records.length > 0) {
        const rec = records[0];
        const settlementPeriod = parseInt(rec.SETTLEMENT_PERIOD ?? "0");
        const hours = Math.floor((settlementPeriod - 1) / 2);
        const mins = ((settlementPeriod - 1) % 2) * 30;
        const nesoTimestamp = `${nesoToday} ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;

        const nesoRows: Record<string, unknown>[] = [];

        const embeddedSolar = parseFloat(rec.EMBEDDED_SOLAR_GENERATION ?? "0");
        if (embeddedSolar > 0) {
          nesoRows.push({
            timestamp: nesoTimestamp,
            fuel_type: "embedded_solar",
            generation_mw: embeddedSolar,
            source: "neso",
          });
        }

        const embeddedWind = parseFloat(rec.EMBEDDED_WIND_GENERATION ?? "0");
        if (embeddedWind > 0) {
          nesoRows.push({
            timestamp: nesoTimestamp,
            fuel_type: "embedded_wind",
            generation_mw: embeddedWind,
            source: "neso",
          });
        }

        if (nesoRows.length > 0) {
          await ingestRows("generation_5min", nesoRows);
        }
      }
    } catch (e) {
      errors.push(`NESO embedded: ${e}`);
    }
  } else if (nesoResult.status === "rejected") {
    errors.push(`NESO embedded: ${nesoResult.reason}`);
  }

  // ── 5. EIA — Oil & Gas Prices ───────────────────────────
  const eiaKey = process.env.EIA_API_KEY ?? "DEMO_KEY";
  const commodities = [
    { series: "PET.RBRTE.D", commodity: "brent_crude", unit: "$/BBL" },
    { series: "PET.RWTC.D", commodity: "wti_crude", unit: "$/BBL" },
    { series: "NG.RNGWHHD.D", commodity: "henry_hub_gas", unit: "$/MMBTU" },
  ];

  try {
    const priceRows: Array<Record<string, unknown>> = [];

    for (const { series, commodity, unit } of commodities) {
      const res = await fetch(
        `https://api.eia.gov/v2/seriesid/${series}?api_key=${eiaKey}`
      );
      if (res.ok) {
        const json = await res.json();
        const data: EIAPriceData[] = json.response?.data ?? [];
        // Take the latest data point
        if (data.length > 0 && data[0].value != null) {
          priceRows.push({
            date: data[0].period,
            commodity,
            price: data[0].value,
            currency: "USD",
            unit,
          });
        }
      }
    }

    if (priceRows.length > 0) {
      await ingestRows("commodity_prices", priceRows);
    }
  } catch (e) {
    errors.push(`EIA / Tinybird ingest (commodity_prices): ${e}`);
  }

  return NextResponse.json({
    ok: true,
    timestamp: timestampStr,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ─── Helpers ────────────────────────────────────────────────

function mapElexonFuel(psrType: string): string {
  const map: Record<string, string> = {
    "Fossil Gas": "gas",
    "Fossil Hard coal": "coal",
    "Fossil Oil": "oil",
    Nuclear: "nuclear",
    Wind: "wind",
    "Wind Onshore": "wind",
    "Wind Offshore": "wind",
    Solar: "solar",
    "Hydro Pumped Storage": "hydro",
    "Hydro Run-of-river and poundage": "hydro",
    Biomass: "biomass",
    "Other": "other",
  };
  return map[psrType] ?? "other";
}
