# Agent Instructions — Energy Grid Monitor

## Quick Reference

| What | Where |
|------|-------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 (NO config file — all in CSS) |
| Charts | Recharts 3 (client components) |
| Database | Tinybird (ClickHouse) |
| Types | `src/lib/types.ts` |
| Colors | `src/lib/colors.ts` |
| Architecture | `ARCHITECTURE.md` |
| AI Context | `claude.md` |

## Development

```bash
npm run dev     # Start dev server (Turbopack)
npm run build   # Production build
npm run lint    # ESLint
```

## Environment Variables

See `.env.example`. The code uses:

| Variable | Purpose | How to get |
|----------|---------|------------|
| `TINYBIRD_URL` | Tinybird region host | From Tinybird workspace settings |
| `TINYBIRD_TOKEN` | Admin token for cron + backfill ingestion | `tb --cloud token ls` → Workspace admin token |
| `TINYBIRD_READ_TOKEN` | Read-only token for pipe queries | `tb --cloud token ls` → `dashboard_read` (auto-created by deployment) |
| `EIA_API_KEY` | US EIA API key | `DEMO_KEY` works for dev |
| `CRON_SECRET` | Vercel cron auth | Any random secret |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint (optional) | https://console.upstash.com → Create DB → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token (optional) | https://console.upstash.com → Create DB → REST Token |

**Token creation:** Resource-scoped tokens (`dashboard_read`, `ingest_token`) are defined via `TOKEN` directives in `.pipe` and `.datasource` files. They are created automatically by `tb --cloud deploy`. You cannot create them via `tb token create static` in Tinybird Forward.

**Rate limiting:** `src/lib/rate-limit.ts` uses Upstash Redis in production for distributed rate limiting. Without Upstash vars, falls back to in-memory (OK for dev, not for serverless production).

## Key Patterns

### Adding a feature
1. Types in `src/lib/types.ts`
2. Data fetching in `src/app/api/cron/route.ts` (if new data source)
3. Tinybird schema in `tinybird/datasources/` (if new table)
4. Chart component in `src/components/charts/` (with `"use client"`)
5. Wire into `src/components/dashboard.tsx`

### Tailwind v4
- Config is in `src/app/globals.css`, not a JS/TS config file
- Dark mode: `@custom-variant dark (&:is(.dark *))` — class-based, NOT media query
- Theme tokens: `@theme inline { ... }`

### Tinybird deployment
```bash
cd tinybird
tb --cloud deploy    # Deploy datasources, pipes, and tokens
tb --cloud token ls  # List generated tokens
```

### Backfill historical data
```bash
npx tsx scripts/backfill.ts --days 30          # Last 30 days
npx tsx scripts/backfill.ts --days 7 --dry-run # Preview only
npx tsx scripts/backfill.ts --only prices      # Only commodity prices
npx tsx scripts/backfill.ts --only snapshots   # Only grid snapshots
```
Requires `TINYBIRD_URL` and `TINYBIRD_TOKEN` in `.env.local`.

### Data flow
External APIs → `/api/cron` (hourly) → Tinybird → Server Component (ISR 5min) → Client Dashboard
