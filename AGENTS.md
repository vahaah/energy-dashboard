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
│   │   └── card.tsx        # Shared widget card (header / footer / states)
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
├── backfill.ts                 # Historical grid + EIA price backfill
├── backfill-commodities.ts     # Commodity desk healer (EIA + World Bank + SAP)
└── build-today-map.ts          # Static Today-page map card (light and dark PNG)

vercel.json          # Cron config: /api/cron runs at minute 0 every hour
ARCHITECTURE.md      # Detailed data model and architecture docs
```

## Data Sources

| Source | Endpoint | Auth | Data |
|--------|----------|------|------|
| Carbon Intensity API | `api.carbonintensity.org.uk` | None | Carbon intensity (gCO₂/kWh), generation mix % |
| Elexon BMRS | `data.elexon.co.uk` | None | Market Index (APXMIDP) short-term wholesale price, imbalance / cash-out price (£/MWh), demand, FUELINST, AGPT |
| NESO | `api.neso.energy` | None | Embedded wind, mapped with UK settlement periods |
| Sheffield Solar PV Live | `api.pvlive.uk` | None | National GB solar including embedded (30-min) |
| US EIA | `api.eia.gov/v2` | `EIA_API_KEY` (required, no DEMO_KEY) | Brent, WTI, Henry Hub |
| World Bank Pink Sheet | `worldbank.org` commodity-markets monthly xlsx | None | EU natural gas + Japan LNG (CC BY 4.0) |
| National Gas | `data.nationalgas.com` | None | GB System Average Price (`gb_gas_sap`, PUBOB603) in **p/kWh**. Physical NTS parsers are offline fixtures only. |

## File catalogue

There is no catalogue database. Do not add Neon, Postgres, or another store for this. The catalogue is versioned JSON in git:

```
data/catalogue/
├── sources.json              # one object per source_id
├── datasets.json             # one object per dataset_id
├── source_releases.ndjson    # append-only releases
├── ingestion_runs.ndjson     # append-only runs (empty until an import records one)
├── layers.json               # basemap and DNO geometry pointers
└── layer_watch.json          # NESO DNO source ETag and sha256 the daily check compares
```

Zod schemas live in `src/lib/catalogue/schema.ts` (`catalogue_schema_version` 1). `npm run publish-check` validates them. CI runs that script. On a pull request it compares each existing release to the committed NDJSON line on `GITHUB_BASE_REF`. A reformatted or reordered line fails. Removing a line fails. Instants must round-trip through `Date`.

Identifiers:

- `source_id` is a slug from `DATA_SOURCE_IDS` in `src/lib/attribution.ts` (`elexon-bmrs`, `neso-open-data`, `carbon-intensity`, `sheffield-pv-live`, `eia`, `world-bank-pink-sheet`, `national-gas`).
- `dataset_id` is `{source_id}:{catalogue_key}`. The catalogue key is the `dataset_id` already stored on each metric in `src/lib/metrics.ts`. National Gas keys are the portal publication id (`PUBOB603` for the System Average Price). Do not invent a slug.
- `source_release_id` is `{dataset_id}:{published_at}` when the publisher timestamps the extract, otherwise `{dataset_id}:{content_hash}`. `content_hash` is `sha256:` plus the hex digest of the canonical JSON `content`. `content` is the extract snapshot, not the dataset's catalogue key, cadence, or metric list, so a new extract of the same series gets a new id. The id's line is immutable.

Each source row has `licence`, `licence_url`, `attribution`, and `cadence` (ingest schedule: `PT1H` or `PT6H`). Each dataset row has the metric cadence (`expected_cadence` from `src/lib/metrics.ts`; `publish-check` rejects a cadence that matches none of the metrics on that dataset) and the `metric_ids` that read it. Derived headline balance is registered on `elexon-bmrs` because that source is one of the metric's sources and FUELINST is the spine. The key stays `headline-balance`.

`/data-sources` reads `sources.json` through `cataloguePageSources()` in `src/lib/catalogue/page-sources.ts`. Keep that page's layout and sentences. `NATIONAL_GAS_ATTRIBUTION` in `src/lib/attribution.ts` is exactly `Data sourced from the National Gas Transmission Data Portal.` The catalogue source row uses that sentence and records National Gas Transmission's written consent of 14 Oct 2026. The Elexon row stores the copyright year in the file. `dataSources(year)` in that same module restamps that one credit for callers that pass a year. Do not import the catalogue module from client components; `src/lib/attribution.ts` stays free of it so chart bundles do not pull the JSON or Zod. `/` stays `force-static`. This catalogue is not wired into Tinybird.

### P1A.1 REPD / DUKES asset register

Checked-in plant register. No database, no Tinybird. `/` stays `force-static`.

`npm run catalogue:assets` downloads the latest gov.uk releases (Open Government Licence v3.0). `--offline` reads `data/catalogue/raw/`, which is gitignored, and fails if that cache is missing. It does not fall through to HTTP. The script rewrites the current plant list and appends releases:

- `assets.ndjson` (`ast_`), `projects.ndjson` (`prj_`), `capacity_records.ndjson` (`cap_`), `source_entity_mappings.ndjson` (`REPD_REF`, `DUKES_NAME`), `asset_matches.ndjson`, `asset_parties.ndjson`
- `asset_match_overrides.json` is hand-edited. Links and unlinks are applied before the automatic rules.
- `asset_summary.json` is regenerated. `publish-check` rejects a summary that disagrees with the register.

Operational REPD renewables, including pumped storage and excluding batteries and other storage, plus every DUKES 5.11 station. OSGB36 easting/northing becomes WGS84 via proj4. A row with no coordinates stays in the list with null latitude and longitude. The register never stores (0, 0). There is no geocoding.

The same site must not count twice. `src/lib/catalogue/assets/match.ts` matches on coordinates, then a distinctive name, then a name group. Renewables count the REPD megawatts. Gas, oil, nuclear, and pumped storage count DUKES. The other side is `counts: false`.

Each import appends one immutable `source_releases.ndjson` line. `content` is the edition, publication time, download URL, byte length, and `extract_sha256` of the official file, plus the DUKES 5.11.A headline MW. `content_hash` is the canonical JSON of that descriptor, not of the station list. Do not edit a committed release line. A later quarter appends a new release and new `capacity_records.ndjson` rows. Rows from older releases stay. Capacity for the release being imported is replaced. When several lines share a dataset, the newest `published_at` wins, and an equal timestamp keeps the later line. Directory, map, and search totals use the latest capacity release for each source and project. The detail page still lists every capacity row.

Each invocation also appends `ingestion_runs.ndjson` lines. `ingestion_run_id` is unique per run. `started_at` and `finished_at` are the import clock, not the publisher's `published_at`.

`publish-check` checks referential integrity, unique ids, MW in 0..5000, no (0, 0), and that a matched pair does not add both sides. It also requires `asset_parties.ndjson`: unique party keys, and one party row for each current project. The raw extracts stay out of git. The plant register stays in git. Map geometry is the Blob case, and only the basemap PMTiles.

### P1A.2 Geometry and basemap

P1A.2 ships the geometry and basemap and does not add a map page. `/` stays `force-static` with `revalidate` 300. This adds no Tinybird calls.

`npm run catalogue:dno` downloads the NESO DNO licence-area GeoJSON (EPSG:27700), transforms it with proj4, simplifies at the tolerance stored on the layer, and writes `public/tiles/layers/dno/<edition>.geojson` when the file is under 1 MB. The checked-in edition is `20240503`, 338625 bytes, tolerance `0.001` degrees. DNO `default_visible` is false. The layer stores the NESO Open Data plus OGL v3 attribution and NESO's "not 100% accurate" warning.

`npm run basemap:style` writes `public/basemap/style-light.json`, `style-dark.json`, Geist Sans glyph PBFs, and empty sprites. The style source stays `pmtiles://catalogue:basemap` until the upload script rewrites it. No OSM tile server.

