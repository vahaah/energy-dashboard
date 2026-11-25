# Copilot Instructions — Grid

## What This Project Is

GB electricity dashboard (product name **Grid**) showing half-hourly Great Britain grid data (carbon intensity, generation mix, demand, imbalance prices) plus commodity context. Data is collected hourly via Vercel Cron, stored in Tinybird (ClickHouse), and displayed with Recharts.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline {}`, NOT v3-style config files
- **Recharts 3** — all charts are client components
- **Tinybird** — ClickHouse-backed analytics database for time-series data
- **Vercel** — hosting + cron jobs

## Code Style

- TypeScript strict mode, no `any`
- All shared types live in `src/lib/types.ts`
- Prefer `Record<string, T>` over index signatures
- Client components start with `"use client"` directive
- Server Components are the default (no directive needed)
- Use `date-fns` for date formatting, never `moment`
- Use `lucide-react` for icons

## Tailwind v4 Specifics

This project uses Tailwind CSS v4 — be careful not to suggest v3 patterns:

- **DO**: `@import "tailwindcss"`, `@theme inline {}`, `@custom-variant`
- **DON'T**: `tailwind.config.ts`, `@tailwind base`, `darkMode: ["class"]`
- Dark mode is class-based via `@custom-variant dark (&:is(.dark *))` in `globals.css`
- Font is set via `--font-sans` in `@theme inline {}`

## Architecture Rules

1. **Data types first** — always define/update types in `types.ts` before writing logic
2. **Server Components for data fetching** — `page.tsx` fetches from Tinybird server-side
3. **Client Components only for interactivity** — charts, time range selector
4. **ISR 5 min** — `revalidate = 300` on the main page
5. **Graceful degradation** — dashboard renders with empty data when Tinybird isn't configured
6. **Rate limiting** — public `/api/*` routes rate-limited to 60 req/min per IP per instance via `src/proxy.ts`
7. **No auth on public APIs** — everything is public, CORS-enabled

## File Naming

- Components: PascalCase (`CarbonIntensityChart`)
- Files: kebab-case (`carbon-intensity-chart.tsx`)
- One component per file for charts
- Shared utilities in `src/lib/`

## Chart Patterns

All chart components follow this pattern:
```tsx
"use client";
import { ResponsiveContainer, ... } from "recharts";
// Transform data → chartData
// Return <div className="h-64"> with ResponsiveContainer
```

Color constants are in `src/lib/colors.ts`. Always use these — don't hardcode chart colors inline unless adding a new series.

Tooltip style (consistent across all charts):
```tsx
contentStyle={{
  backgroundColor: "rgba(0,0,0,0.85)",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
}}
```

## API Routes

- `/api/cron` — GET, protected with Bearer token, called by Vercel Cron every 30 minutes (`vercel.json`)
- `/api/snapshots?range=24h|7d|30d|90d|1y` — GET, public, returns grid snapshots
- `/api/generation?range=24h|7d|30d|90d|1y` — GET, public, FUELINST + NESO + PV Live
- `/api/interconnectors?range=24h|7d` — GET, public, interconnector flows
- `/api/prices?range=30d|90d|1y` — GET, public, returns commodity prices

## Tinybird

- Datasources defined in `tinybird/datasources/*.datasource`
- Pipes (query endpoints) in `tinybird/pipes/*.pipe`
- Both tables use `ReplacingMergeTree` for dedup
- Client in `src/lib/tinybird.ts`: `ingestRows()` for writes, `queryPipe()` for reads
- Backfill script: `npx tsx scripts/backfill.ts --days 30` (reads `.env.local`)

## Rate Limiting

- Public `/api/*` routes rate-limited to 60 req/min per IP per instance via `src/proxy.ts`
- In-memory only. Not distributed. `/api/health`, `/api/cron`, and `/api/cron-prices` are excluded.

## Do Not

- Don't add authentication to the public API endpoints
- Don't switch from Recharts to another charting library
- Theme preference uses the `grid-theme` localStorage key. Do not store tokens or personal data there.
- Don't add a `tailwind.config.ts` — config lives in CSS for v4
- Don't use `moment.js` — use `date-fns`
- Don't restart the dev server after code changes — just reload the browser
