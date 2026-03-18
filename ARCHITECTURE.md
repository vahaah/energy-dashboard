# Energy Dashboard — Architecture

## Data Sources

| Source | API | Frequency | Auth | Data |
|--------|-----|-----------|------|------|
| Carbon Intensity API | `api.carbonintensity.org.uk` | Half-hourly | None | Carbon intensity (gCO2/kWh), generation mix % |
| Elexon BMRS | `data.elexon.co.uk` | Half-hourly | None | System prices (£/MWh), demand (MW), generation by fuel (MW) |
| EIA (US Gov) | `api.eia.gov/v2` | Daily | API key (DEMO_KEY works) | Brent crude, WTI crude ($/BBL), Henry Hub gas ($/MMBTU) |

## Tinybird Data Sources (ClickHouse tables)

### Design Principles
1. **One wide row per snapshot** — not normalized. ClickHouse is columnar, so unused columns cost nothing. Wide rows avoid JOINs at query time.
2. **`toStartOfHour(timestamp)` as the sorting key** — deduplicates on hourly boundaries.
3. **`ReplacingMergeTree`** — if the cron runs twice in the same hour, newer data replaces older. No duplicates.
4. **Separate data sources for different cadences** — grid data (hourly) vs commodity prices (daily) have different update rhythms.

### `energy_snapshots` — Hourly UK Grid Data
One row per hour. Combines Carbon Intensity + Elexon data.

```
timestamp           DateTime     — toStartOfHour of fetch time (UTC)
carbon_intensity    Float32      — actual gCO2/kWh
carbon_forecast     Float32      — forecast gCO2/kWh
carbon_index        String       — 'very low' | 'low' | 'moderate' | 'high' | 'very high'
demand_mw           Float32      — total system demand (MW)
price_gbp_mwh       Float32      — system buy price (£/MWh)

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
Engine: `ReplacingMergeTree` (dedup on same hour)

### `commodity_prices` — Daily Oil & Gas Prices
One row per commodity per day. EIA updates daily (weekdays only).

```
date                Date         — price date
commodity           String       — 'brent_crude' | 'wti_crude' | 'henry_hub_gas'
price               Float32      — price in native units
currency            String       — 'USD'
unit                String       — '$/BBL' | '$/MMBTU'
```

Sorting key: `date, commodity`
Engine: `ReplacingMergeTree`

## Tinybird Pipes (API Endpoints)

1. **`latest_snapshot`** — returns the most recent energy_snapshots row
2. **`snapshots_range`** — returns snapshots between `start` and `end` params, optionally aggregated
3. **`latest_prices`** — returns latest price for each commodity
4. **`prices_range`** — returns price history between `start` and `end`
5. **`dashboard_summary`** — combines latest snapshot + latest prices in one call

## Next.js Architecture

- **App Router** with Server Components by default
- **`/api/cron`** — Vercel Cron handler, fetches all APIs, pushes to Tinybird Events API
- **Server Components** fetch from Tinybird pipe endpoints directly (no client-side fetch for initial data)
- **Client Components** only for interactive charts (Recharts) and time range selector
- **ISR** with `revalidate: 300` (5 min) on the main dashboard page

## Env Vars (Vercel)
```
TINYBIRD_API_URL=https://api.eu-central-1.aws.tinybird.co
TINYBIRD_TOKEN=<admin-token-for-cron-ingestion>
TINYBIRD_READ_TOKEN=<dashboard_read-token-from-deployment>
EIA_API_KEY=DEMO_KEY
CRON_SECRET=<random-secret-for-vercel-cron>
```

### How to get tokens

1. `TINYBIRD_TOKEN` — Use the workspace admin token (from `tb --cloud token ls` or Tinybird UI → Tokens).
2. `TINYBIRD_READ_TOKEN` — Auto-generated when you deploy. The `TOKEN dashboard_read READ` directive in each pipe file creates a `dashboard_read` token. Find it with `tb --cloud token ls` after deploying.
