import { NextResponse } from "next/server";
import { ingestRows } from "@/lib/tinybird";

/**
 * GET /api/cron-prices
 *
 * Called every 6 hours by Vercel Cron. Fetches commodity prices from:
 *   1. OilPriceAPI  — EU TTF gas, LNG Asia JKM (real-time)
 *   2. FRED         — monthly TTF + LNG (deep history supplement)
 *
 * Pushes to Tinybird data source: commodity_prices.
 */

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  const priceRows: Array<Record<string, unknown>> = [];
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. OilPriceAPI — TTF + LNG (parallel) ─────────────────
  const oilApiKey = process.env.OIL_PRICE_API_KEY;
  if (oilApiKey) {
    const oilCommodities = [
      { code: "DUTCH_TTF_NATURAL_GAS_USD", commodity: "eu_natural_gas", unit: "$/MMBTU" },
      { code: "JKM_LNG_USD", commodity: "lng_asia", unit: "$/MMBTU" },
    ];

    const results = await Promise.allSettled(
      oilCommodities.map(async ({ code, commodity, unit }) => {
        const res = await fetch(
          `https://api.oilpriceapi.com/v1/prices/latest?by_code=${code}`,
          { headers: { Authorization: `Token ${oilApiKey}` } }
        );
        if (res.ok) {
          const json = await res.json();
          const price = json?.data?.price;
          if (price != null) {
            return { date: today, commodity, price, currency: "USD", unit };
          }
        }
        return null;
      })
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled" && result.value) {
        priceRows.push(result.value);
      } else if (result.status === "rejected") {
        errors.push(`OilPriceAPI (${oilCommodities[i].code}): ${result.reason}`);
      }
    }
  }

  // ── 2. FRED — Monthly TTF + LNG (parallel, supplements OilPriceAPI) ─
  const fredKey = process.env.FRED_API_KEY;
  if (fredKey) {
    const fredSeries = [
      { id: "PNGASEUUSDM", commodity: "eu_natural_gas", unit: "$/MMBTU" },
      { id: "PNGASJPUSDM", commodity: "lng_asia", unit: "$/MMBTU" },
    ];

    const results = await Promise.allSettled(
      fredSeries.map(async ({ id, commodity, unit }) => {
        const res = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`
        );
        if (res.ok) {
          const json = await res.json();
          const obs = json?.observations?.[0];
          if (obs && obs.value !== "." && obs.value != null) {
            return { date: obs.date, commodity, price: parseFloat(obs.value), currency: "USD", unit };
          }
        }
        return null;
      })
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled" && result.value) {
        // Only use FRED if OilPriceAPI didn't already provide this commodity
        const val = result.value;
        const alreadyHas = priceRows.some((r) => r.commodity === val.commodity);
        if (!alreadyHas) {
          priceRows.push(val);
        }
      } else if (result.status === "rejected") {
        errors.push(`FRED (${fredSeries[i].id}): ${result.reason}`);
      }
    }
  }

  // ── Ingest ──────────────────────────────────────────────────
  try {
    if (priceRows.length > 0) {
      await ingestRows("commodity_prices", priceRows);
    }
  } catch (e) {
    errors.push(`Tinybird ingest (commodity_prices): ${e}`);
  }

  return NextResponse.json({
    ok: true,
    ingested: priceRows.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
