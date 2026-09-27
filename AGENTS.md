# Grid — AI Assistant Context

## Project Overview

GB electricity dashboard (product name **Grid**, live at https://grid.vahaah.com) with commodity context. Half-hourly / hourly ingest — not real-time. Built with Next.js 16 (App Router), Tailwind CSS v4, and Tinybird (ClickHouse) for time-series data storage.

**Live at:** https://grid.vahaah.com
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
| Rate Limiting | In-memory 60 req/min per instance (`src/proxy.ts`) | — |

## Architecture

### Data Flow

```
External APIs
  ├─ Carbon Intensity API → carbon intensity, generation mix %
  ├─ Elexon BMRS → imbalance prices, demand, FUELINST, AGPT
  ├─ NESO → embedded wind (half-hourly, UK settlement periods)
  ├─ Sheffield Solar PV Live → GB solar including embedded
  ├─ EIA / National Gas → commodities (via /api/cron-prices)
       │
       ▼
  /api/cron (hourly) + /api/cron-prices (every 6h)
       │
       ▼
  Tinybird Events API (ingest) → on-demand revalidatePath("/")
       │
       ▼
  Tinybird Pipes (query, FINAL / argMax dedup)
       │
       ▼
  Next.js Server Component → Dashboard
```

### Key Design Decisions

1. **On-demand revalidation** — Cron calls `revalidatePath("/")` and `revalidateTag("dashboard")` after a successful ingest. ISR alone is stale-while-revalidate and goes stale on a low-traffic site.
2. **Half-hourly snapshots** — One wide row per UK settlement period (46/48/50 on clock-change days). Missing metrics are `null`, never `0`.
3. **ReplacingMergeTree + query-time dedup** — Safe to re-run ingest, but pipes must use `FINAL` / `argMax` / `GROUP BY` because merges are not immediate.
4. **Public API with rate limiting** — All `/api/*` endpoints are public, CORS-enabled, rate-limited to 60 req/min per IP via `src/proxy.ts`. `/api/health`, `/api/cron`, and `/api/cron-prices` are excluded.
5. **Dark-mode first** — Hardcoded `className="dark"` on `<html>`. Class-based dark mode via `@custom-variant dark (&:is(.dark *))` in Tailwind v4.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout, Geist Sans + Geist Mono, dark mode
│   ├── page.tsx            # Server Component, ISR 5min, fetches Tinybird
│   ├── globals.css         # Tailwind v4 config, CSS custom properties, dark mode
│   └── api/
│       ├── cron/route.ts        # Hourly GB grid ingest
│       ├── cron-prices/route.ts # 6-hourly commodity ingest
│       ├── health/route.ts      # Freshness probe for uptime monitors
│       ├── snapshots/route.ts   # Public API: grid data by time range
│       ├── generation/route.ts  # Public API: FUELINST + embedded + PV Live
│       ├── interconnectors/route.ts # Public API: interconnector flows
│       └── prices/route.ts      # Public API: commodity prices by range
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
│   ├── settlement-period.ts # UK local settlement period mapping
│   └── colors.ts          # Fuel colors, commodity colors, carbon index colors
└── proxy.ts                # CORS + in-memory rate limiting for /api/*

tinybird/
├── datasources/
│   ├── energy_snapshots.datasource  # Half-hourly grid data (Nullable metrics)
│   ├── generation_5min.datasource   # FUELINST + embedded wind/solar
│   └── commodity_prices.datasource  # Daily oil/gas prices (ReplacingMergeTree)
└── pipes/
    ├── latest_snapshot.pipe    # Most recent snapshot (FINAL)
    ├── snapshots_range.pipe    # Snapshots between start/end (FINAL)
    ├── latest_generation.pipe  # Latest reading per fuel type
    ├── latest_prices.pipe      # Latest price per commodity (argMax)
    └── prices_range.pipe       # Price history (GROUP BY date, commodity)

scripts/
└── backfill.ts         # Historical data backfill (npx tsx scripts/backfill.ts)

vercel.json          # Cron config: /api/cron runs at minute 0 every hour
ARCHITECTURE.md      # Detailed data model and architecture docs
```

## Data Sources

| Source | Endpoint | Auth | Data |
|--------|----------|------|------|
| Carbon Intensity API | `api.carbonintensity.org.uk` | None | Carbon intensity (gCO₂/kWh), generation mix % |
| Elexon BMRS | `data.elexon.co.uk` | None | Imbalance / cash-out price (£/MWh), demand, FUELINST, AGPT |
| NESO | `api.neso.energy` | None | Embedded wind, mapped with UK settlement periods |
| Sheffield Solar PV Live | `api.pvlive.uk` | None | National GB solar including embedded (30-min) |
| US EIA | `api.eia.gov/v2` | `EIA_API_KEY` (required, no DEMO_KEY) | Brent, WTI, Henry Hub |
| National Gas | `data.nationalgas.com` | None | GB System Average Price (`gb_gas_sap`, PUBOB603) in **p/kWh** |

## Environment Variables

```env
# Required
TINYBIRD_URL=https://api.eu-central-1.aws.tinybird.co
TINYBIRD_TOKEN=<admin-token-for-cron-ingestion>
TINYBIRD_READ_TOKEN=<dashboard_read-token-from-deployment>
EIA_API_KEY=<free-eia-key>
CRON_SECRET=<required-secret-for-vercel-cron>
OIL_PRICE_API_KEY=<optional, unused — ingest disabled in cron and backfill>
FRED_API_KEY=<optional, unused — ingest disabled in cron and backfill>
```

### How tokens work
- `TINYBIRD_TOKEN` — Workspace admin token. Used by `/api/cron` and `scripts/backfill.ts` to ingest data via Events API.
- `TINYBIRD_READ_TOKEN` — Auto-generated `dashboard_read` token (defined via `TOKEN dashboard_read READ` in pipe files). Required for pipe queries. There is no fallback to the admin token.
- `CRON_SECRET` — Required. Cron routes fail closed if it is unset.
- Tokens are created via `tb --cloud deploy` (Tinybird Forward requires resource-scoped tokens in data files, not via CLI `token create`).

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
- `/api/cron` and `/api/cron-prices` — fail closed without `CRON_SECRET`, return per-source status, 503 if a required source fails
- `/api/health` — freshness of snapshots / generation / embedded / prices; 503 if a critical grid stream is stale
- `/api/interconnectors` — public interconnector flows (`24h` / `7d`)
- Query parameter: `range` is validated (`24h`, `7d`, `30d`, `90d`, `1y`). Invalid values return 400.

### Styling
- Font: Geist Sans + Geist Mono via the `geist` package (`--font-sans` / `--font-mono` from GeistSans / GeistMono CSS variables on `<html>`). No Inter.
- Dark mode first (`.dark` class on `<html>`)
- Rounded-xl for cards, rounded-lg for smaller elements
- Surfaces and borders use Geist gray / `background-*` / `gray-alpha-400` tokens in `globals.css` `@theme` (zinc may remain on some legacy chart strokes until later PRs)
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

# Custom UK settlement-date range (inclusive YYYY-MM-DD, not UTC midnights)
npx tsx scripts/backfill.ts --from 2026-01-01 --to 2026-03-18

# Dry run (preview only)
npx tsx scripts/backfill.ts --days 7 --dry-run

# Backfill only prices or only snapshots
npx tsx scripts/backfill.ts --days 90 --only prices
npx tsx scripts/backfill.ts --days 30 --only snapshots
```

`--from` / `--to` are inclusive UK settlement dates. `--to 2026-09-27` during BST must not include 28 Sep.

The script loads `.env.local` from the repo root (`scripts/../.env.local`). Data sources:
- Carbon Intensity + Elexon — half-hourly UK settlement periods, including 46/50-period clock-change days
- FUELINST + NESO embedded wind + Sheffield PV Live
- EIA daily Brent/WTI/Henry Hub (requires a real `EIA_API_KEY`)
- OilPriceAPI and FRED ingest is disabled everywhere (`/api/cron-prices` and `scripts/backfill.ts`); leftover keys are ignored

After deploying Nullable snapshot columns and the new pipes, re-run snapshot + generation backfill to replace historical `0` placeholders and the old UTC-mapped prices.

### Cleanup leftover future generation rows

Preview, then delete only after review (do not run from CI or agents):

```sql
SELECT timestamp, fuel_type, source, generation_mw
FROM generation_5min
WHERE timestamp > now()
ORDER BY timestamp;

DELETE FROM generation_5min WHERE timestamp > now();
```

`latest_generation` and `/api/health` already ignore `timestamp > now()`. Incomplete snapshot rows are skipped by `latest_snapshot` (`demand_mw` and `price_gbp_mwh` must be non-null). The homepage and `/api/prices` only publish EIA oil/gas series and National Gas SAP.

### Deploy
```bash
# Vercel auto-deploys from main branch
git push origin main

# Or manual deploy
vercel --prod
```
