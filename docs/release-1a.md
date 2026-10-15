# Phase 1A release

Phase 1A is the checked-in catalogue, the Blob basemap and gas releases, and the pages `/`, `/gas`, `/map`, `/assets`, `/data-sources`, `/data-health`, and `/methodology`. Tinybird success path stays **378** ops/day. This step adds **+0**.

## Smoke

After the production alias moves:

1. `GET /api/health` returns `ok: true`. Critical streams are snapshots. Gas metrics are present and non-critical. A gas metric with no component is `not_yet_available` and `published_at: null`. A stored `0` stays `0` with `state: null`.
2. `GET /gas`, `/map`, `/assets`, and one `/assets/ast_…/…` page return 200. Each footer uses a string from `src/lib/attribution.ts`. National Gas is exactly `Data sourced from the National Gas Transmission Data Portal.`
3. `/data-sources` lists National Gas (consent 14 Oct 2026), DESNZ REPD, DESNZ DUKES, NESO DNO areas (OGL v3 and the accuracy caveat), OS Open Zoomstack (OGL v3 and the OS credit with year), and SAP inside the National Gas row. The page does not mention OilPriceAPI or a TTF daily series.
4. `GET /sitemap.xml` includes `/gas`, `/map`, `/assets`, and every asset, interconnector, and gas-terminal path. It does not include `/system/generation`, `/system/demand`, `/system/carbon`, `/system/transfers`, or `/directory`.
5. `/` stays `force-static` with `revalidate` 300. It does not load MapLibre and does not request Tinybird, National Gas, or Blob.
6. Open-graph images for `/gas`, `/map`, `/assets`, and an asset page render at 1200×630. Titles wrap. The cards do not say live, real-time, right now, or UK.

IndexNow is a post-deploy one-shot. `.github/workflows/indexnow.yml` runs on `workflow_dispatch` and on a push to `main` that changes `data/indexnow/release-1a.txt`, `public/release-1a.txt`, or the workflow file. It reads `INDEXNOW_KEY` from the GitHub secret, checks it against the committed public key file, and waits until production serves `public/release-1a.txt` with the body `phase-1a`. A 200 from `/gas` does not count. The sitemap is fetched with `cache: no-store` and `?release=phase-1a`. If that marker is absent after 10 minutes, the job exits without posting. The key is redacted from logs. `npm run indexnow` remains the full-sitemap command and is not this path.

## Gas cron, 15 Oct 2026

`/api/health` showed every `gas.gb_nts.*` metric as `not_yet_available` with no `published_at` after #64 and #65. That reading was the state before the first scheduled run, plus the health CDN cache.

- `#64` (`1bcfad9`) was Ready at 2026-10-15T08:15:22Z. `#65` (`09dee1f`, production alias) was Ready at 2026-10-15T08:44:30Z.
- The only gas schedule is `vercel.json`: `/api/cron-gas` at `5 * * * *`. There is no GitHub Actions cron. The route is fail-closed on `CRON_SECRET` and is excluded from the rate limit. It starts `gasIntraday` and does not fetch National Gas itself.
- The 08:05 UTC slot ran before the route existed. The first slot after deploy was 2026-10-15T09:05:00Z.
- Production log: `GET /api/cron-gas` at 2026-10-15T09:05:45.097Z, `[cron-gas] started`, run `wrun_01M4ZCYWBRGAX1VWYN9F5TGS6T`.
- Blob then served `releases/gas/latest.json` and `releases/gas/latest/intraday.json` (`release_id` `13157e43e43f2cc58880b23b753c9700d6d9804a03b152c2e7d496611884ae4b`, `generated_at` 2026-10-15T09:05:44.822Z). The release attribution matches `NATIONAL_GAS_ATTRIBUTION`. Components are `PUBOB2042`, `PUBOB2043`, and `PUBOB2044` only. Quarantine is empty.
- A direct portal CSV for the same intraday id list and gas day returned those three physical-entry series and nothing else. `PUBOB19`, `PUBOB29`, `PUBOB30`, and `PUBOB31` each returned an empty body when requested alone. Health correctly leaves those metrics `not_yet_available`.
- `releases/gas/latest/completed-day.json` and `releases/gas/previous.json` were 404. The completed gas day is a step on the prices workflow (`30 */6 * * *`), not on `/api/cron-gas`. The 06:30 UTC prices run was before #64. The next completed-day write is the 12:30 UTC prices run. P1D gas metrics stay `not_yet_available` until that pointer exists.
- Health at 08:49:26Z was the CDN body (`s-maxage=300`, `stale-while-revalidate=86400`) from before the slot. A cache-busted `GET /api/health` at 09:07:49Z had `published_at` `2026-10-15T09:05:00.000Z` and `state: null` on the three physical-entry metrics, and `not_yet_available` on the other 21.
- Health reads `releases/gas/latest/intraday.json` and `releases/gas/latest/completed-day.json` via `loadBundleReleases`. It does not read `releases/gas/latest.json` for the metric rows. No code change. The empty board before 09:05 was the first slot not having run.

