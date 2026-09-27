# Energy Grid Monitor

Real-time UK electricity grid dashboard combined with global oil & gas commodity prices.

**Live data sources:**
- [Carbon Intensity API](https://api.carbonintensity.org.uk) — carbon intensity, generation mix
- [Elexon BMRS](https://bmrs.elexon.co.uk) — imbalance (cash-out) prices, demand, generation by fuel type
- [Sheffield Solar PV Live](https://www.solar.sheffield.ac.uk/pvlive/) — GB solar including embedded
- [NESO](https://www.neso.energy/) — embedded wind (UK settlement periods)
- [US EIA](https://www.eia.gov/opendata/) — Brent crude, WTI crude, Henry Hub natural gas
- [OilPriceAPI](https://www.oilpriceapi.com) — Dutch TTF in EUR/MWh, JKM LNG
- [FRED](https://fred.stlouisfed.org) — monthly EU TTF and Asia LNG in $/MMBtu

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js)                         │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Dashboard │    │ /api/cron    │    │ /api/snapshots       │   │
│  │ (SSR)     │    │ (hourly)     │    │ /api/prices /health  │   │
│  └─────┬─────┘    └──────┬───────┘    │ (public, rate-limited│   │
│        │                 │            └──────────┬───────────┘   │
└────────┼─────────────────┼───────────────────────┼──────────────┘
         │                 │                       │
         │    ┌────────────▼──────────────┐        │
         │    │   External APIs           │        │
         │    │ • Carbon Intensity API    │        │
         │    │ • Elexon BMRS             │        │
         │    │ • US EIA                  │        │
         │    └────────────┬──────────────┘        │
         │                 │ ingest                 │
         │    ┌────────────▼──────────────┐        │
         └────► Tinybird (ClickHouse)     ◄────────┘
              │ • energy_snapshots        │ query
              │ • commodity_prices        │
              └───────────────────────────┘
```

## Stack

- **Next.js 16** (App Router, Server Components, ISR)
- **Tinybird** (ClickHouse-backed time-series storage + API)
- **Vercel** (hosting, cron jobs, edge middleware)
- **Recharts** (client-side charts)
- **Upstash Redis** (optional, production rate limiting)

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

# Custom date range
npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18

# Dry run (preview without ingesting)
npx tsx scripts/backfill.ts --days 7 --dry-run

# Backfill only prices or only grid snapshots
npx tsx scripts/backfill.ts --days 90 --only prices
npx tsx scripts/backfill.ts --days 30 --only snapshots
```

Requires `TINYBIRD_URL` and `TINYBIRD_TOKEN` in `.env.local` at the **repo root**. A real `EIA_API_KEY` is required for EIA history (`DEMO_KEY` is not used).

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
- `UPSTASH_REDIS_REST_URL` (optional — for production rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` (optional — for production rate limiting)

The cron job runs automatically every hour via `vercel.json`.

## Public API

All API endpoints are public with rate limiting (60 req/min per IP).

### `GET /api/snapshots`

Returns UK grid energy snapshots. `price_gbp_mwh` is the Elexon **imbalance / cash-out (system buy)** price, not day-ahead wholesale. `24h` is a rolling 24 hours unless a historical `date` is supplied (UK calendar day). Missing metrics are `null`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `24h\|7d\|30d\|90d\|1y` | `24h` | Time range (invalid values return 400) |
| `date` | `YYYY-MM-DD` | — | Optional UK calendar day when `range=24h` |

### `GET /api/prices`

Returns oil & gas commodity prices. `eu_ttf` is OilPriceAPI Dutch TTF in **EUR/MWh**. `eu_natural_gas` is FRED monthly TTF in **$/MMBtu**. Do not treat them as one series.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `30d\|90d\|1y` | `30d` | Time range |
| `commodity` | `brent_crude\|wti_crude\|henry_hub_gas\|eu_ttf\|eu_natural_gas\|lng_asia` | all | Filter |

### `GET /api/health`

Freshness of snapshots, FUELINST, embedded generation, and prices. Returns **503** when a critical grid stream is stale. Suitable for an uptime monitor.

### Rate Limiting

- **60 requests per minute** per IP address (sliding window)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- **Production:** Uses [Upstash Redis](https://console.upstash.com) for distributed rate limiting across serverless instances. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.
- **Development:** Falls back to an in-memory store (no Redis needed, resets on server restart)

## Data Model

### `energy_snapshots` (half-hourly, UK settlement periods)
- Carbon intensity (actual + forecast)
- System demand (MW)
- Imbalance / cash-out price (£/MWh)
- Generation mix (% and MW): gas, coal, nuclear, wind, solar, hydro, biomass, imports
- Missing values are stored as `null` so averages skip gaps

### `generation_5min`
- Elexon FUELINST (5-min)
- NESO embedded wind (half-hourly, UK local mapping)
- Sheffield Solar PV Live (30-min national solar, used because NESO actuals are too coarse for midday solar)

### `commodity_prices` (daily)
- Brent Crude ($/bbl)
- WTI Crude ($/bbl)
- Henry Hub Natural Gas ($/MMBtu)

## License

MIT
