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
4. **Public API with rate limiting** — All `/api/*` endpoints are public, CORS-enabled, rate-limited to 60 req/min per IP via `src/proxy.ts`. `/api/health`, `/api/cron`, `/api/cron-prices`, and `/api/cron-gas` are excluded.
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
│       ├── cron-gas/route.ts    # Hourly NTS intraday start; no upstream fetch
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
| National Gas | `data.nationalgas.com` | None | GB System Average Price (`gb_gas_sap`, PUBOB603) in **p/kWh**. Physical NTS flows and completed gas-day totals publish to Blob. Not Tinybird. |

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

`data/catalogue/gas_terminals.json` lists NTS terminal names from the National Gas portal, including the Moffat exit. Each pin is an approximate GeoNames site under CC BY 4.0 and reads `Approximate site` in `/assets`. Theddlethorpe is omitted. A pin is allowed only with an Open Government Licence v3.0 or CC BY 4.0 coordinate citation inside the GB pin box. Per-terminal rates are the map flows release, not this file.

`publish-check` validates both files when they are present, and requires them for the full register. `/` stays `force-static` with `revalidate` 300. These pages add no Tinybird calls.

### P1A.5 Today map card

`/` stays `force-static` with `revalidate` 300. Below the answer and the headline balance, a static card links to `/map` and `/assets`. The card does not import maplibre, pmtiles, the catalogue loader, `renderStaticMap`, or `today-card-build`. A page request does not read the register and does not add a Tinybird call. The only map bytes on `/` are the two committed PNGs. Figures are the committed `src/lib/map/today-card.json` (about 2 KB). Tinybird impact **+0**.

`npm run map:today` (`scripts/build-today-map.ts`, also `predev` / `prebuild`) draws those images from the checked-in plant register, the operating battery pins in `src/lib/map/today-batteries.json`, and the DNO outline. `renderStaticMap` in `src/lib/map/static-map.ts` takes a bbox and points so a later asset-page thumbnail can call it. Markers use the technology shapes, an operating fill, and three size steps (under 50 MW, 50–299 MW, 300 MW and over). Offshore and onshore wind share one colour and differ by shape. Light and dark PNGs are `public/today/map-light.png` and `public/today/map-dark.png`, rendered at 2× of the 264 px box, each at most 25 KB, with `loading="lazy"`, swapped with the `html.dark` class. The script rewrites them only when the REPD release, the DUKES release, the DNO sha256, the battery-pin sha256, or the sha256 of `energy_projects.ndjson` changes; pass `--force` after a renderer change. `prebuild` does not fetch.

Built figures and the map are England, Scotland, and Wales. Northern Ireland, interconnectors, and gas terminals are left out. Operating batteries come from the projects register (REPD rows with a GB country and a coordinate) and are plotted from `today-batteries.json`. They are not added to `assets.ndjson`, so `/assets`, `/map`, and the sitemap stay on the plant register. The `/map` stations layer uses `TODAY_GROUPS`, `MAP_SIZE_STEPS`, and `isGbNation` from the same modules. A site with no published megawatts is counted and is not drawn: it is not placed in the under-50 MW step. `today-batteries.json` `source_release_id` must equal the plant register's REPD release or `map:today` throws. Technology rows, the nation split, and the pipeline stages each reconcile to their headline with `largestRemainder` at 0.1 GW. A part that rounds to zero is `—`, never `0`. Pipeline stages count REPD projects in England, Scotland, and Wales plus TEC-only rows (the NESO register covers GB and publishes no country). The card always says `Consent does not mean a project will be built.` If no staged row can be classed that way, it says `Pipeline figures are not yet filtered to GB.` A row with no rated capacity stays in the site or project count and out of the gigawatts. When any included row is missing that figure, the card is partial: the amber rule is on, and the line is `Rated capacity is not published for {n} sites.` or `… projects. The gigawatts are the published total.`

The alt text counts those operating GB sites. The footer is `OGL_V3_ATTRIBUTION` (`Contains public sector information licensed under the Open Government Licence v3.0.`) and one edition stamp (`REPD Q2 2026 · DUKES May 2026`). It does not credit NESO. The outline is the DNO silhouette, not Zoomstack, so the card does not carry the OS basemap credit. No OSM. Stale is an amber rule on the edition line: REPD more than 4 months after the quarter end, DUKES more than 14 months after publication. A missing map is `CardEmpty`.

`npm run catalogue:project-regions` stamps `region` onto `energy_projects.ndjson` from `data/catalogue/raw/repd.csv` (gitignored). `npm run catalogue:today-batteries` writes the battery pins from that same file. Neither script runs in `prebuild`, and neither falls through to HTTP. `catalogue:projects` already writes `region` from the REPD Region column; TEC rows stay `region: null`.

### P1A.6 National Gas physical spike

Parsers and fixtures. `/gas` is P1A.8. The Blob publish path and the hourly cron are P1A.7. The Tinybird success path stays 378.

`data/catalogue/national-gas/catalogue.json` keeps the sha256, `catalogueVersion`, `lastChangeDate`, and the publication rows from one GET of `https://api.nationalgas.com/operationaldata/v1/publications/catalogue`. The full 10.9 MB catalogue stays out of git. CSV fixtures live in `tests/fixtures/gas/csv/`, one file per publication id, with a header comment for id, catalogue version, unit, quantity kind, gas-day timestamps, and null behaviour. `tests/fixtures/gas/release.json` is the `GasRelease` contract (`gasReleaseSchema` in `src/lib/ingest/national-gas/release.ts`). P1A.7 produces that document and P1A.8 renders it.