`npm run basemap` is manual, about twice a year, and not in CI. It exits immediately when `BLOB_READ_WRITE_TOKEN` is unset and never prints the token. With the token set it downloads OS Open Zoomstack vector tiles (OGL v3), drops zooms above 13, writes bounds into the MBTiles metadata when that row is missing, converts to one PMTiles file, uploads `tiles/basemap/<edition>.pmtiles`, and records bytes and sha256 on the basemap row. `BASEMAP_MBTILES` reuses a local archive only when its `edition` metadata (or a `YYYY-MM` `version`) matches the product API edition. The published edition is `2026-06`. The MBTiles download is about 2.9 GB. The published PMTiles file is `tiles/basemap/2026-06.pmtiles`, 1028871685 bytes, `sha256:c446a4d8fea34ff8a6ad143e0cebd22f3db799793c87f8882d3e1d2e4781bcc0`.

`GET /api/v1/map/layers` is `force-static` and serves `layers.json`. `GET /api/cron-map-layers` (`20 5 * * *`) checks the NESO source by ETag and downloads only when the ETag misses, then sha256. A later run probes with the ETag stored on the Redis pointer. The checked-in edition, file URL, bytes, and sha256 stay the publication. An equal source hash is current even when the resource URL changes. A failure does not replace the Redis pointer `grid:map-layer:dno`. A changed source hash is flagged on `/data-health`. Page requests only read that flag.