## Rollback

1. In the Vercel project, promote the previous production deployment. Do not rebuild it.
2. Gas pointers, in order, using the Blob token and without printing it:
   - Read `releases/gas/previous.json`. If it exists, overwrite `releases/gas/latest.json` with that pointer.
   - Point `releases/gas/latest/intraday.json` and `releases/gas/latest/completed-day.json` at the prior release for that bundle. If a bundle had no prior release, delete that pointer.
   - Delete Redis key `grid:gas:latest`.
   - Leave immutable `releases/gas/<release_id>.json` files in place.
3. Map, DNO, and Zoomstack follow the previous deployment's `layers.json` and style URL. Do not delete the Blob PMTiles archive.
4. A Redis read error falls through to the Blob pointer. `/api/health` can keep a CDN body for up to 300s after the pointer moves, and longer while stale-while-revalidate is in flight.

## On-call

Source schema changes, including a National Gas catalogue hash change, are **Alex**.

## Not in 1A

- Transmission lines
- Grid supply points
- Gas terminal pins
- Gas flows by terminal on the map
- Instantaneous-flow API (the spike recorded an anonymous `/sites` response and does not parse it)
- Real cable routes (interconnectors are schematic)
- Unit-level output
- Storage inventory

## §21 test matrix

| Case | Test |
| --- | --- |
| Stale publication | `src/lib/data-health.test.tsx` "renders the source published clock 09:00 with a stale flag when Grid retrieved it at 12:00"; `src/lib/gas/pipeline.test.ts` "marks intraday stale after 3 hours and leaves a completed gas day current"; `src/lib/data-health.test.tsx` "keeps a gas day fresh until the afternoon after National Gas publishes" |
| No result → null | `src/lib/ingest/national-gas/parse.test.ts` "stores a blank value as null"; `src/lib/release/gate.test.ts` "reads an empty gas bundle as not yet available" |
| Genuine zero | `src/lib/ingest/national-gas/parse.test.ts` "stores a genuine zero"; `src/lib/release/gate.test.ts` "keeps a genuine zero and leaves a missing series unpublished" |
| Revision | `src/lib/gb-gas-sap.test.ts` "keeps the last row when the same gas day appears twice"; `src/lib/gas/pipeline.test.ts` "replays catalogue and series without moving a newer pointer" |
| New enum quarantine | `src/lib/ingest/national-gas/parse.test.ts` "quarantines an unknown basis and keeps an unknown column" |
| Clock change | `src/lib/ingest/national-gas/parse.test.ts` "uses 23 hours across the March 2026 clock change and 25 across October" |
| Partial day | `src/lib/gas/page-model.test.ts` "never compares a partial day with a complete day on a different basis" |
| Cumulative vs rate | `src/lib/ingest/national-gas/parse.test.ts` "does not sum cumulative readings" and "does not sum rates" |
| Mixed units | `src/lib/gas/pipeline.test.ts` "reconciles the completed-day fixture without summing rates or children" |
| Same asset in two registers | `src/lib/catalogue/assets/assets.test.ts` "counts a coordinate match once" and "counts Drax biomass units from REPD and drops the DUKES double" |
| Approximate coordinates | `src/lib/catalogue/assets/assets.test.ts` "keeps a station with no coordinates and never emits (0, 0)"; `src/lib/assets/build.test.ts` precision label "Published, approximate"; `src/lib/release/gate.test.ts` "keeps approximate coordinates and refuses the origin" |
| Unknown owner | `src/lib/release/gate.test.ts` "records an operator and never an owner" |
| WebGL or tile failure, list still usable | `src/lib/release/gate.test.ts` "keeps the asset list when the basemap fails". The map page renders `#asset-list` beside the map. Layout guard aborts `pmtiles` and Blob tile requests. |
| Copied map filter | `src/lib/release/gate.test.ts` "copies a map filter into the query string the directory reads" |
| Partial ingest failure keeps the release | `src/lib/gas/pipeline.test.ts` "quarantines a malformed CSV and keeps the previous pointer" |
| Export metadata | `src/lib/ingest/national-gas/parse.test.ts` "matches the committed fixture"; `src/lib/release/gate.test.ts` "stamps export metadata and route credits from the attribution module" |
| Synthetic fixture fails publish | `src/lib/catalogue/publish-check.test.ts` "rejects a synthetic National Gas publication" |

Sitemap, open-graph, and data-source checks: `src/app/sitemap.test.ts` "includes interconnectors and leaves unbuilt routes out"; `src/lib/og/image.test.tsx` "wraps long asset titles and keeps the 1A cards free of live wording"; `src/lib/attribution.test.ts` and `src/lib/catalogue/publish-check.test.ts` for the new source rows and the OilPriceAPI / TTF ban on `/data-sources`.
