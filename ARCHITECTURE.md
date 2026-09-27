# Energy Dashboard — Architecture

## Data Sources

| Source | API | Frequency | Auth | Data |
|--------|-----|-----------|------|------|
| Carbon Intensity API | `api.carbonintensity.org.uk` | Half-hourly | None | Carbon intensity (gCO2/kWh), generation mix % |
| Elexon BMRS | `data.elexon.co.uk` | Half-hourly | None | Imbalance / cash-out price (£/MWh), demand (MW), generation by fuel (MW) |
| NESO | `api.neso.energy` | Half-hourly | None | Embedded wind (UK settlement periods) |
| Sheffield Solar PV Live | `api.pvlive.uk` | 30-min | None | National GB solar including embedded |
| EIA (US Gov) | `api.eia.gov/v2` | Daily | `EIA_API_KEY` (required) | Brent crude, WTI crude ($/BBL), Henry Hub gas ($/MMBTU) |
| World Bank Pink Sheet | `worldbank.org` commodity-markets monthly xlsx | Monthly | None | EU natural gas and Japan LNG ($/MMBTU), CC BY 4.0 |
| National Gas | `data.nationalgas.com` | Daily (gas day) | None | GB System Average Price p/kWh (`gb_gas_sap`, PUBOB603) |

OilPriceAPI leftover TTF rows stay stored but unpublished. `/api/cron-prices` self-backfills EIA (400 days at 00:30 UTC, 30 days on other slots), World Bank Pink Sheet from 2025-01 on every run, and National Gas SAP (7 gas days). `scripts/backfill-commodities.ts` is optional. Optional `OIL_PRICE_API_KEY` / `FRED_API_KEY` values are ignored.

## Tinybird Data Sources (ClickHouse tables)

### Design Principles
1. **One wide row per snapshot** — not normalized. ClickHouse is columnar, so unused columns cost nothing. Wide rows avoid JOINs at query time.
2. **Settlement-period timestamp as the sorting key** — one row per UK half-hour (46/48/50 periods on clock-change days).
3. **`ReplacingMergeTree` plus query-time `FINAL` / `argMax`** — ingest is idempotent, but queries must force dedup before merge.
4. **Separate data sources for different cadences** — grid data (half-hourly) vs commodity prices (daily/monthly).
5. **Null, not zero, for missing metrics** — ClickHouse `avg()` skips nulls; the UI draws gaps.

### `energy_snapshots` — Half-hourly UK Grid Data
One row per UK settlement period. Combines Carbon Intensity + Elexon data.

```
timestamp           DateTime     — settlement period start (UTC)
carbon_intensity    Nullable(Float32) — actual gCO2/kWh
carbon_forecast     Nullable(Float32) — forecast gCO2/kWh
carbon_index        String       — 'very low' | 'low' | 'moderate' | 'high' | 'very high'
demand_mw           Nullable(Float32) — total system demand (MW)
price_gbp_mwh       Nullable(Float32) — imbalance / cash-out (system buy) price (£/MWh)

# Generation mix (% from Carbon Intensity API)
gen_gas_pct         Float32
gen_coal_pct        Float32
gen_nuclear_pct     Float32
gen_wind_pct        Float32
gen_solar_pct       Float32
gen_hydro_pct       Float32
gen_biomass_pct     Float32
gen_imports_pct     Float32
gen_other_pct       Float32

# Absolute generation (MW from Elexon AGPT)
gen_gas_mw          Float32
gen_coal_mw         Float32
gen_nuclear_mw      Float32
gen_wind_mw         Float32
gen_solar_mw        Float32
gen_hydro_mw        Float32
gen_biomass_mw      Float32
gen_other_mw        Float32
```

Sorting key: `timestamp`
Engine: `ReplacingMergeTree` (dedup on the same settlement period start)

### `commodity_prices` — Daily Oil & Gas Prices
One row per commodity per day (or month-start for World Bank monthly series). Live ingest is EIA (weekdays), World Bank Pink Sheet (monthly), and National Gas SAP.

```
date                Date         — price date
commodity           String       — published: 'brent_crude' | 'wti_crude' | 'henry_hub_gas' | 'eu_natural_gas' | 'lng_asia' | 'gb_gas_sap'
                                 leftover stored (withdrawn): 'eu_ttf'
price               Float32      — price in native units
currency            String       — 'USD' | 'EUR' | 'GBP'
unit                String       — '$/BBL' | '$/MMBTU' | 'EUR/MWh' | 'p/kWh'
```

Sorting key: `date, commodity`
Engine: `ReplacingMergeTree`

## Tinybird Pipes (API Endpoints)

1. **`latest_snapshot`** — most recent `energy_snapshots` row with non-null demand and price, `timestamp <= now()`
2. **`snapshots_range`** — returns snapshots between `start` and `end` params, optionally aggregated
3. **`latest_prices`** — latest price for each commodity (`FINAL` then `argMax` on date)
4. **`prices_range`** — price history between `start` and `end` (`FINAL`, no `any(price)`)
5. **`dashboard_summary`** — combines latest snapshot + latest prices in one call

## Next.js Architecture

- **App Router** with Server Components by default
- **`/api/cron`** — Vercel Cron handler, fetches all APIs, pushes to Tinybird Events API
- **Server Components** fetch from Tinybird pipe endpoints directly (no client-side fetch for initial data)
- **Client Components** only for interactive charts (Recharts) and time range selector
- On-demand `revalidatePath("/")` after successful cron ingest, plus a visible UK "data as of" timestamp
- `/api/health` reports stream freshness for uptime monitors

## Env Vars (Vercel)
```
TINYBIRD_URL=https://api.eu-central-1.aws.tinybird.co
TINYBIRD_TOKEN=<admin-token-for-cron-ingestion>
TINYBIRD_READ_TOKEN=<dashboard_read-token-from-deployment>
EIA_API_KEY=<free-eia-key>
CRON_SECRET=<random-secret-for-vercel-cron>
```

### How to get tokens

1. `TINYBIRD_TOKEN` — Use the workspace admin token (from `tb --cloud token ls` or Tinybird UI → Tokens).
2. `TINYBIRD_READ_TOKEN` — Auto-generated when you deploy. The `TOKEN dashboard_read READ` directive in each pipe file creates a `dashboard_read` token. Find it with `tb --cloud token ls` after deploying.