### P1A.3 Map, asset directory, and search

`/map`, `/assets`, and `/assets/[id]` are `force-static`. `/map` draws the OS Open Zoomstack PMTiles basemap with MapLibre. The DNO layer starts off. The asset directory lists the register, and each station page includes the full capacity history.

The header search button is on every page, including `/`. The dialog and `/search/assets.json` load on the first open. `/` does not load maplibre or pmtiles. `/` stays `force-static` with `revalidate` 300. These pages make no Tinybird calls.

`asset_parties.ndjson` holds operator, region, and county from the same official editions. `prebuild` copies the MapLibre worker to `public/maplibre/`; that copy is not committed.

### P1A.4 Asset pages and schematic interconnectors

`/assets/[id]` and a wrong `/assets/[id]/[slug]` return 308 to the canonical slug. The id is the identity. An unknown id returns 404. Internal links, Cmd-K, the map inspector (`Asset page →`), and the sitemap use that path. `?sel=<id>` selects an asset on `/map`. Interconnectors also set `layers=ic`.

`data/catalogue/interconnectors.json` lists IFA, IFA2, ElecLink, BritNed, Nemo, NSL, Viking, Moyle, East-West, and Greenlink. Each row has its INT* FUELINST code, schematic country-label endpoints, and an Elexon citation. `intneso` is the residual Imports bucket and is never drawn. Endpoints are checked against the schematic box (west -12, south 47, east 14, north 64). `(0, 0)` fails. The `layers=ic` layer is off unless the query asks for it. The line is dashed in `--chart-imports` and labelled `Schematic link, not the cable route.` There is no cable route.

Flow series attach only by exact INT* code, including the lowercased code the ingest stores. The page peeks the warmed `interconnector_flows` envelope and does not call Tinybird. Positive MW is an import to Great Britain. A plant or gas terminal with no evidenced series says the series will appear once that source is added. The canonical asset route revalidates every 1800s, the live warm cadence for the 24h flow envelope. Next requires that interval as a literal. The in-flight peek is shared only until that call settles.

`data/catalogue/gas_terminals.json` lists NTS terminal names from the National Gas portal. No free licence-permitted coordinate source is cited, so every terminal has null coordinates and reads `Location unavailable` in `/assets`. No gas flow series is stored. Theddlethorpe is omitted. A pin is allowed only with an Open Government Licence v3.0 or CC BY 4.0 coordinate citation inside the GB pin box.

`publish-check` validates both files when they are present, and requires them for the full register. `/` stays `force-static` with `revalidate` 300. These pages add no Tinybird calls.

### P1A.5 Today map card

`/` stays `force-static` with `revalidate` 300. Below the answer and the headline balance, a static card links to `/map`. The card does not import maplibre, pmtiles, the catalogue loader, or `renderStaticMap`. A page request does not read the register and does not add a Tinybird call. The only map bytes on `/` are the two committed PNGs.

`npm run map:today` (`scripts/build-today-map.ts`, also `predev` / `prebuild`) draws those images from the checked-in register and the DNO outline. `renderStaticMap` in `src/lib/map/static-map.ts` takes a bbox and points so a later asset-page thumbnail can call it. Light and dark PNGs are `public/today/map-light.png` and `public/today/map-dark.png`, swapped with the `html.dark` class inside a fixed aspect box. The script rewrites them only when the REPD release, the DUKES release, or the DNO sha256 changes; pass `--force` after a renderer change. The alt count is the REPD and DUKES station total. Interconnectors and gas terminals are not in that count. `/map` prints every catalogue row as assets. The footer uses `OGL_V3_ATTRIBUTION` and `NESO_OPEN_DATA_ATTRIBUTION`. The outline is the DNO silhouette, not Zoomstack, so the card does not carry the OS basemap credit. No OSM.

### P1A.6 National Gas physical spike

Offline parsers and fixtures only. No page, no cron, nothing on Blob, and no Tinybird. The success path stays 378.

