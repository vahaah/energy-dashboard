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
TINYBIRD_API_URL=https://api.eu-central-1.aws.tinybird.co
TINYBIRD_TOKEN=<admin-token>
TINYBIRD_DATASOURCE_TOKEN=<read-token-for-pipes>
EIA_API_KEY=DEMO_KEY
CRON_SECRET=<random-secret-for-vercel-cron>
```

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

### Deploy
```bash
# Vercel auto-deploys from main branch
git push origin main

# Or manual deploy
vercel --prod
```
