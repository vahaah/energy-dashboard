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
tb auth
cd tinybird && tb push --force
```

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

### 6. Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel dashboard:
- `TINYBIRD_API_URL`
- `TINYBIRD_TOKEN`
- `TINYBIRD_READ_TOKEN`
- `EIA_API_KEY`
- `CRON_SECRET`

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

- **60 requests per minute** per IP address
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- Production uses Upstash Redis; dev uses in-memory store

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