`data/catalogue/national-gas/catalogue.json` keeps the sha256, `catalogueVersion`, `lastChangeDate`, and the publication rows from one GET of `https://api.nationalgas.com/operationaldata/v1/publications/catalogue`. The full 10.9 MB catalogue stays out of git. CSV fixtures live in `tests/fixtures/gas/csv/`, one file per publication id, with a header comment for id, catalogue version, unit, quantity kind, gas-day timestamps, and null behaviour. `tests/fixtures/gas/release.json` is the `GasRelease` contract (`gasReleaseSchema` in `src/lib/ingest/national-gas/release.ts`). P1A.7 produces that document and P1A.8 renders it.

Parsers are in `src/lib/ingest/national-gas/`. Gas days are 05:00–05:00 Europe/London via `src/lib/london-time.ts`, including the 23-hour and 25-hour 2026 clock changes. On the 25-hour day the repeated hour is kept as two instants, using a stated offset or row order. Impossible wall times are quarantined. Quality indicators `A` and `L` are accepted. `PUBOB4424` is published negative and stored as positive generation. A parent and its children never both count. Unknown publication ids, columns, and enum values are quarantined. Rates and cumulative readings are not summed. `GAS_METRICS` in `src/lib/metrics.ts` registers the series at geography `GB_NTS` and is not part of `METRICS`, so `/data-health` does not list them. SAP `PUBOB603` is unchanged (`publication_lag` `P1D`, `stale_grace` `P2D`).

`publish-check` rejects a publication id outside that list. The portal documents `dateFrom` and `dateTo` as 19-character timestamps; `YYYY-MM-DD` also returned CSV for `PUBOB2042`. Both results are in `date-format.json`. The Instantaneous Flow API answered `GET /operationaldata/v1/instantaneousflow/sites` without a login. This spike does not parse it.

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
UPSTASH_REDIS_REST_URL=<optional — Upstash REST URL, https:// only>
UPSTASH_REDIS_REST_TOKEN=<optional — paired REST token>
BLOB_READ_WRITE_TOKEN=<optional — basemap upload script only, never log it>
# Also accepted: KV_REST_API_URL / KV_REST_API_TOKEN from the Marketplace integration
```

### How tokens work
- `TINYBIRD_TOKEN` — Workspace admin token. Used by `/api/cron` and `scripts/backfill.ts` to ingest data via Events API.
- `TINYBIRD_READ_TOKEN` — Auto-generated `dashboard_read` token (defined via `TOKEN dashboard_read READ` in pipe files). Required for pipe queries. There is no fallback to the admin token.
- `CRON_SECRET` — Required. Cron routes fail closed if it is unset.
- Tokens are created via `tb --cloud deploy` (Tinybird Forward requires resource-scoped tokens in data files, not via CLI `token create`).

### Redis is optional

Production sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the Marketplace `KV_REST_API_*` pair). That is what holds the slot lock, the 450/day Tinybird counter, workflow step bodies, and the warmed envelopes. The scheduled success path stays **378** Tinybird ops.

When neither pair is set (local `next dev`, or a deploy without Upstash):

- The workflow slot lock is skipped, so ingest still starts. A second cron in the same slot is not deduped.
- Step bodies and the daily op counter stay in process memory. A single-process local run can finish. Separate Vercel isolates still need Redis to hand a body from one step to the next.
- Public `queryPipe` reads Tinybird directly for the rolling window instead of returning 503. A past `?date=` is sliced from the narrowest warmed envelope that contains that London day. If the envelope is missing, or the day is older than every warmed window, one civil-day pipe read is counted on the daily budget and cached for the historical TTL (one day fresh, seven days stale). That read is not part of the 378 success path. Without Redis the same civil-day read still runs, counted only in that process. Set Redis before relying on the 450 cap across instances.

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
1. Add the source, dataset, and a new immutable release under `data/catalogue/`, then run `npm run publish-check`
2. Add TypeScript types in `src/lib/types.ts`
3. Add fetch logic in `src/app/api/cron/route.ts`
4. Create or update Tinybird datasource in `tinybird/datasources/`
5. Create a Tinybird pipe in `tinybird/pipes/`
6. Add a chart component in `src/components/charts/`
7. Wire into `dashboard.tsx`

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
- OilPriceAPI leftover keys are ignored. `/api/cron-prices` self-backfills EIA (400 days at 00:30 UTC, 30 days otherwise), World Bank Pink Sheet from 2025-01 on every run, and National Gas SAP. `scripts/backfill-commodities.ts` is optional.

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
