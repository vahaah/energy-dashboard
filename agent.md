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

### Data flow
External APIs → `/api/cron` (hourly) → Tinybird → Server Component (ISR 5min) → Client Dashboard

### Environment
See `.env.example` for all required variables. `DEMO_KEY` works for EIA API during development.