Parsers are in `src/lib/ingest/national-gas/`. Gas days are 05:00–05:00 Europe/London via `src/lib/london-time.ts`, including the 23-hour and 25-hour 2026 clock changes. On the 25-hour day the repeated hour is kept as two instants, using a stated offset or row order. Impossible wall times are quarantined. Quality indicators `A` and `L` are accepted. `PUBOB4424` is published negative and stored as positive generation. A parent and its children never both count. Unknown publication ids, columns, and enum values are quarantined. Rates and cumulative readings are not summed. `GAS_METRICS` in `src/lib/metrics.ts` registers the series at geography `GB_NTS` and is not part of `METRICS`. `/api/health` and `/data-health` both list them through `loadDataHealth`, which reads the Blob bundle pointers. A missing pointer is `not_yet_available`. SAP `PUBOB603` is unchanged (`publication_lag` `P1D`, `stale_grace` `P2D`).

`publish-check` rejects a publication id outside that list. The portal documents `dateFrom` and `dateTo` as 19-character timestamps; `YYYY-MM-DD` also returned CSV for `PUBOB2042`. Both results are in `date-format.json`. The Instantaneous Flow API answered `GET /operationaldata/v1/instantaneousflow/sites` without a login. This spike does not parse it.

### P1A.7 Gas publish path

`/api/cron-gas` runs hourly at `5 * * * *`. It requires `CRON_SECRET` and fails closed. The route only calls `start(gasIntraday)`. It does not fetch National Gas.

`src/workflows/gas-intraday.ts` is four steps: the Redis `SET NX` slot lock (`gas` slot, 50 minutes, floored to minute 05), one CSV GET for the intraday publication list, validate and normalise with the P1A.6 parsers, then publish. `maxRetries` is 2. A 429 or 5xx throws `RetryableError` with `retryAfter` of 30s, then 120s, plus up to 10s of jitter. The next failure is `FatalError` and leaves `releases/gas/latest.json` on the previous release. Step results are `{ok, rows, bytes, hash, releaseId}`.

The completed gas day is one extra step on the existing prices workflow (`30 */6 * * *`), not a new cron. One CSV GET. SAP `PUBOB603` is not in either bundle and its ingest is unchanged. A fatal completed-day step returns `{ok:false}` so the prices run still finishes.

Blob layout, with `BLOB_READ_WRITE_TOKEN` (never logged):

- `releases/gas/<release_id>.json` is immutable and matches `GasRelease`. The id hashes the release with `retrieved_at` fixed, so the same CSV does not mint a second release.
- `releases/gas/latest.json` is `{release_id, generated_at}`. It is written only after validation. `releases/gas/previous.json` is the pointer that write replaced.
- `quarantine/<YYYY-MM-DD>/<sha256>.csv` keeps a rejected body. Files older than 90 days are deleted.
- The portal catalogue is fetched at most once per UTC day. `releases/gas/catalogue-hash.json` stores `{sha256, fetched_at}` and not the body.
- Each new release appends one `source_releases` line and one `ingestion_runs` line under `releases/gas/catalogue/`. The checked-in catalogue already has one registration release per publication, so `publish-check` passes. No database.

`GET /api/v1/gas/overview?gas_day=` and `GET /api/v1/gas/series?metric=&from=&to=` read those Blob files. An unknown metric is 400. Timestamps are UTC `Z`, and each point also carries a gas-day label. `/gas` is P1A.8. Success calls `revalidatePath` for `/gas`, `/api/v1/gas/overview`, and `/api/v1/gas/series`. It does not revalidate `/`. `/` stays `force-static` with `revalidate` 300 and makes no gas or Tinybird request.

An optional Redis key `grid:gas:latest` caches the latest pointer for 300s.

`/data-health` and `/api/v1/data-health` append `GAS_METRICS` from both bundle pointers, `releases/gas/latest/intraday.json` and `releases/gas/latest/completed-day.json`. `releases/gas/latest.json` stays the newest release of either bundle. Intraday is stale when `now - published_at` is over 3 hours. A completed gas day is not stale. A missing value is not yet available. The figure is the latest component. Rates are not summed. A parent and its children do not both count. The national-gas source cadence is `PT1H` because the intraday cron is hourly. SAP and the completed gas day stay on the 6-hour prices cron.

Budget: Tinybird **+0** (the scheduled success path stays 378, under the 450 cap). About 216 Vercel Workflow events a day (1 run + 4 steps × 2 events × 24 hourly runs). National Gas: about 24 intraday GETs, about 4–5 completed-day GETs, and 1 catalogue GET a day. No bursts and no backfill.

Rollback: read `releases/gas/previous.json`, overwrite `releases/gas/latest.json` with that pointer, and delete Redis key `grid:gas:latest`. Leave the immutable release file and the per-bundle pointers in place. A Redis read error falls through to the Blob pointer.

### P1A.8 Gas page

`/gas` is `force-static` with `revalidate` 900. `/` stays `force-static` with `revalidate` 300 and does not import this page. No new Tinybird pipe. The page does not call `queryPipe`. Gas-fired generation is read from the warmed 24h `generation_5min_range` envelope. The bridge is shown only when those samples cover every half-hour of the gas day. A miss or a fragment hides it.

`GasReleaseReader` in `src/lib/gas/release-reader.ts` is the page's data source. `getGasReleaseReader` reads Blob when `BLOB_READ_WRITE_TOKEN` is set: `readLatestGasRelease` is `loadGasRelease(null)`, and `readGasReleaseHistory` is that release plus `loadBundleReleases()`, newest gas day first. Tests, CI, and local e2e leave the token unset and use `fixtureGasReleaseReader` (`tests/fixtures/gas/release.json`). An empty history renders the "Not yet available" notice.

The basis control lists only `flow`, `to-date`, and `completed` when that basis is on the release. Anything else is omitted. One basis is a label. Supply is `gray-1000`. Demand is `--chart-gas`. Shares use `displayedPercents` and are omitted when a required entry or demand component is missing, so a subset is not rescaled to 100. A partial day is compared only with other days on the same basis. The series table is in the server HTML. The chart is client-only, so the table remains when the chart does not run. Linepack is gas held in the pipelines. A null preferred linepack value falls through to the next publication. Storage inventory is not shown. Completed totals (`PUBOBJ635`, `PUBOB637`, demand shares, storage) are million m³. Flow rates stay million m³/day. A completed day is complete only when both headline totals are present and the gas day has ended. Hourly flow is complete when the headline series has a sample in every hour, including the last hour, which is timestamped an hour before the end. Stale follows each publication's `expected_cadence` and publication lag in `GAS_METRICS`. A 23-hour or 25-hour gas day labels GMT and BST on the endpoint that changes. Coverage links to `/data-health#nts`. The System Average Price card stays separate. The attribution on the page is `Data sourced from the National Gas Transmission Data Portal.`

