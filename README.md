# Grid

GB electricity dashboard — half-hourly Great Britain grid data, with commodity context.

**Live:** [grid.vahaah.com](https://grid.vahaah.com)

**Data sources:**
- [Carbon Intensity API](https://api.carbonintensity.org.uk) — carbon intensity, generation mix
- [Elexon BMRS/Insights](https://bmrs.elexon.co.uk) — Market Index (APXMIDP) short-term wholesale price, imbalance (cash-out) prices, demand, generation by fuel type
- [Sheffield Solar PV Live](https://www.solar.sheffield.ac.uk/pvlive/) — national GB solar (including embedded)
- [NESO](https://www.neso.energy/) — embedded wind (UK settlement periods); [embedded wind and solar forecast](https://www.neso.energy/data-portal/embedded-wind-and-solar-forecasts) added to Elexon NDF so demand look-ahead matches the embedded-inclusive demand line; [historic generation mix](https://www.neso.energy/data-portal/historic-generation-mix) for Year / All time and records (NESO Open Data Licence)
- [US EIA](https://www.eia.gov/opendata/) — Brent crude, WTI crude, Henry Hub natural gas
- [National Gas Data Portal](https://data.nationalgas.com) — GB System Average Price (`gb_gas_sap`, PUBOB603), p/kWh, no auth

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js)                         │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Dashboard │    │ /api/cron    │    │ /api/snapshots       │   │
│  │ (SSR)     │    │ (hourly)     │    │ /api/generation      │   │
│  └─────┬─────┘    └──────┬───────┘    │ /api/interconnectors │   │
│        │                 │            │ /api/prices /health  │   │
│        │                 │            │ (public, rate-limited│   │
│        │                 │            └──────────┬───────────┘   │
└────────┼─────────────────┼───────────────────────┼──────────────┘
         │                 │                       │
         │    ┌────────────▼──────────────┐        │
         │    │   External APIs           │        │
         │    │ • Carbon Intensity API    │        │
         │    │ • Elexon BMRS/Insights    │        │
         │    │ • NESO / Sheffield PV Live│        │
         │    │ • EIA / National Gas      │        │
         │    └────────────┬──────────────┘        │
         │                 │ ingest                 │
         │    ┌────────────▼──────────────┐        │
         └────► Tinybird (ClickHouse)     ◄────────┘
              │ • energy_snapshots        │ query
              │ • generation_5min         │
              │ • commodity_prices        │
              └───────────────────────────┘
```

## Stack

- **Next.js 16** (App Router, static/ISR shell, client-side range switching)
- **Tinybird** (ClickHouse-backed time-series storage + API)
- **Upstash Redis** (optional REST read-through cache in front of Tinybird / NESO / Elexon / Carbon Intensity)
- **Vercel** (hosting, cron jobs)
- **Recharts** (client-side charts)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/vahaah/energy-dashboard.git
cd energy-dashboard
npm install
```

### 2. Set up Tinybird

See [`tinybird/README.md`](./tinybird/README.md) for full instructions.

```bash
pip install tinybird-cli
tb login
cd tinybird && tb --cloud deploy
```

After deployment, get your tokens:

```bash
tb --cloud token ls
```

You need two values:
- **Workspace admin token** → set as `TINYBIRD_TOKEN` (cron uses this to ingest)
- **`dashboard_read` token** → set as `TINYBIRD_READ_TOKEN` (dashboard uses this to query pipes)

### 3. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your Tinybird tokens
```

### 4. Run locally

```bash
npm run dev
```

### 5. Seed initial data

Hit the cron endpoint manually to populate your first snapshot (`CRON_SECRET` is required):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron
```

### 6. Backfill historical data (optional)

Load historical data from all sources into Tinybird:

```bash
# Last 30 days (default)
npx tsx scripts/backfill.ts --days 30

# Custom UK settlement-date range (inclusive YYYY-MM-DD, not UTC midnights)
npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18

# Dry run (preview without ingesting)
npx tsx scripts/backfill.ts --days 7 --dry-run

# Backfill only prices or only grid snapshots
npx tsx scripts/backfill.ts --days 90 --only prices
npx tsx scripts/backfill.ts --days 30 --only snapshots
```

`--from` / `--to` are inclusive **UK settlement dates**. Do not pass UTC midnights — `--to 2026-09-27` during BST must not ingest 28 Sep.

GB gas SAP is a separate one-off backfill (National Gas PUBOB603, 2025-01-01 → today). Dry-run is the default; `--execute` appends rows that are not already stored. Do not run `--execute` from CI or agents:

```bash
npx tsx scripts/backfill-gb-gas-sap.ts
npx tsx scripts/backfill-gb-gas-sap.ts --execute
```

Requires `TINYBIRD_URL` and `TINYBIRD_TOKEN` in `.env.local` at the **repo root**. A real `EIA_API_KEY` is required for EIA history (`DEMO_KEY` is not used). Commodity-desk healing:

```bash
npx tsx scripts/backfill-commodities.ts --dry-run
npx tsx scripts/backfill-commodities.ts --from 2025-01-01
npx tsx scripts/backfill-commodities.ts --purge-stray --dry-run
```

`/api/cron-prices` self-backfills: the 00:30 UTC slot writes a 400-day EIA window (other slots write 30 days), every run writes World Bank Pink Sheet months from 2025-01, and National Gas SAP stays on its 7-day window. Leftover `OIL_PRICE_API_KEY` / `FRED_API_KEY` values are ignored. History is complete within 24h of deploy.

### Cleanup leftover future generation rows

NESO day-ahead forecasts were ingested with timestamps after `now()`. Latest pipes and `/api/health` ignore those rows, but they still sit in `generation_5min` until deleted.

Preview (safe):

```sql
SELECT timestamp, fuel_type, source, generation_mw
FROM generation_5min
WHERE timestamp > now()
ORDER BY timestamp
```

Delete only after reviewing the preview. Do not run this from CI or agents:

```sql
DELETE FROM generation_5min WHERE timestamp > now()
```

Incomplete just-started snapshot rows can stay. `latest_snapshot` now requires non-null `demand_mw` and `price_gbp_mwh`. Preview leftovers with:

```sql
SELECT timestamp, demand_mw, price_gbp_mwh
FROM energy_snapshots FINAL
WHERE demand_mw IS NULL OR price_gbp_mwh IS NULL
ORDER BY timestamp DESC
```

The homepage and `/api/prices` publish EIA oil/gas, World Bank monthly Europe gas and Japan LNG, and National Gas SAP. Other stored commodity rows stay in Tinybird but are not served.

### 7. Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel dashboard:
- `TINYBIRD_URL`
- `TINYBIRD_TOKEN`
- `TINYBIRD_READ_TOKEN`
- `EIA_API_KEY`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL` (optional — Vercel Marketplace Upstash Redis)
- `UPSTASH_REDIS_REST_TOKEN` (optional — paired with the REST URL)
- `OIL_PRICE_API_KEY` (optional, unused — ingest disabled in cron and backfill)
- `FRED_API_KEY` (optional, unused — ingest disabled in cron and backfill)

If the Upstash vars are missing, Redis errors, or the lock cannot be taken, `queryPipe` and the NESO / Elexon / Carbon Intensity fetches fall back to the existing Next.js cache. After each ingest, crons bump a cache epoch (invalidating live keys) and warm Day / Week / Year / All plus commodity ranges.

The cron job runs automatically every hour via `vercel.json`. Commodity ingest (`/api/cron-prices`) runs every 6 hours and self-backfills EIA + World Bank history within 24h of deploy. `scripts/backfill-commodities.ts` is optional.

### 8. Ping IndexNow

After `public/79e85fd471ac4c8e8327acd532d0a9c9.txt` is live:

```bash
npm run indexnow
npm run indexnow -- --all
```

`scripts/indexnow.ts` fetches `https://grid.vahaah.com/sitemap.xml`, follows the sitemap index, and reads `<loc>` and `<lastmod>` from each child. It POSTs `{ host, key, keyLocation, urlList }` to `https://api.indexnow.org/indexnow` in batches of at most 10,000 URLs. 200 and 202 are success. Transient failures retry up to three attempts. The default submits URLs whose lastmod is newer than that child sitemap's checkpoint. GitHub Actions keeps that checkpoint in the `indexnow-marker` artifact (`INDEXNOW_MARKER_FILE`). A missing marker submits every sitemap URL and does not fail the run. Redis or Vercel Blob is used only when that store is configured outside Actions. A pages build time does not hide an older catalogue stream. `--all` submits every page URL and needs no store. It prints the HTTP status of each batch and exits non-zero if the sitemap fetch or any batch fails.

The IndexNow key is public by design. The file contains only `79e85fd471ac4c8e8327acd532d0a9c9` and is served at `https://grid.vahaah.com/79e85fd471ac4c8e8327acd532d0a9c9.txt`. `src/proxy.ts` matches `/api/:path*` and returns that path before the rate limiter, so key verification stays on the static file.

## Public API

All API endpoints are public. Rate limiting is an in-memory 60 req/min per IP **per instance** in `src/proxy.ts` (not shared across serverless isolates; resets on cold start). `/api/health`, `/api/cron`, and `/api/cron-prices` are excluded.

### `GET /api/dashboard`

Assembled homepage payload for client-side range switching. Used by `/` so Day / Week / Year / All never reload the page.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | `day\|week\|year\|all` | `day` | Global (or per-block) period |
| `date` | `YYYY-MM-DD` | — | Optional UK calendar day when `period=day` |
| `commodityRange` | `30d\|90d\|1y` | `90d` | Oil/gas window included on the payload |

### `GET /api/snapshots`

Returns GB grid energy snapshots. `price_mid_gbp_mwh` is the Elexon **short-term wholesale Market Index** (APXMIDP), not the day-ahead auction. Half-hours with zero volume or £0 are stored as `null`. `price_gbp_mwh` is the **imbalance / cash-out (system buy)** price. `gen_pumped_mw` and `gen_battery_mw` are nullable storage columns. `24h` is a rolling 24 hours unless a historical `date` is supplied (UK calendar day). Missing metrics are `null`. The JSON includes an `attribution` block with the exact BMRS credit and licence URL.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `24h\|7d\|30d\|90d\|1y` | `24h` | Time range (invalid values return 400) |
| `date` | `YYYY-MM-DD` | — | Optional UK calendar day when `range=24h` |

### `GET /api/generation`

Returns FUELINST, NESO embedded wind, and Sheffield Solar PV Live series. PV Live is national GB solar, stored as `embedded_solar`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `24h\|7d\|30d\|90d\|1y` | `24h` | Time range |
| `date` | `YYYY-MM-DD` | — | Optional UK calendar day when `range=24h` |

### `GET /api/interconnectors`

Returns interconnector import/export flows (Elexon FUELINST `INT*` fuels).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `24h\|7d` | `24h` | Time range |
| `date` | `YYYY-MM-DD` | — | Optional UK calendar day when `range=24h` |

### `GET /api/prices`

Returns commodity prices. Public series are EIA Brent, WTI and Henry Hub; World Bank monthly Europe gas (`eu_natural_gas`) and Japan LNG (`lng_asia`); plus National Gas System Average Price (`gb_gas_sap`, stored in **p/kWh**; display as p/therm × 29.3071 or £/MWh × 10). Unknown commodity keys return 400.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `30d\|90d\|1y` | `30d` | Time range |
| `commodity` | `brent_crude\|wti_crude\|henry_hub_gas\|eu_natural_gas\|lng_asia\|gb_gas_sap` | all | Filter |

### `GET /api/look-ahead`

Derived next-48-hours answers only. Returns Grid’s cleanest 2-hour window from the NESO Carbon Intensity 48-hour forecast, plus a tonight/tomorrow wind sentence from Elexon WINDFOR. Cached 30 minutes. **Does not** pass through the raw carbon forecast series (Carbon Intensity API terms). Forecast times are when Grid fetched the source.

### `GET /api/health`

Freshness of snapshots, FUELINST, embedded generation, and prices. Thresholds follow ingest cadence (`/api/cron` hourly → 2.5h; `/api/cron-prices` every 6h → 4d). Returns **503** when a critical grid stream is stale. Suitable for an uptime monitor.

### Rate Limiting

- **60 requests per minute** per IP address, per serverless instance (`src/proxy.ts`)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Returns `429 Too Many Requests` when exceeded
- In-memory only — not distributed. There is no Upstash (or other shared) limiter.
- Public JSON uses `s-maxage` + `stale-while-revalidate` (`/api/dashboard`, `/api/snapshots`, `/api/generation`, `/api/prices`, `/api/look-ahead`).
- Homepage range changes update the URL with `history.replaceState` and refetch only the affected charts. Per-block overrides (`generationPeriod`, `pricePeriod`, `transfersPeriod`, `mixPeriod`, `carbonPeriod`) keep `?focus=` share links working.

## Data Model

### `energy_snapshots` (half-hourly, UK settlement periods)
- Carbon intensity (actual + forecast)
- System demand (MW)
- Short-term wholesale Market Index price and volume (`price_mid_gbp_mwh`, `mid_volume_mwh`)
- Imbalance / cash-out price (`price_gbp_mwh`, £/MWh)
- Generation mix (% and MW): gas, coal, nuclear, wind, solar, hydro, biomass, imports
- Storage MW: pumped, battery (nullable)
- Missing values are stored as `null` so averages skip gaps

### `generation_5min`
- Elexon FUELINST (5-min)
- NESO embedded wind (half-hourly, UK local mapping)
- Sheffield Solar PV Live (30-min national solar, used because NESO actuals are too coarse for midday solar)

### `commodity_prices` (daily / monthly)
- Brent Crude ($/bbl) — EIA
- WTI Crude ($/bbl) — EIA
- Henry Hub Natural Gas ($/MMBtu) — EIA
- Natural gas, Europe ($/MMBtu, monthly) — World Bank Pink Sheet, CC BY 4.0
- LNG, Japan import price ($/MMBtu, monthly) — World Bank Pink Sheet, CC BY 4.0
- GB gas System Average Price (p/kWh, `gb_gas_sap`) — National Gas PUBOB603

## License

[MIT](./LICENSE) © 2026 Alex Vakhitov
