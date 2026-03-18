# Energy Grid Monitor — AI Assistant Context

## Project Overview

Real-time UK electricity grid dashboard combined with global oil and gas commodity prices. Built with Next.js 16 (App Router), Tailwind CSS v4, and Tinybird (ClickHouse) for time-series data storage.

**Live at:** Hosted on Vercel  
**Repo:** `vahaah/energy-dashboard`

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.1.7 |
| React | React | 19.2 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`) | 4.2+ |
| Charts | Recharts | 3.8+ |
| Data Store | Tinybird (ClickHouse) | — |
| Hosting | Vercel | — |
| Rate Limiting | In-memory + @upstash/ratelimit (optional) | — |

## Architecture

### Data Flow

```
External APIs (hourly cron)
  ├─ Carbon Intensity API → carbon intensity, generation mix %
  ├─ Elexon BMRS → system prices, demand, generation by fuel
  └─ EIA API → Brent, WTI, Henry Hub prices
       │
       ▼
  /api/cron route (Vercel Cron, every hour)
       │
       ▼
  Tinybird Events API (ingest)
       │
       ▼
  Tinybird Pipes (query)
       │
       ▼
  Next.js Server Component (ISR 5 min) → Dashboard (client component)
```

### Key Design Decisions

1. **ISR (Incremental Static Regeneration)** — Main page re-generates every 5 minutes. Initial data fetched server-side from Tinybird, then client-side fetches for range changes.
2. **Wide-row schema** — One row per hourly snapshot with all metrics. ClickHouse is columnar so unused columns cost nothing. Avoids JOINs.
3. **ReplacingMergeTree** — Deduplicates on the same hour. Safe to re-run cron without creating duplicates.
4. **Public API with rate limiting** — All `/api/*` endpoints are public, CORS-enabled, rate-limited to 60 req/min per IP via middleware.
5. **Dark-mode first** — Hardcoded `className="dark"` on `<html>`. Class-based dark mode via `@custom-variant dark (&:is(.dark *))` in Tailwind v4.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout, Inter font, dark mode
│   ├── page.tsx            # Server Component, ISR 5min, fetches Tinybird
│   ├── globals.css         # Tailwind v4 config, CSS custom properties, dark mode
│   └── api/
│       ├── cron/route.ts   # Hourly data collection from all APIs → Tinybird
│       ├── snapshots/route.ts  # Public API: grid data by time range
│       └── prices/route.ts     # Public API: commodity prices by range
├── components/
│   ├── dashboard.tsx       # Main client component, orchestrates all charts
│   ├── time-range-selector.tsx  # 24h/7d/30d/90d toggle
│   ├── ui/
│   │   └── kpi-card.tsx    # KPI metric card
│   └── charts/
│       ├── carbon-intensity-chart.tsx  # Area chart with forecast line
│       ├── price-chart.tsx             # Line chart for £/MWh
│       ├── demand-chart.tsx            # Area chart for MW demand
│       ├── generation-mix-chart.tsx    # Donut/pie chart
│       ├── generation-stack-chart.tsx  # 100% stacked area chart
│       └── commodity-chart.tsx         # Multi-line chart for oil/gas prices
├── lib/
│   ├── types.ts           # All TypeScript interfaces (Tinybird rows + API responses)
│   ├── tinybird.ts        # Tinybird client (ingest + queryPipe)
│   ├── colors.ts          # Fuel colors, commodity colors, carbon index colors
│   └── rate-limit.ts      # Upstash rate limit helpers
└── middleware.ts           # CORS + in-memory rate limiting for /api/*

tinybird/
├── datasources/
│   ├── energy_snapshots.datasource  # Hourly grid data (ReplacingMergeTree)
│   └── commodity_prices.datasource  # Daily oil/gas prices (ReplacingMergeTree)
└── pipes/
    ├── latest_snapshot.pipe    # Most recent snapshot
    ├── snapshots_range.pipe    # Snapshots between start/end
    ├── latest_prices.pipe      # Latest price per commodity
    └── prices_range.pipe       # Price history between start/end

scripts/
└── backfill.ts         # Historical data backfill (npx tsx scripts/backfill.ts)

vercel.json          # Cron config: /api/cron runs at minute 0 every hour
ARCHITECTURE.md      # Detailed data model and architecture docs
```

## Data Sources

| Source | Endpoint | Auth | Data |
|--------|----------|------|------|
| Carbon Intensity API | `api.carbonintensity.org.uk` | None | Carbon intensity (gCO₂/kWh), generation mix % |
| Elexon BMRS | `data.elexon.co.uk` | None | System prices (£/MWh), demand (MW), generation by fuel (MW) |
| US EIA | `api.eia.gov/v2` | `EIA_API_KEY` (DEMO_KEY works) | Brent crude, WTI crude, Henry Hub gas |

## Environment Variables

```env
# Required
TINYBIRD_API_URL=https://api.eu-central-1.aws.tinybird.co
TINYBIRD_TOKEN=<admin-token-for-cron-ingestion>
TINYBIRD_READ_TOKEN=<dashboard_read-token-from-deployment>
EIA_API_KEY=DEMO_KEY
CRON_SECRET=<random-secret-for-vercel-cron>

# Optional — production rate limiting
UPSTASH_REDIS_REST_URL=<from-upstash-console>
UPSTASH_REDIS_REST_TOKEN=<from-upstash-console>
```

### How tokens work
- `TINYBIRD_TOKEN` — Workspace admin token. Used by `/api/cron` and `scripts/backfill.ts` to ingest data via Events API.
- `TINYBIRD_READ_TOKEN` — Auto-generated `dashboard_read` token (defined via `TOKEN dashboard_read READ` in pipe files). Used by the Server Component to query pipe endpoints. Falls back to `TINYBIRD_TOKEN` if not set.
- Tokens are created via `tb --cloud deploy` (Tinybird Forward requires resource-scoped tokens in data files, not via CLI `token create`).

### Upstash Redis
- Used by `src/lib/rate-limit.ts` for distributed rate limiting in production.
- Without Upstash, rate limiting falls back to an in-memory Map (resets on cold start, not shared across serverless instances).
- Sign up at https://console.upstash.com → create a Redis database → copy REST URL and REST Token.

## Conventions

### Tailwind v4
- Uses `@import "tailwindcss"` and `@theme inline {}` — NOT Tailwind v3 syntax
- Class-based dark mode: `@custom-variant dark (&:is(.dark *))` in globals.css
- No `tailwind.config.ts` file — config is in CSS

### TypeScript
- Strict mode. All data types in `src/lib/types.ts`
- Recharts formatter callbacks need explicit type annotations for `value` parameter
- Use `Record<string, T>` for dynamic object shapes

### Charts (Recharts)
- All chart components are client components (`"use client"`)
- Dark grid lines: `stroke="#27272a"` (zinc-800)
- Tooltip style: dark semi-transparent background, rounded, no border
- Consistent color palette in `src/lib/colors.ts`

### API Routes
- All public, CORS-enabled via middleware
- Rate-limited: 60 req/min per IP
- `/api/cron` — protected with Bearer token (CRON_SECRET), called by Vercel Cron
- Query parameter: `range` accepts `24h`, `7d`, `30d`, `90d`

### Styling
- Font: Inter (Google Fonts, variable font)
- Dark mode first (`.dark` class on `<html>`)
- Rounded-xl for cards, rounded-lg for smaller elements
- Zinc color palette for surfaces and borders
- Emerald accent for brand/primary elements

## Common Tasks

### Add a new data source
1. Add TypeScript types in `src/lib/types.ts`
2. Add fetch logic in `src/app/api/cron/route.ts`
3. Create or update Tinybird datasource in `tinybird/datasources/`
4. Create a Tinybird pipe in `tinybird/pipes/`
5. Add a chart component in `src/components/charts/`
6. Wire into `dashboard.tsx`

### Add a new chart
1. Create component in `src/components/charts/` with `"use client"` directive
2. Use Recharts `ResponsiveContainer` wrapping chart
3. Follow existing patterns for tooltip styling and color usage
4. Import and add to the grid in `dashboard.tsx`

### Modify the cron job
- Edit `src/app/api/cron/route.ts`
- The cron schedule is in `vercel.json` (currently `0 * * * *` = every hour)
- Always handle API failures gracefully — partial data is better than no data

### Backfill historical data
```bash
# Last 30 days (default)
npx tsx scripts/backfill.ts --days 30

# Custom range
npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18

# Dry run (preview only)
npx tsx scripts/backfill.ts --days 7 --dry-run

# Backfill only prices or only snapshots
npx tsx scripts/backfill.ts --days 90 --only prices
npx tsx scripts/backfill.ts --days 30 --only snapshots
```

The script reads `TINYBIRD_API_URL` and `TINYBIRD_TOKEN` from `.env.local`. Data sources:
- Carbon Intensity API — intensity + generation mix (14-day max per request, aggregated hourly)
- Elexon BMRS — system prices, demand, generation by fuel
- EIA — Brent, WTI, Henry Hub daily (up to 5000 rows)

### Deploy
```bash
# Vercel auto-deploys from main branch
git push origin main

# Or manual deploy
vercel --prod
```