### P1A.9 Phase 1A release gate

`/data-sources` lists National Gas operational flows and SAP (`PUBOB603`, p/kWh, consent 14 Oct 2026), DESNZ REPD, DESNZ DUKES, NESO DNO areas, and OS Open Zoomstack. DNO and Zoomstack are catalogue sources (`neso-dno-areas` cadence `P1D`, `os-open-zoomstack` cadence `P6M`) with no datasets. Attribution is `DNO_ATTRIBUTION` and `osBasemapAttribution(year)`. The page does not mention OilPriceAPI or a TTF daily series. `dataSources(year)` restamps the Elexon year and the OS year.

Sitemap paths are `/gas`, `/system/constraints`, `/system/storage`, `/system/whole-energy`, `/map`, `/assets`, `/projects`, `/directory`, `/directory/identifiers`, every `loadAssetCatalogue()` row, including interconnectors and gas terminals, and every `loadProjectCatalogue()` row. Hidden routes (`/system/generation`, `/system/demand`, `/system/carbon`, `/system/transfers`) stay out. `/directory` ships in P1B.6. `npm run indexnow:once` (`scripts/indexnow-once.ts`) is the post-deploy one-shot: `INDEXNOW_KEY` from the environment, compared with the public key file, never printed, and only URLs outside `INDEXNOW_SETTLED_PATHS`. It waits until production serves `public/release-1a.txt` (`phase-1a`). A 200 from `/gas` is not enough, because that route is already on the previous deployment. The sitemap fetch is `cache: no-store` with `?release=phase-1a`. If the marker is absent after 10 minutes the job exits without posting. `.github/workflows/indexnow.yml` runs that script on `workflow_dispatch` and when `data/indexnow/release-1a.txt`, `public/release-1a.txt`, or the workflow file changes on `main`. `npm run indexnow` still submits the full sitemap.

Open-graph images for `/gas`, `/map`, `/assets`, and `/assets/[id]/[slug]` are file routes. They pass an empty snapshot, so they do not peek Redis or Tinybird. Page ids are `gas-system`, `map`, and `assets`. An asset card shrinks the title past 72 characters and wraps with `overflow-wrap`. Light and dark coverage is the layout suite; the card itself is one dark image.

`/api/health` reads gas from `releases/gas/latest/intraday.json` and `releases/gas/latest/completed-day.json`. The first production slot after #64/#65 was 2026-10-15T09:05Z and wrote the intraday pointer. Completed-day stays on the prices workflow. See `docs/release-1a.md` for the smoke list, the exact rollback (previous `releases/gas/latest.json` and per-bundle pointers, plus the previous Vercel deployment), the §21 matrix, and what is not in 1A. On-call for a source schema change is Alex.

Tinybird budget for this step: **+0**. The scheduled success path stays 378.

### P1B.1 Constraints

`/system/constraints` is `force-static` with `revalidate` 3600. `/` stays `force-static` with `revalidate` 300. The homepage does not import `src/lib/constraints`, the NESO parser, or `releases/neso-constraints`. No new Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378.

Two datasets on the existing `neso-open-data` source: `constraint-breakdown` (measured, weekly, revised) and `day-ahead-constraint-flows-and-limits` (forecast, weekdays). Attribution is `NESO_OPEN_DATA_ATTRIBUTION` (`Supported by National Energy SO Open Data`). Dataset URLs are `NESO_CONSTRAINT_BREAKDOWN_URL` and `NESO_DAY_AHEAD_CONSTRAINTS_URL`. The licence URL stays `NESO_OPEN_DATA_LICENCE_URL`.

`CONSTRAINT_METRICS` is not part of `METRICS`. `kind` is `"measured"` for the breakdown and `"forecast"` for the day-ahead snapshot. A measured chart accepts only `kind: "measured"` and one unit. `measuredCostChart` is £. `measuredVolumeChart` is MWh. A forecast series throws. £ and MWh never share an axis. Cost shares use `displayedPercents` only when every published category is present and non-negative.

The System dropdown is `SYSTEM_NAV_ITEMS` in `src/lib/nav.ts`. A later page adds one object. The header shows an item only when its href is in `SHIPPED_PAGE_ROUTES`. This step ships Constraints. Generation, demand, carbon, and transfers stay in the array and stay out of the header and the sitemap.

Ingest is `nesoConstraints` from `/api/cron-constraints`. Breakdown is `40 4 * * *`. Day-ahead is `40 16 * * 1-5`. The route does not fetch NESO. Each run is a package lookup and one CSV, paced at 30 seconds (`NESO_DATASTORE_MAX_PER_MINUTE` is 2). About 2 workflow runs a day, 9 events per run. A changed hash for an already-published period writes a new `releases/neso-constraints/{releaseId}.json` and moves the bundle pointer. The previous file stays. A bad file or a new enum (unknown column or a boundary outside `CONSTRAINT_BOUNDARIES`) is quarantined under `quarantine/neso-constraints/` and the previous pointer stays. Add a new constraint group to that allowlist or the file quarantines. The day-ahead JSON keeps the latest 16 settlement dates. The raw CSV is stored by sha256. Reporting dates are the source settlement dates and the NESO financial year (April–March, Europe/London). The Blob catalogue line sets `published_at` to the resource `issued_at`. A retry still records that line when the immutable release file is already there. `GET /api/v1/constraints` rejects a date that does not round-trip through `Date`.

