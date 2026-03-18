# Energy Grid Monitor

Real-time UK electricity grid dashboard combined with global oil & gas commodity prices.

**Live data sources:**
- [Carbon Intensity API](https://api.carbonintensity.org.uk) — carbon intensity, generation mix
- [Elexon BMRS](https://bmrs.elexon.co.uk) — system prices, demand, generation by fuel type
- [US EIA](https://www.eia.gov/opendata/) — Brent crude, WTI crude, Henry Hub natural gas

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js)                         │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Dashboard │    │ /api/cron    │    │ /api/snapshots       │   │
│  │ (SSR+ISR) │    │ (hourly)     │    │ /api/prices          │   │
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

Hit the cron endpoint manually to populate your first snapshot:

```bash
curl http://localhost:3000/api/cron
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

Requires `TINYBIRD_API_URL` and `TINYBIRD_TOKEN` in `.env.local`. Uses `DEMO_KEY` for EIA by default.

### 7. Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel dashboard:
- `TINYBIRD_API_URL`
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

Returns UK grid energy snapshots.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `24h\|7d\|30d\|90d` | `24h` | Time range |

### `GET /api/prices`

Returns oil & gas commodity prices.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | `30d\|90d\|1y` | `30d` | Time range |
| `commodity` | `brent_crude\|wti_crude\|henry_hub_gas` | all | Filter |

### Rate Limiting

- **60 requests per minute** per IP address (sliding window)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- **Production:** Uses [Upstash Redis](https://console.upstash.com) for distributed rate limiting across serverless instances. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.
- **Development:** Falls back to an in-memory store (no Redis needed, resets on server restart)

## Data Model

### `energy_snapshots` (hourly)
- Carbon intensity (actual + forecast)
- System demand (MW)
- Electricity system price (£/MWh)
- Generation mix (% and MW): gas, coal, nuclear, wind, solar, hydro, biomass, imports

### `commodity_prices` (daily)
- Brent Crude ($/bbl)
- WTI Crude ($/bbl)
- Henry Hub Natural Gas ($/MMBtu)

## License

MIT
