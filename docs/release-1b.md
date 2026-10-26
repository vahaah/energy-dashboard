# Phase 1B release

Phase 1B is constraints, storage, the UK annual energy balance, Northern Ireland, projects and the TEC register, the ISD directory, tools, changes, and the API reference. Tinybird success path stays **378** ops/day. This step adds **+0**.

`/map` flows landed in #74 and `/pipeline` landed in #76. Both are in this gate.

## Smoke

After the production alias moves:

1. `GET /api/health` returns `ok: true`. Critical streams are snapshots. Gas metrics stay non-critical. Constraint, storage, and EirGrid rows may be `not_yet_available` until their pointers exist.
2. `GET /system/constraints`, `/system/storage`, `/system/whole-energy`, `/electricity/northern-ireland`, `/map`, `/pipeline`, `/projects`, one `/projects/epj_…/…` page, `/directory`, `/directory/identifiers`, `/tools`, `/changes`, and `/data-sources` return 200.
3. `/data-sources` credits NESO constraints and the TEC register with `Supported by National Energy SO Open Data`. The licence URL is `https://www.neso.energy/data-portal/neso-open-licence` (the previous path 404'd). DESNZ REPD, DUKES, and the energy flow chart are Open Government Licence v3.0. EirGrid is `Supported by EirGrid Group Data`, re-read on 20 Oct 2026. Elexon BMRS keeps `Contains BMRS data © Elexon Limited copyright and database right {year}.` The ISD row says the store is publicly available and that Elexon has not identified ISD under the BSC Open Data Licence. GeoNames is `Place coordinates from GeoNames, CC BY 4.0.` The page does not mention OilPriceAPI or a TTF daily series.
4. `GET /sitemap.xml` includes `/system/constraints`, `/system/storage`, `/system/whole-energy`, `/electricity/northern-ireland`, `/map`, `/pipeline`, `/projects`, `/directory`, `/directory/identifiers`, `/tools`, `/changes`, and every project path. It does not include `/system/generation`, `/system/demand`, `/system/carbon`, or `/system/transfers`.
5. The System menu shows Constraints, Storage, Whole energy, Projects, Pipeline, and Northern Ireland (outside GB). Generation, demand, carbon, and transfers stay out of the header and the sitemap.
6. `/` stays `force-static` with `revalidate` 300. It does not load MapLibre and does not request Tinybird, National Gas, or Blob.
7. Open-graph images for the 1B pages, including `/pipeline`, render at 1200×630 from an empty snapshot. The cards do not say live, real-time, right now, or UK. Directory and identifier cards use the ISD attribution. The pipeline card uses the Open Government Licence sentence.

IndexNow is the same post-deploy one-shot as Phase 1A, now waiting on `public/release-1b.txt`. `.github/workflows/indexnow.yml` runs on `workflow_dispatch` and on a push to `main` that changes `data/indexnow/release-1b.txt`, `public/release-1b.txt`, the Phase 1A marker files, or the workflow file. It reads `INDEXNOW_KEY` from the GitHub secret, checks it against the committed public key file, and waits until production serves `public/release-1b.txt` with the body `phase-1b`. A 200 from `/gas` or from `/release-1a.txt` does not count. The sitemap is fetched with `cache: no-store` and `?release=phase-1b`. If that marker is absent after 10 minutes, the job exits without posting. Paths already submitted in Phase 1A (`/`, the pre-1A set, `/gas`, `/map`, `/assets`, and `/assets/…`) are not posted again. `/pipeline` was not in that set, so this one-shot posts it. The key is redacted from logs. `npm run indexnow -- --all` remains the full-sitemap command. The default submits URLs newer than the stored marker. A missing marker submits every URL and does not fail the run. That command is not this path.

## Licence read, 20 Oct 2026

| Source | What was read | Result |
| --- | --- | --- |
| NESO Open Licence | `https://www.neso.energy/data-portal/neso-open-licence` | Attribution stays `Supported by National Energy SO Open Data`. The stored path `/neso-open-data-licence` returned 404. Each dataset is licensed on its own; constraints and the TEC register stay on this sentence. |
| EirGrid Group Open Data Licence | `https://www.smartgriddashboard.com/all/open-data-license/` | Attribution stays `Supported by EirGrid Group Data`. First read 15 Oct 2026. Re-read 20 Oct 2026. Stored releases may carry either date. New releases stamp `2026-10-20`. |
| Elexon BMRS | `https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/` | Attribution stays `Contains BMRS data © Elexon Limited copyright and database right [year].` |
| Elexon ISD and BSC Open Data Licence | ISD page and `https://www.elexon.co.uk/bsc/data/open-data-requests/bsc-open-data-licence/` | The BSC licence sentence is `Contains BSC information licensed under the BSC Open Data Licence.` It applies only to information Elexon identifies as open data. The ISD page does not make that identification. Lookup display stays. An extract download stays refused. |
| DESNZ REPD, DUKES, energy flow chart | Open Government Licence v3.0 | Attribution stays `Contains public sector information licensed under the Open Government Licence v3.0.` |
| GeoNames | `https://www.geonames.org/export/` | CC BY 4.0. Attribution is `Place coordinates from GeoNames, CC BY 4.0.` `/map` uses the cited feature ids for schematic landing points and approximate NTS terminal sites. |

## Rollback

1. In the Vercel project, promote the previous production deployment. Do not rebuild it.
2. Blob pointers, in order, using the Blob token and without printing it. Leave every immutable `releases/<id>.json` file in place.
   - Constraints: read `releases/neso-constraints/previous.json` and overwrite `releases/neso-constraints/latest.json`. Read `releases/neso-constraints/previous/breakdown.json` and `releases/neso-constraints/previous/day-ahead.json` and overwrite the matching `releases/neso-constraints/latest/<bundle>.json`. If a bundle had no prior release, delete that latest pointer.
   - Northern Ireland: read `releases/eirgrid-ni/previous.json` and overwrite `releases/eirgrid-ni/latest.json`.
   - TEC: read `releases/tec/previous.json` and overwrite `releases/tec/latest.json`. The projects page reads the checked-in register, so the previous deployment's git register is the page rollback.
   - Directory: read `releases/directory/previous.json` and overwrite `releases/directory/latest.json`.
   - Map flows: read `releases/map/flows/previous/electricity.json` and `releases/map/flows/previous/gas.json` and overwrite the matching `releases/map/flows/latest/<feed>.json`. Leave each immutable release file in place. A missing stations pointer falls back to the checked-in register.
   - Gas, if this deploy is rolled back with it: read `releases/gas/previous.json` and overwrite `releases/gas/latest.json`. Point `releases/gas/latest/intraday.json` and `releases/gas/latest/completed-day.json` at the prior release for that bundle. Delete Redis key `grid:gas:latest`.
3. Whole energy, the plant register, and the projects register roll back with the previous deployment. Do not delete Blob archives.
4. `/api/health` and the constraint and Northern Ireland pages can keep a CDN body after the pointer moves.

## On-call

Source schema changes are **Alex**.

## Source-blocked, not done

These are not shipped. They stay on this list.

- ISD extract export. `GET` and `POST /api/v1/identifiers/export` return 403 `redistribution not permitted`. A lookup with `export` or `format=csv` returns the same 403.
- ENA and DNO connection registers. No licence was found.
- Northern Ireland coal. The feed publishes coal for Ireland and all-island. It does not publish a Northern Ireland coal series.
- Northern Ireland other fossil. The feed publishes other fossil for Ireland and all-island, not for Northern Ireland.
- Northern Ireland-only SNSP. The feed publishes all-island SNSP. It does not publish a Northern Ireland-only figure.
- Sterling imbalance price. The feed's GBP column is dropped before the extract is stored. SEMO prices stay in euro.

## §21 test matrix

| Case | Test |
| --- | --- |
| Stale publication | `src/lib/release/gate-1b.test.ts` "marks a constraint cost stale after the grace and leaves a fresh EirGrid sample current" |
| No result → null | `src/lib/release/gate-1b.test.ts` "reads a missing constraint value as not yet available and keeps a genuine zero"; `src/lib/storage/operations.test.ts` "is not yet available when the envelope has no storage fuel"; `src/lib/eirgrid/geography.test.ts` "uses the empty sentence when SONI has not arrived" |
| Genuine zero | `src/lib/release/gate-1b.test.ts` "reads a missing constraint value as not yet available and keeps a genuine zero"; `src/lib/data-health.test.tsx` "reports pumping as zero discharge with a fresh published time" |
| Revision | `src/lib/constraints/publish.test.ts` "keeps the previous release when a period is revised and when a file is quarantined"; `src/lib/projects/projects.test.ts` "is deterministic and records a disappearance as not_in_release" |
| New enum quarantine | `src/lib/constraints/constraints.test.ts` "quarantines an unknown boundary and keeps the sign of flow"; `src/lib/projects/projects.test.ts` "collapses TEC stages and quarantines an unknown status"; `src/lib/directory/directory.test.tsx` "refuses an unknown column and a full ISD download" |
| Clock change | `src/lib/constraints/constraints.test.ts` "keeps both instants when the wall clock repeats". Northern Ireland clock change: not covered, reason: the parser uses the shared London wall sequence and no NI fixture walks a 23-hour or 25-hour day. |
| Partial day | `src/lib/eirgrid/geography.test.ts` "uses the partial sentence when a Northern Ireland series is missing" |
| Cumulative vs rate | not covered, reason: 1B does not add a cumulative reading to a rate. Constraint £ and MWh stay on separate axes (`src/lib/constraints/constraints.test.ts` "refuses a forecast series and refuses a shared £ and MWh axis"). Storage keeps discharge and charging apart (`src/lib/storage/operations.test.ts` "shows discharge and charging separately and does not treat a negative sample as discharge"). |
| Mixed units | `src/lib/constraints/constraints.test.ts` "refuses a forecast series and refuses a shared £ and MWh axis"; `src/lib/whole-energy/whole-energy.test.tsx` "converts the checked-in ktoe edition and keeps each share on one base" |
| Same asset in two registers | `src/lib/storage/inventory.test.ts` "counts a co-located REPD and DUKES pair once, on the counted megawatts"; `src/lib/projects/projects.test.ts` "merges on a unique name and unmerge puts the two registers back" |
| Approximate coordinates | `src/lib/assets/directory.test.ts` "places stations in DNO areas and keeps operators searchable"; `src/lib/attribution.test.ts` "passes GeoNames CC BY 4.0 through link pages and the data-sources list". TEC rows keep null coordinates. |
| Unknown owner | not covered, reason: the directory stores organisation names and roles, not owners. Asset owners stay on `src/lib/release/gate.test.ts` "records an operator and never an owner". |
| WebGL or tile failure, list still usable | `src/lib/release/gate.test.ts` "keeps a flows table when the basemap fails" |
| Copied map filter | `src/lib/release/gate.test.ts` "copies a map filter into the query string the directory reads"; `src/lib/map/flows.test.ts` "restores ?sel= and layers=ic from asset pages" |
| Partial ingest failure keeps the release | `src/lib/constraints/publish.test.ts` "keeps the previous release when a period is revised and when a file is quarantined"; `src/lib/eirgrid/pipeline.test.ts` "keeps the previous pointer when revalidation fails" |
| Export metadata | `src/lib/directory/directory.test.tsx` "returns 403 for an export and caps resolve without logging codes"; `src/lib/eirgrid/parse.test.ts` "keeps NI, drops GB and UK, and does not store sterling"; `src/lib/release/gate-1b.test.ts` "records the 20 Oct 2026 licence read and credits GeoNames" |
| Synthetic fixture fails publish | not covered as a catalogue rejection, reason: `tests/fixtures/directory` is synthetic and is the read path when the Blob token is unset. It is not a catalogue release, and publish-check does not ingest it. Redistribution stays 403. |

Sitemap, open-graph, and the System menu: `src/app/sitemap.test.ts` "includes interconnectors and leaves unbuilt routes out"; `src/lib/og/image.test.tsx` "keeps the 1B cards free of live wording and stamps the licence sentence"; `src/lib/release/gate-1b.test.ts` "shows only shipped system items", "includes the shipped /map flows route", "includes the shipped /pipeline route", and "passes an empty snapshot to the 1B open-graph file routes"; `src/lib/indexnow.test.ts` "accepts the phase 1B marker and skips routes the 1A one-shot already posted".