`GET /api/v1/constraints?from=&to=&boundary=` reads the Blob release. `from` and `to` are required inclusive settlement dates. An unsupported filter is 400. No national cost is allocated to a boundary. With `BLOB_READ_WRITE_TOKEN` unset, the page and the API use `tests/fixtures/constraints`. Health reads Blob only, so a missing pointer is `not_yet_available`. A transient Blob read (`500`, `429`, `BlobServiceNotAvailable`, `BlobServiceRateLimited`, `BlobUnknownError`, a timeout, or a network failure) aborts after 10 seconds and is retried three times, waiting 200ms then 800ms. If it still fails, the page read is a missing pointer and renders `not_yet_available`. With `BLOB_READ_WRITE_TOKEN` unset the page and health reads do not call Blob. The same read contract covers gas, the directory lookup, and Northern Ireland. The projects page reads the checked-in register. The TEC Blob get uses the same retry and still throws, so a failed publish leaves the previous pointer. Puts stay fail-closed. Storage and whole energy do not read Blob. Success revalidates `/system/constraints`, `/api/v1/constraints`, and `/data-health`. It does not revalidate `/`.

No boundary map is drawn. The day-ahead explorer is a table. Labels stay the sentences in `src/lib/constraints/copy.ts`.

### P1B.2 Electricity storage

`/system/storage` is `force-static` with `revalidate` 1800. `/` stays `force-static` with `revalidate` 300 and does not import this page. No new Tinybird pipe and no request-path query. Charging and discharge are read from the warmed 24h `generation_5min_range` envelope via `peekWarmedPipe` (`loadWarmedStorageGeneration`). A miss renders "Not yet available" for the monitored fleet. Tinybird impact **+0**. The scheduled success path stays 378.

The inventory is pumped storage and batteries. Operating pumped storage uses the plant register: a REPD row and a DUKES row that share an asset count once, and only `counts: true` megawatts (DUKES for pumped storage). Batteries and pumped-storage projects that are not operating come from `data/catalogue/storage_records.ndjson`, parsed from the same REPD Q2 2026 extract (`desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z`). Northern Ireland rows are omitted. A REPD co-location pair of the same technology counts once. `scripts/catalogue/storage-records.ts` rewrites that file from a local REPD CSV and drops refs already in `source_entity_mappings.ndjson`. The plant register still skips batteries. Proposed and other non-operating rows stay out of the operating total.

Rated capacity is MW. Energy capacity is MWh. REPD and DUKES do not publish MWh in the extracts Grid holds, so the page does not render an energy column or a nominal-duration column. One line under the table says the registers publish rated power only. Nominal duration, when both figures exist, is energy capacity divided by rated capacity. The column tooltip is `DURATION_TOOLTIP`: "A ratio of the two capacities, not a guaranteed running time." Shares use `displayedPercents`. Displayed megawatts use `largestRemainder` at 0.1 so the rows sum to the total. A missing figure is left out of the sum.

The monitored fleet is the FUELINST `PS` fuel: transmission-connected pumped storage. A positive sample is discharge. A negative sample is charging. FUELINST does not publish batteries as their own fuel type, so the page says they are not reported separately by the source and does not treat that absence as zero. A missing `PS` sample stays "Not yet available". A one-sided total is omitted. Grid does not infer a state of charge. "Storage fleet covered" is that pumped-storage population's operating capacity, shown as covered megawatts of the same total (`2900.0 of 2900.0 MW` for the plant register). It is not a count of stations. The method is the footnote on the card. The inventory is not the monitored fleet.

The System nav item is `{ id: "storage", label: "Storage", href: "/system/storage" }` in `SYSTEM_NAV_ITEMS` (`src/lib/nav.ts`). The header shows it because the route is in `SHIPPED_PAGE_ROUTES`. Generation, demand, carbon, and transfers stay in that array and stay out of the header and the sitemap. `/data-sources` mentions the inventory on the REPD and DUKES rows and the FUELINST read on the Elexon row. `/data-health#storage` lists pumped storage, battery discharge, and storage charging. The open-graph page id is `storage`.

### P1B.4 Whole energy

`/system/whole-energy` is `force-static` with `revalidate` 86400. `/` stays `force-static` with `revalidate` 300. The homepage does not import `src/lib/whole-energy`. No cron. No new Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378.

One edition is checked in at `data/catalogue/whole-energy.json`. `npm run catalogue:whole-energy` (`scripts/catalogue/whole-energy.ts`) is the one-shot. `--offline` reads `data/catalogue/raw/`, which is gitignored, and fails if that cache is missing. It does not fall through to HTTP. The script checks the release id before it writes `whole-energy.json`. A changed extract with the same publication time throws and leaves the checked-in edition. A matching rerun appends one `ingestion_runs.ndjson` line and does not rewrite the release line. A new extract appends one immutable `source_releases.ndjson` line and one ingestion run.

The value source is DUKES 2026 table 1.1, ktoe, gross calorific values, published 30 July 2026. `1 toe = 11,630 kWh, so 1 ktoe = 0.01163 TWh.` Cells are stored at 0.01 ktoe. Shown to 0.1 TWh. Geography is UK, an annual statistic. The page says `UK, annual statistic.`

The label is `Whole energy flows` and `TWh, year {year}.` The title is `How Britain's energy fits together | Grid`. The H1 is `How do electricity, gas, oil, heat and transport fit together?` The standfirst is `Annual figures for {year} from the official energy balance. These are not today's figures.`

One path: natural gas primary supply, then gas used for power generation, then final electricity. The transformation input is already inside primary supply and is not added again. Statistical difference is kept as its own row. Homes, transport, and industry are selectable. Homes is included in Other. A percent names `of primary energy supply` or `of final consumption`. Displayed parts use `reconcileSignedDisplay` so each shown group sums to its shown total. A single share uses `displayedPercents` and is not rescaled against a different base.

Dataset `desnz-dukes:dukes-1.1` is on the existing `desnz-dukes` source, cadence `P1Y`. `WHOLE_ENERGY_METRICS` is not part of `METRICS` and is not listed on `/data-health`. Attribution is `OGL_V3_ATTRIBUTION` (`Contains public sector information licensed under the Open Government Licence v3.0.`).

The System dropdown adds `{ id: "whole-energy", label: "Whole energy", href: "/system/whole-energy" }` after Storage in `SYSTEM_NAV_ITEMS`. The route is in `SHIPPED_PAGE_ROUTES` and the sitemap. The open-graph image is a file route with an empty snapshot. Page id is `whole-energy`.

### P1B.5 Northern Ireland

`/electricity/northern-ireland` is `force-static` with `revalidate` 1800. `/` stays `force-static` with `revalidate` 300. The homepage does not import the EirGrid reader, the release, or `releases/eirgrid-ni`. No new Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378. Workflow **+24** runs a day (1 run + 4 steps × 2 events × 24).

Source is the EirGrid Smart Grid Dashboard. `eirgrid-group` cadence is `PT1H`. Licence URL is `EIRGRID_GROUP_LICENCE_URL`, read on `EIRGRID_GROUP_LICENCE_READ_ON` (`2026-10-15`). Attribution is `EIRGRID_GROUP_ATTRIBUTION` (`Supported by EirGrid Group Data`). Chart lines stay `SONI_SOURCE_LINE` (`Source: SONI.`) and `SEMO_SOURCE_LINE` (`Source: SEMO.`). The licence credit is once on the page, on the open-graph card, and on `/data-sources`.

`/api/cron-northern-ireland` (`15 * * * *`) requires `CRON_SECRET` and fails closed. The route only calls `start(eirgridNi)`. It does not fetch EirGrid. `src/workflows/eirgrid-ni.ts` is four steps: the Redis `SET NX` slot lock (`eirgrid` slot, 50 minutes, floored to minute 15 of the current hour, or the previous hour when the clock is earlier than minute 15), the paced GETs, validate, then publish. `maxRetries` is 2. A 429, a 5xx, or a request that does not finish within 10 seconds throws `RetryableError`. The next failure is `FatalError` and leaves `releases/eirgrid-ni/latest.json` on the previous release. The latest and previous pointers are written after the catalogue lines and revalidation.

Blob layout, with `BLOB_READ_WRITE_TOKEN` (never logged): `releases/eirgrid-ni/<release_id>.json`, `releases/eirgrid-ni/latest.json`, `releases/eirgrid-ni/previous.json`, and the raw extract. Catalogue lines for each new release go under `releases/eirgrid-ni/catalogue/`. Each area uses that feed's `LastUpdated`. Market pricing has no publisher time, so its release id is the content hash. The raw market extract drops `IMBALANCE_SETTLEMENT_PRICE_GBP` before it is stored. The checked-in catalogue already has one registration release per feed area. `EIRGRID_METRICS` is not part of `METRICS`. Geographies `GB`, `NI`, `IE`, and `ALL_ISLAND` stay distinct. `geography_id=UK` on an operational metric, and any request that combines GB and NI, returns `unsupported_dimension`. Nothing in the app adds a GB figure to an NI figure.

The page title is `Northern Ireland electricity (outside GB) | Grid`. The H1 is `What's powering Northern Ireland?`. The scope banner, empty sentence, latest sentence, and partial sentence are the constants in `src/lib/eirgrid/copy.ts`. The scope switch is `Northern Ireland` and `All-island`. SEMO prices stay in euro. No sterling conversion is stored or shown. The latest sentence uses measured SONI times. Shares use `displayedPercents` on one fuel interval. A fuel missing at that interval omits the shares and the page uses the partial sentence. Tests, CI, and local builds leave the Blob token unset and read `tests/fixtures/eirgrid/release.json`. Health reads Blob only, so a missing pointer is not yet available.

The System dropdown adds `{ id: "northern-ireland", label: "Northern Ireland (outside GB)", href: "/electricity/northern-ireland", dividerBefore: "Outside GB" }` after Projects. It is the last item in `SYSTEM_NAV_ITEMS`. The header shows it because the route is in `SHIPPED_PAGE_ROUTES` and the sitemap. GB pages that show the Moyle link use `NI_FLOW_NOTE` (`Flows to and from Northern Ireland. NI figures are on a separate page.`). `/data-health#northern-ireland` lists the EirGrid series. The open-graph page id is `northern-ireland`. Success revalidates `/electricity/northern-ireland`, `/api/v1/northern-ireland`, and `/data-health`. It does not revalidate `/`.

### P1B.3 Projects, TEC, diffs

`/projects` and `/projects/[id]/[slug]` are `force-static` with `revalidate` 86400. A wrong slug or a bare id 308s to the canonical slug. An unknown id is 404. `/` stays `force-static` with `revalidate` 300 and does not import `src/lib/projects`. No new Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378.

The register is checked-in: `data/catalogue/energy_projects.ndjson`, `project_merges.json`, and `change_events.json`. `npm run catalogue:projects` (`scripts/catalogue/build-projects.ts`) reads a local REPD CSV and a TEC CSV. The raw files stay in `data/catalogue/raw/`, which is gitignored. Northern Ireland REPD rows are omitted. Each project stores `country` and `region`. REPD fills both from the extract. A REPD file with no Region column is rejected. TEC leaves both null. The importer diffs the register already on disk against the snapshot it is about to write (`diffAgainstPrevious`). A missing previous file writes no events. It does not diff the new snapshot against itself. `scripts/catalogue/project-diff.ts` writes the same file from two snapshot JSON files. A row missing from the newer snapshot is comparison `not_in_release`. The word cancelled is not written. A blank TEC `MW Effective From` stays null. A non-empty value that is not a calendar date rejects the file. Every invocation appends one `ingestion_runs.ndjson` line. `started_at` and `finished_at` are the import clock. A repeated TEC release does not rewrite the source release line.

Status columns stay independent: planning status and decision date, construction status and evidence date, connection stage, Gate, agreement status, and dated expected energisation, operational status and commissioning or closure date. `deriveDisplayStage` is `display-stage.v1`. Operational and construction facts win over planning. Unknown planning is never planning refused. A merged project keeps the further status on each axis (`furtherPlanning`, `furtherConstruction`, `furtherOperational`) and that status's source, release, and date. A weaker REPD `proposed` does not hide a TEC `operational` fact. The page shows each underlying status with its source and date. Rated power (MW), connection capacity (MW), and storage energy (MWh) are separate measures. Each aggregate names its measure. Proposed projects are left out of the operating total. REPD and this TEC extract do not publish storage energy, so that card says so. Shares use `displayedPercents`. Displayed megawatts use `largestRemainder` at 0.1.

REPD is the existing `desnz-repd:repd-quarterly` release (`2026-08-03T09:00:03.000Z`, OGL v3). TEC is dataset `neso-open-data:tec-register`, cadence `P3D`, empty `metric_ids`, `register: "projects"`. The checked-in release is the 13 Oct 2026 register, `published_at` `2026-10-13T13:58:33.755Z`, the resource `last_modified` truncated to milliseconds. The Gate column has been on the register since 21 Nov 2025. Attribution is `NESO_OPEN_DATA_ATTRIBUTION` (`Supported by National Energy SO Open Data`). NESO states that aggregated capacity may duplicate entries; the connection card uses that warning. ENA and DNO connection registers are not ingested: no licence was found.

A unique normalised name of at least 10 characters on both registers is one project. `project_merges.json` records `links` and `unlinks`. An unlink reverses that pair. `publish-check` rejects a pair that is both linked and unlinked, a display stage that disagrees with `display-stage.v1`, and the word cancelled.

`/api/cron-tec` is `15 6 * * 1,4`. The route only calls `start(tecRegister)`. It does not fetch NESO. The workflow is four steps: the Redis slot lock (`tec`, 12 hours, floored to 06:15 UTC), one package lookup, one CSV, then publish. `NESO_DATASTORE_MAX_PER_MINUTE` stays 2. About 2 runs a week, 9 events a run. A bad file or a new enum is quarantined under `quarantine/tec/` and the previous pointer stays. Blob layout: `releases/tec/<release_id>.json`, `releases/tec/latest.json`, `releases/tec/previous.json`. The page reads the checked-in register. The cron does not rewrite git. `parseTecProjects` receives the fetched `issued_at`, and each row's release id is `neso-open-data:tec-register:{issued_at}`. Expected energisation is chosen against that publication date. Success revalidates `/projects` and `/api/v1/projects`. It does not revalidate `/`.

`GET /api/v1/projects?display_stage=&limit=&offset=` reads the checked-in register one page at a time. `limit` defaults to 100 and cannot exceed 500. `offset` defaults to 0. An unknown filter, or a limit outside that range, is 400. The response is `{ total, limit, offset, projects }`. `/api` lists that route. No Tinybird query.

The System dropdown adds `{ id: "projects", label: "Projects", href: "/projects" }` after Whole energy in `SYSTEM_NAV_ITEMS`. The route is in `SHIPPED_PAGE_ROUTES`, the sitemap, and `llms.txt`. Title `Energy projects in Britain | Grid`. H1 `What is being built, and how far has it got?` Standfirst `Projects from public registers, with planning, construction and connection status shown separately.` A profile title is `{projectName} | Grid`. H1 `Where is {projectName} up to?` Standfirst `Each status below comes from a named source and date.` A change to the dated expected energisation says `This is a change in the published expectation, not a confirmed commissioning date.` The open-graph image is a file route with an empty snapshot. Page id is `projects`. `/data-sources` mentions the projects register on the REPD row and the TEC register on the NESO row.

### P1B.6 Directory and identifiers

`/directory` and `/directory/identifiers` are `force-static` with `revalidate` 86400. `/` stays `force-static` with `revalidate` 300 and does not import `src/lib/directory`. No Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378. The weekly ISD fetch writes Blob only.

The header label is `Directory and tools`. Below the `md` breakpoint the same item reads `Directory` (`compactLabel`). P1B.7 puts Tools inside that menu. Generation, demand, carbon, and transfers stay out of the header and the sitemap. `/directory` and `/directory/identifiers` are in the sitemap.

Organisations, identifiers, and role assignments are separate arrays on one lookup snapshot. Namespaces are `MPID`, `BM_UNIT_ID`, and `GSP_GROUP`. The same code in two namespaces is two identifiers. `effective_from`, `effective_to`, and `recorded_at` sit on the identifier and on the role assignment. A shared registered name stays two organisations. A shared MPID under two company registration numbers stays two identifiers. Disjoint role windows on one MPID stay separate identifiers, so a gap between them is not current. An expired role has `current: false`. BM Unit IDs may contain a hyphen. A BM Unit's organisation is the participant role with the same MPID, role code, and Effective From Date {MPR}.

The ISD Data Store (`https://datastore.helix.elexon.co.uk/api/ISD`, documented at `ELEXON_ISD_URL`) is publicly available. The BSC Open Data Licence (`ELEXON_BSC_OPEN_DATA_LICENCE_URL`) covers information Elexon identifies as open data. The ISD page does not make that identification, and nothing on it forbids displaying a lookup. Redistribution of an extract is source-blocked. `GET` and `POST /api/v1/identifiers/export` return 403 `{ "error": "redistribution not permitted" }`. A lookup with `export` or `format=csv` returns the same 403. The snapshot stores the lookup fields only: organisation name, scheme, code, GSP group label, role code, role name, and the dates. Company registration number is the organisation key (`org_…`) and is not a separate column. Distributor short code, trading party id, and ISO country are not stored. The raw CSV is not written to Blob. The snapshot object is a private blob. The lookup API is the read path.

`GET /api/v1/identifiers?scheme=MPID&code=…&effective_on=…` looks up one code. `name` is a separate search, 2 to 80 characters, capped at 20 organisations. Each of those organisations returns every identifier on it. `POST /api/v1/identifiers/resolve` accepts at most 20 codes. The log line is `{ count }`. Codes are not logged. With `BLOB_READ_WRITE_TOKEN` unset, the API uses `tests/fixtures/directory` (synthetic rows, not an ISD extract). A missing Blob pointer is `Not yet available`.

`/api/cron-directory` runs `15 6 * * 1`. It requires `CRON_SECRET` and fails closed. A missing blob token returns before the ISD request. The fetch is five entity CSVs (`ISDEntity1`, `ISDEntity18`, `ISDEntity21`, `ISDEntity45`, `ISDEntity61`), never `Filter=Full`. An unknown column leaves `releases/directory/latest.json` on the previous pointer. The same extract does not mint a second immutable file. When that file is already stored, the run moves the pointer and does not write it again. Success revalidates `/directory` and `/directory/identifiers`. It does not revalidate `/`.

Page copy is `DIRECTORY_TITLE`, `DIRECTORY_H1`, `DIRECTORY_STANDFIRST`, `IDENTIFIERS_TITLE`, `IDENTIFIERS_H1`, `IDENTIFIERS_STANDFIRST`, `MPID_LABEL`, and `ROLE_LABEL` in `src/lib/directory/copy.ts`. Effective lines are `Valid from {date} to {date}` and `Valid from {date}, no end date published`. Attribution is `ELEXON_ISD_ATTRIBUTION`.

Rollback: read `releases/directory/previous.json`, overwrite `releases/directory/latest.json` with that pointer, and leave the immutable release file in place.

### P1B.7 Tools, changes, and API docs

`/tools` and `/changes` are `force-static` with `revalidate` 86400. `/api` stays `force-static` with `revalidate` 86400 and still calls `loadHomepagePayload`. `/` stays `force-static` with `revalidate` 300 and does not import these pages. No new Tinybird pipe. Tinybird budget **+0**. The scheduled success path stays 378. `GET /api/v1/changes` is `force-dynamic` and reads the checked-in file. It does not call `queryPipe`.

`data/catalogue/tools.json` is the curated list. Zod is `toolsFileSchema` in `src/lib/tools/schema.ts`. `publish-check` runs `checkToolsFile` for the full register. Each row has provider, purpose, sector, geographic coverage, an `https` URL, access, `last_verified`, and `integrates` or `links_out`. `cost` is present only when it was checked; the checked-in file uses `Free` or omits it. Rows are grouped by task: understand a bill, find a network operator, find an official outage service, investigate a connection, find a code, access a dataset, explore planning or network evidence. A Grid URL must be in `SHIPPED_PAGE_ROUTES`. Coverage must not use `UK` as a word. `United Kingdom` stays on the DUKES and whole-energy rows, which are UK statistics. The report path is the mailto and the GitHub new-issue URL on the file. There is no form. Title `Energy tools and official services | Grid`. H1 `Where do I go to do this?` Standfirst `Official and useful services, grouped by task. Grid links to them; it does not run them unless marked.` An integrates row is marked `Runs on Grid`. The open-graph page id is `tools`.

Operator pages that did not return 200 during curation are omitted: ENA's operator finder, Powercut 105, UK Power Networks, SP Energy Networks, Northern Powergrid, and Electricity North West. The NESO DNO page on the tool row is the path that answered 200. The GitHub new-issue URL is on the page; the repository is private, so an unsigned-in visitor gets 404 and the mailto is the public path. `publish-check` does not fetch the URLs again.

`/changes` is built only from `data/catalogue/change_events.json`. That file is the TEC and project field diff. It does not contain whole-energy year changes or NESO constraint revisions. Every event has `old`, `new`, `old_release_id`, and `new_release_id`. `comparison` is `field`, `not_in_release`, or `correction`. A correction supersedes every earlier event for the same entity and field. File order wins. Superseded rows stay on the page. Sentences come from `changeSentence` in `src/lib/changes/template.ts`. There is no model call on the page or `GET /api/v1/changes`. `src/app/changes/module-graph.test.ts` walks both import graphs. Title `What changed in Britain's energy system | Grid`. H1 `What has changed, and how do we know?` Standfirst `Changes found in published data, each with its source and comparison.` The count on the card is the number of rows. The open-graph page id is `changes`.

`GET /api/v1/changes?entity_id=&cursor=` pages 20 rows. The cursor is `v1:<index>`. `next_cursor` is empty on the last page. An unknown `entity_id`, including an empty one, is 404 `Unknown ID.` A known entity with no rows, or a cursor past the end, is 404 `No results for these filters.` `scope` or `geography` other than `GB` is 400 `This scope is not supported.` A repeated value is checked too, so `scope=GB&scope=NI` is rejected. An unknown query key is 400 `unsupported filter`. Each catalogue read uses `AbortSignal.timeout` (`CHANGES_READ_TIMEOUT_MS`, 5 seconds). A missing file, or a read that times out, with nothing held in the process is 503 with that source-unavailable sentence and no body rows. A later failure in the same process returns 200, `notice` is that sentence, and the last successful file is the body. A 200 body includes `sources`. Success does not revalidate `/`.

`/api` renders the sentences in `src/lib/api/copy.ts`. The intro, conventions, error lines, licence line, and endpoint summaries are the specified text. The intro says electricity refreshes hourly. `vercel.json` runs `/api/cron` at `*/30 * * * *`. Physical gas stays hourly (`5 * * * *`). Oil and gas prices stay every 6 hours (`30 */6 * * *`). The intro is not rewritten. `/api` also says `The limit is 60 requests a minute.` Assets and `assets/[id]` are omitted because those routes do not exist. `areas` is omitted. `GET /api/v1/northern-ireland` exists and is not in the one-liner list. Older `/api/snapshots`, `/api/generation`, `/api/interconnectors`, `/api/prices`, `/api/dashboard`, and `/api/look-ahead` still exist and are not in that list. Not every existing JSON body carries unit, interval, source, publication time, fetch time, `forecast_issued_at`, `sources`, or a cursor. Projects still uses `limit` and `offset`. `GET /api/v1/map/layers` stays `force-static` and does not reject extra query parameters. Title `Grid API: public energy data in JSON | Grid`. H1 `What data can I get from Grid, and how?`

`scopeRejection` and `unsupportedFilter` in `src/lib/api/errors.ts` are wired on gas overview, gas series, projects, constraints, identifiers, data-health, and changes. Every repeated `scope` or `geography` value has to be `GB`. An empty projects filter is 404 `No results for these filters.` Data-health throws become 503 with the source-unavailable sentence and no invented readings. The data-health JSON keeps readings whose geography is `GB` or `GB_NTS`. Northern Ireland, Ireland, UK annual figures, and commodities outside GB are left out of that response. The data-health page still loads the full `loadDataHealth` list.

The header keeps `Directory and tools` (`compactLabel` `Directory`) as a menu of Directory and Tools, then a Changes link, then API. Footer `SITE_NAV_LINKS` includes Tools and Changes. Sitemap: `/tools` monthly, `/changes` weekly. Both routes are in `SHIPPED_PAGE_ROUTES` and `llms.txt`.

### Map flows

`/map` is `force-static` with `revalidate` 1800. The page is full-bleed (`100dvh` minus the 64px header). `/` stays `force-static` with `revalidate` 300 and does not import MapLibre. Tinybird budget **+0**. The scheduled success path stays 378. `/map` does not call `queryPipe` or `/api/interconnectors`.

Default view is Flows: interconnectors and gas entry points on, power stations and projects off. Projects stay off until each one has a coordinate and a country. The straight-line label is `Straight line, not the cable route.` Moyle's counterparty is Northern Ireland, outside GB. While interconnectors are on, the panel links `NI_FLOW_NOTE` to `/electricity/northern-ireland`. Landing points and gas terminal pins are GeoNames, CC BY 4.0 (`GEONAMES_ATTRIBUTION`). `readLinkCatalogue` puts that sentence on interconnector and gas-terminal asset pages next to the Elexon or National Gas line. `/data-sources` lists the GeoNames source. `/map?sel=<id>` opens that flow, or a station once the stations layer has loaded. Interconnector asset pages add `layers=ic`.

Electricity and capacity are written to `releases/map/flows/latest/electricity.json` from the warmed `interconnector_flows` 24h envelope at the end of `publishStep`. Gas terminal rates are written to `releases/map/flows/latest/gas.json` from the National Gas instantaneous flow API inside the existing hourly gas publish step (`publishMapGasFlows`), not a new cron. Each feed replaces only its own pointer, so the two workflows do not read-modify-write one file. `releases/map/flows/latest.json` is a legacy combined pointer, read only to fill a feed that has no per-feed file yet, or a null capacity on the electricity pointer. Capacity is the NESO Interconnector Register Built rows, stored on the electricity pointer and refreshed at most once per UTC day. A miss leaves that feed's previous pointer. A net gas total is shown only when every catalogue terminal has a sample. Otherwise the panel says the coverage is partial and omits the total. Station points are `GET /api/v1/map/stations` (Blob `releases/map/stations/latest.json` when that file exists, otherwise the checked-in register) and are not in the `/map` HTML. That layer uses `TODAY_GROUPS` and `MAP_SIZE_STEPS`. Northern Ireland is left out. A missing megawatt is not drawn. The Power stations preset turns the flow layers off and the stations layer on. While stations are on, the footer names DESNZ REPD and DUKES, then `OGL_V3_ATTRIBUTION`, plus the edition stamp from `today-card.json`.

Direction words are `Importing to GB`, `Exporting from GB`, `Into the GB system`, and `Out of the GB system`. Widths are 2, 4 and 6 px. Chevrons drift on a 2.4 s cycle, stay static under `prefers-reduced-motion`, and pause when the tab is hidden or the reading is stale (60 min electricity, 2 h gas). The staleness clock ticks once a minute and pauses while the tab is hidden. A null spark sample starts a new line. A missing reading is `—`. The keyboard list is north to south. `/assets?preset=flows` is the table fallback. Map clicks read stations through a ref so a marker click still opens the inspector after the stations request returns.

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
BLOB_READ_WRITE_TOKEN=<optional — basemap upload and gas Blob publish, never log it>
INDEXNOW_KEY=<optional — post-deploy one-shot only; must match the public key file; never log it>
# Also accepted: KV_REST_API_URL / KV_REST_API_TOKEN from the Marketplace integration
```

### How tokens work
- `TINYBIRD_TOKEN` — Workspace admin token. Used by `/api/cron` and `scripts/backfill.ts` to ingest data via Events API.
- `TINYBIRD_READ_TOKEN` — Auto-generated `dashboard_read` token (defined via `TOKEN dashboard_read READ` in pipe files). Required for pipe queries. There is no fallback to the admin token.
- `CRON_SECRET` — Required. Cron routes fail closed if it is unset.
- Tokens are created via `tb --cloud deploy` (Tinybird Forward requires resource-scoped tokens in data files, not via CLI `token create`).

### Redis is optional

Production sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the Marketplace `KV_REST_API_*` pair). That is what holds the slot lock, the 450/day Tinybird counter, workflow step bodies, the warmed envelopes, and the optional gas pointer `grid:gas:latest`. The scheduled success path stays **378** Tinybird ops. Gas publish is Tinybird +0.

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
- `/api/cron-gas` — fail closed without `CRON_SECRET`, starts the intraday workflow, no National Gas fetch in the route
- `/api/v1/gas/overview` and `/api/v1/gas/series` — Blob reads; unknown metric is 400
- `/api/health` — freshness of snapshots / generation / embedded / prices, plus `GAS_METRICS` from the Blob bundle pointers; 503 if a critical grid stream is stale. Gas is non-critical
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
