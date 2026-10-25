# Cloud-agent prompt: finish Critiquito design items on Grid

Repo: https://github.com/vahaah/energy-dashboard (live https://grid.vahaah.com). Branch from latest origin/main (includes f2df2ef). Source review: `docs/audit-2026-10-23/` on branch `audit/2026-10-23` (design.md, fix list). Coverage check of the live site on 25 Oct 2026 found the items below not done or partly done. Fix them, using the shared `formatEnergy`/`<Quantity>`, `<Freshness>`/`<Absent>` and `<TableScroll>` components from PR #90 rather than new one-offs.

## Priority order
1. Regressions/blockers: HOME-02 (375 breakdown labels wrap one letter per line), HOME-01/XS-01 (bottom KPI strip disagrees with hero), MAP-01 (1280 light renders dark), GAS-01 (table expanded above chart), GAS-04/PROJ-02/PROJD-01 (raw codes and "Unknown").
2. Remaining Must-fix items, then Nice-to-have.
3. Also fix: /changes says "Compared NESO (TEC register) of 13 Oct 2026 with 13 Oct 2026" (same date on both sides; it must diff consecutive snapshots).

Split into at most 3 PRs (e.g. cross-site + home/today/gas/NI/map; data pages pipeline/projects/assets/system; content pages api/tools/directory/legal/methodology/sources/records/prices). Skip an item only if it conflicts with a constraint below, and say why in the PR.

## Standing constraints (must hold in every PR)
- Keep the Vercel/Geist design and tokens; no new design system.
- `/` stays `force-static` with `revalidate = 300` and loads no MapLibre (static map card only).
- Tinybird success path stays ≤450 calls/day (currently ~378). Every PR description states its Tinybird call impact (expected: 0).
- No database. Data must be free, licence-permitted and attributed.
- Never print or commit secrets (Tinybird token, BLOB_READ_WRITE_TOKEN, Redis credentials, CRON_SECRET, any credentials file).
- Commits authored as "Cursor Agent".
- Every network read has hard timeouts and bounded retries.
- Labels: /gas says "Britain"/GB; whole-energy says "UK, including Northern Ireland". NI stays on its own page, never mixed into GB figures; NI is not noindexed.
- Displayed sums must reconcile (parts add to shown totals).
- Verify every changed page at 1280, 1024, 768 and 375 in light and dark (Playwright screenshots attached to the PR).
- Before asking to merge, prove `git merge-base --is-ancestor origin/main HEAD` and that the PR is MERGEABLE.
- Fix only Codex's first review round, resolve every thread, never trigger another round, and squash-merge once CI (verify, layout shards 1–4, Vercel) is green.
- After merge, check the live site and /api/health.

## Items by page

### Cross-site (shared components first)
- **XS-01** (partly) Figures disagree between pages: Use a single selector per metric (generation mix, price, intensity, pipeline totals) and print one "as of" stamp per card. Home infrastructure should read the /pipeline aggregate (267.4 GW / 7,668).
  - Live now: Home infra now 267.4 GW / 7,668 = /pipeline. But home KPI strip (Price 42.8 £/MWh, Carbon 72 g, Demand 24.8 GW) still disagrees with hero (£173.37, 101 g, 38.5 GW). home/1280-light.png y≈2500; home/copy.txt
- **XS-02** (partly) Number and unit format: Add a shared `formatEnergy()` that applies separators, switches MW to GW at ≥1,000 MW (1 dp) and renders the unit in a `<span>` at 0.6em `gray-900` with a thin space. Applies to KPI, table and tooltip.
  - Live now: formatEnergy used (NI "1,062 MW", storage "7.8 GW", PROJ "57.4 GW"); still MW at GW scale on /projects tech list ("16,011.0 MW"), /map "Net import 4,630 MW", /assets "9 MW" vs "2.5 MW"
- **XS-03** (partly) Stale, unavailable and partial states: Use one `<Freshness>` component: amber-700 `border-l-2`, the "Not updated" slot and an "as of {London time}" slot. "—" with an `aria-label` slot for the reason, never 0. ◐ Partial shows a tooltip with the reason. Show it once per card, not three timestamp blocks.
  - Live now: Freshness stamp present on home/gas/NI; NI still uses banner + per-row "—"; gas shows Partial on all 4 KPI cards. gas/1280-dark.png
- **XS-04** (partly) Mobile tables and labels: Use `<TableScroll>` with a right-edge fade (gradient from `surface-card`, **proposed**), a sticky first column and a caption "Swipe for more columns" (slot). Below 480 px, switch row-heavy tables to stacked key/value cards. Bar labels go above the bar, never truncated.
  - Live now: TableScroll with sticky first col + "Swipe" caption on /today,/assets,/pipeline,/system/*,/api at 375 (probe.json swipe=true, sticky). Regression: home 375 breakdown labels wrap one letter per line. home/375-light.png y≈700-1400
- **XS-05** (partly) Colour-only encoding (1.4.1): Use direct labels at line ends or bar segments, plus a legend with swatch and text. Map flows get chevrons and width by MW. Stage bars get inline labels with % and a text table alternative.
  - Live now: Pipeline stage bar labelled + legend (done); constraints legend; map flows still single orange with no chevrons; home demand legend shows exports but only grey fill. map/1280-light.png
- **XS-06** (partly) Long pages and unbounded lists: Paginate at 25 rows with a "Show all n" disclosure. Lead with a summary and problems first. Add a sticky in-page TOC at ≥1024 and a "Jump to" select at 375 (closes G-12). Default tables to collapsed.
  - Live now: Show-all disclosures on gas/storage; no sticky TOC / "Jump to" on any page (probe jump=false); home 7,375/11,714 px, tools 9,587 px, data-health 11,886 px
- **XS-07** (partly) Vocabulary: Use one status glossary: *Not published* (source does not publish), *Not updated* (stale), *—* (missing for this period), *Partial* (◐). Pipeline stage names follow COPY v3 ("Consented, not yet built"). Hide unknown fields rather than print "Unknown".
  - Live now: "Not published" used on pipeline/projects; "Unknown" still 52× on /projects, 3× on project detail; "Not available" on storage/asset
- **XS-08** (partly) Time display: Use `formatLondon()` for every UI time, with no ISO or Z strings. Set `lang="en-GB"` on `<html>` and show a format hint next to native date inputs. UTC stays in API docs only.
  - Live now: lang="en-GB", London times on most pages; ISO dates on /system/constraints ("2026-10-11", "2026-10-24")
- **XS-10** (partly) Wording (GB, developer-speak): Slots for page titles: "{What} in Great Britain". Remove implementation terms (Tinybird, payload, envelope, warmed row, UUIDs) from UI copy. **Draft for Writing Bot.**
  - Live now: Tinybird/payload gone from /today; "warmed"/"envelope" still on /methodology, /data-sources, /data-health; h1s still "Britain" on home, /gas
- **XS-11** (partly) Charts without context: Every chart gets a title and unit in the subtitle, a y-axis in scaled units (£m, GW), a legend, an "as of" stamp, a 9→11 px tick floor and `gray-900` ticks (verify token: `gray-700` ticks would fail 1.4.3).
  - Live now: Most charts titled with units (constraints "Cost, £ million"); ticks still 12 px and some charts (gas, records) lack "as of". probe smallEx
- **XS-13** (not done) Link affordance: Rows that navigate get a hover `surface` tint, a chevron and an underline on focus. Other rows should not look like links. Visible focus ring on all (2.4.7 / 2.4.11).
  - Live now: Pipeline/project rows: no chevron/hover affordance visible; storage only 4 rows link. pipeline/1280-light.png, system__storage/1280-light.png
- **XS-14** (partly) Footer and meta text at 11–12 px: Raise to 13 px minimum. Meta goes in `gray-900` (5.74:1), never `gray-700` (3.23:1 fails). Footer link targets need ≥24×24 px (2.5.8).
  - Live now: Footer text ≥13 px (probe footerMin=13) but footer link height 17–18 px (<24 px target); 12 px chart ticks/tabs on home
- **XS-12** (partly) Text-only breakdowns: Breakdown lists get an inline bar (`chart-*` token per tech) and a share column (D1 share of generation).
  - Live now: Home and pipeline breakdowns have inline bars + share; /projects tech list, /today imports text only
- **XS-15** (partly) Breadcrumb and JSON-LD consistency: Data-sources, privacy and terms lack the breadcrumb. JSON-LD is missing on most pages (REPORT P3).
  - Live now: JSON-LD on all pages; breadcrumb missing on /data-sources, /privacy, /terms, /map, home (probe bc=0)

### / (home)
- **HOME-01** (not done) KPI strip (bottom): Use the same values and stamp as the hero (→XS-01), or delete the strip. It currently shows 159.8 vs 200.56 £/MWh, 107 vs 86 g and 30.4 vs 38.4 GW.
  - Live now: Bottom strip Price 42.8 £/MWh / Carbon 72 g / Demand 24.8 GW vs hero £173.37 / 101 g / 38.5 GW, no label/stamp. home/1280-light.png y≈2500
- **HOME-02** (not done) Generation bars at 375: Labels show as "G…", "W…" and "Nuclea..". Put labels above bars at full width and the value right-aligned (→XS-04).
  - Live now: Regressed: at 375 breakdown labels wrap one character per line ("Fo/ss/il"). home/375-light.png y≈700-1400
- **HOME-06** (not done) Range tabs: Two tab sets drive overlapping views. Keep one page-level range control.
  - Live now: Page-level Day/Week/Year/All and card-level Day/Week/Year/All both shown. home/1280-light.png top
- **HOME-07** (not done) Demand chart legend: "Exports" in green is listed but only a grey fill renders. Either draw exports with the `chart-*` token or remove it from the legend (→XS-05).
  - Live now: Legend lists Exports (green) + Imports, chart renders only grey band. home/1280-light.png y≈1700
- **HOME-10** (not done) Page length: 7,194 px at 1280 and 10,140 px at 375. Add "Jump to" (→XS-06, G-12).
  - Live now: 7,375 px at 1280, 11,714 px at 375; no Jump to
- **HOME-14** (not done) Title copy: "Britain" stands alone. Slot "{h1} in Great Britain" (→XS-10).
  - Live now: h1 still "What's powering Britain?"
- **HOME-12** (not done) "?" info buttons: Repeated ⓘ on every card. Keep one per card header, label `aria-label="About {card}"`.
  - Live now: "?" on every row (probe small "10px:?")

### /today
- **TODAY-01** (partly) "Latest half-hour 38.4 GW": The label must name the metric: slot "{metric}, latest half-hour".
  - Live now: "Latest half-hour 38.5 GW" with "Demand." on next line; label still does not lead with metric
- **TODAY-06** (partly) Chart ticks: Verify the tick colour token is not `gray-700` (fails 3.23:1) (→XS-11).
  - Live now: No chart ticks measured on /today (no chart); token not verifiable
- **TODAY-03** (not done) Imports list: Text only with a wide label–value gap. Use an inline bar with value next to the label and a direction arrow (→XS-12).
  - Live now: Imports list text only
- **TODAY-07** (partly) Card spacing: Cards use mixed internal padding. Standardise on `CARD_PAD`.
  - Live now: Not measured

### /gas
- **GAS-01** (not done) Data table: Expanded by default (about 100 sparse rows) above the chart while the button reads "Show table". Collapse by default, put it below the chart, and fix the button state and `aria-expanded`.
  - Live now: Table still expanded above the chart (25 rows + "Show all 93 rows"); button reads "Show table". gas/1280-dark.png
- **GAS-02** (partly) KPI cards: All four show "Partial". Give the reason per card in a tooltip. If all are partial, use one page-level ◐ note (→XS-03).
  - Live now: All 4 KPIs still show "Partial"; one page note "This gas day is not complete…" added but no per-card reason tooltip. gas/1280-light.png
- **GAS-04** (not done) Codes: Raw PUBOB codes are shown. Use human labels, with the code in a tooltip or table only.
  - Live now: PUBOB2043/2044 mono codes under entry-point labels and in chart footnote. gas/1280-dark.png y≈1800
- **GAS-03** (partly) Timestamps: Three timestamp blocks. Use one `<Freshness>` per page.
  - Live now: Down to one "Data time … Published … Retrieved" line plus gas-day line and footnote stamp. gas/1280-light.png
- **GAS-06** (partly) Forecast line (dark): Low contrast. Use a dashed `chart-*` token with ≥3:1 against the dark surface (1.4.11).
  - Live now: Forecast in legend; forecast line not visible in dark chart (no data today) — cannot confirm contrast. gas/1280-dark.png
- **GAS-05** (partly) Comparison table: Only 1 row. Render it as an inline sentence or stat instead of a table.
  - Live now: Not located on live page
- **GAS-10** (not done) Mobile KPIs: 4 stacked cards push the chart below the fold. Use a 2×2 grid at 375.
  - Live now: 375: KPIs stacked; gas/375-light.png

### /electricity/northern-ireland
- **NI-01** (partly) Stale banner: Data stale since 10:15. The banner is not the UX.md stale pattern. Apply XS-03 to every card, not only the banner.
  - Live now: Still banner "Some of Northern Ireland's data is missing"; per-card stale state absent. electricity__northern-ireland/1280-light.png
- **NI-02** (partly) Future rows: 22:00–23:45 are all "—". Hide future periods or group them as "Not yet published" (slot).
  - Live now: Future rows gone from actuals (latest 18:30 GMT) but trailing "—" rows still shown (generation 17:15–18:30 all "—"). NI 1280-light
- **NI-04** (not done) Tables: The full date repeats on every row. Put the date in the caption and show times only.
  - Live now: Full date "Sun 25 Oct 2026, 16:45 GMT" on every row. NI/1280-light.png
- **NI-07** (partly) "— gCO₂/kWh": Hide the unit when the value is "—" and add the reason slot.
  - Live now: Carbon now "56 gCO₂/kWh" with value; not re-testable without a missing value
- **NI-05** (not done) Charts: None. Add a small half-hour line per metric, matching GB cards.
  - Live now: No charts on NI (probe svg=0)
- **NI-09** (not done) Mono table body: Mono for numerics only. Labels use Geist Sans.
  - Live now: Row labels (dates) still mono

### /pipeline
- **PIPE-02** (not done) Technology table (PL-09 open): 19 ungrouped rows mixing GW and MW, with no stage split or share. Group into ≤8 plus "Other", GW only, add a share column.
  - Live now: 19 rows, mixed GW/MW ("49.9 MW Liquid air"), no share col/grouping. pipeline/1280-light.png
- **PIPE-03** (not done) Median times (PL-08 partial): Text only. Show a dot-and-IQR row per technology.
  - Live now: Median times text only
- **PIPE-06** (not done) Project rows: Don't look like links (→XS-13).
  - Live now: Project table rows have no link affordance
- **PIPE-04** (not done) Storage (PL-20 partial): Text lines. Add the stage bar matching the main bar.
  - Live now: Storage line text only
- **PIPE-05** (not done) Nation card: Mostly empty at 1280. Span 1 column, or merge with the stage card.
  - Live now: Nation card mostly empty at 1280

### /map
- **MAP-01** (partly) Theme: Light mode renders dark at 1280 (light is correct at 375). Respect the theme for tiles and chrome (D4 Protomaps light flavour).
  - Live now: 375 light renders light tiles; 1280 light still fully dark chrome and tiles. map/1280-light.png vs map/375-light.png
- **MAP-02** (partly) Inspector: "Select a flow from the list." but there is no list. Add the flow list, or change the empty-state slot.
  - Live now: A "Flows table" list now exists, but at 1280 inspector says "Select a flow from the list." with list off-screen/below. map/1280-light.png
- **MAP-03** (partly) Flows: All one orange with no direction. Add chevrons, width by MW, and a direction label in the inspector (→XS-05). MP-06 is still open.
  - Live now: Width by MW + width legend added; still single orange, no chevrons/direction. map/1280-light.png
- **MAP-05** (partly) Lines off canvas: Fit bounds to GB with padding.
  - Live now: GB fitted, but interconnector lines still run off canvas (by design to foreign end). map/1280-light.png
- **MAP-07** (not done) "8,192 MW": Use GW (→XS-02).
  - Live now: "Net import 4,630 MW"
- **MAP-08** (not done) Credits: Stacked attributions. Use a single collapsible "©" control.
  - Live now: 5 stacked attribution lines in sidebar

### /assets
- **ASSETS-02** (not done) Filters: 4 stacked selects take about 300 px. Use one "Filters" sheet with a count chip.
  - Live now: Still 4 stacked selects (Technology, Status, Source, Region). assets/375-light.png
- **ASSETS-03** (not done) Capacity: Inconsistent decimals. Use 1 dp MW and right-aligned tabular numerals.
  - Live now: Mixed "9 MW" and "2.5 MW". assets/copy.txt
- **ASSETS-04** (not done) Empty result: No zero-results state. Add a slot plus "Clear filters".
  - Live now: Not tested a zero-result state; no "Clear filters" control present in copy

### /assets/[id]/[slug]
- **ASSET-01** (partly) Location minimap: A blank box with one dot. Use Protomaps tiles at zoom 9 with a scale, or remove it.
  - Live now: Minimap still a small SVG location box (probe svg=1), no tiles/scale. assets__ast_*/1280-light.png
- **ASSET-02** (partly) Metadata: Shown at KPI size. Use a definition list at body size, and keep KPI size for capacity only.
  - Live now: Metadata now label/value rows, but "MW 6.1 MW" still at KPI size. assets__ast_*/1280-light.png
- **ASSET-03** (not done) "MW: 6.1 MW": Redundant label. Use "Capacity 6.1 MW".
  - Live now: Still "MW / 6.1 MW". assets__ast_*/copy.txt
- **ASSET-04** (partly) Output empty: Plain text. Use CardEmpty with the reason (→XS-03).
  - Live now: Output empty state has a reason sentence; not a CardEmpty pattern. asset copy.txt
- **ASSET-05** (not done) "Not available": →XS-07 glossary.
  - Live now: "Owner · Not available"

### /projects
- **PROJ-02** (not done) List rows: Full of "Unknown · Unknown". Hide unknown fields (→XS-07).
  - Live now: "Unknown" ×52 on /projects ("Construction Not started · Unknown")
- **PROJ-03** (not done) Filters: Search only. Add stage, technology and nation filters (nation excludes NI, D2).
  - Live now: Search only
- **PROJ-05** (not done) Row links: →XS-13.
  - Live now: Rows have no chevron/hover
- **PROJ-04** (not done) By-technology list: Text only. Add an inline bar and share (→XS-12).
  - Live now: By-technology list text only, MW

### /projects/[id]/[slug]
- **PROJD-01** (partly) h1: "Unknown, Unknown, Unknown". Fallback slot "{technology} project, {ref}" (→XS-07).
  - Live now: h1 fixed ("Where is … up to?") but Connection row reads "Unknown, Unknown, Unknown". projects__epj_*/copy.txt
- **PROJD-02** (not done) Stage: "Proposed" doesn't match the COPY v3 stage names.
  - Live now: "Operation Proposed" still shown
- **PROJD-03** (not done) Fields: Hide empty fields and group them as "Planning" and "Connection".
  - Live now: Empty fields shown ("No date published", "No source published")

### /data-health
- **DH-01** (partly) Series list: 18,822 px of about 150 four-line blocks. Use a status-first table: summary counts (OK / Stale / Missing) at top, problems first, OK collapsed (→XS-06).
  - Live now: Summary "48 current, 0 not updated, 1 missing", problem first, OK collapsed. Page still 11,886 px at 1280 / 13,784 at 375 from the NTS registry list. data-health/1280-light.png
- **DH-03** (partly) Values: 28 px values for metadata. Use body size.
  - Live now: Hero values 34,361 MW still large in source-time cards; registry values body size
- **DH-05** (not done) Copy: "warmed row", "envelope" (→XS-10).
  - Live now: "warmed", "envelope" still on /data-health (probe dev)

### /system/constraints
- **CONS-04** (partly) Settlement-date table: 2026-10-11 is 12 days old with no lag note, and the date is in ISO. Use XS-03 plus a "Published with a lag of n days" slot, with the date as "Sun 11 Oct 2026".
  - Live now: Lag note added ("published on a delay") but date still ISO "2026-10-11" (probe isoDate). system__constraints/copy.txt
- **CONS-05** (partly) Table rows: "Reducing largest loss 0 / 0 / 0%" and a negative −3,557 MWh have no explanation. Add a sign-convention note slot, and either hide zero rows or label them "None". At 375 the £ total is clipped (→XS-04).
  - Live now: Table has sticky col at 375; sign-convention note not found, negative volume (-165.0) unexplained
- **CONS-03** (not done) Daily series over 7 months: Spiky and unreadable. Offer weekly aggregation by default with a daily toggle.
  - Live now: Daily series only, no weekly toggle

### /system/storage
- **STOR-01** (partly) Inventory table: Hundreds of rows, 9,868 px at 1280 and 19,316 px at 375. Paginate at 25 and add type and status filters (→XS-06).
  - Live now: First 25 rows + "Show all 181 stations"; no type/status filters. system__storage/1280-light.png
- **STOR-05** (not done) Row links: Only the 4 pumped-storage rows link (→XS-13).
  - Live now: Only 4 pumped-storage rows link
- **STOR-06** (not done) "Not available" cells: Mixed with numbers. Use "—" plus the glossary (→XS-07).
  - Live now: "Not available" cells mixed with numbers
- **STOR-03** (not done) Coverage: "2900.0 of 2900.0 MW" reads oddly. Slot "{n}% of capacity reporting".
  - Live now: "2,900.0 of 2,900.0 MW monitored"
- **STOR-04** (not done) Split bars: Two grey bars. Use `chart-*` per technology, with labels.
  - Live now: Two dark grey bars. system__storage/1280-light.png

### /system/whole-energy
- **WE-01** (partly) Energy balance table: 12 columns at 11 px, clipped at 375 ("Prima…") (→XS-04). Units only in the caption. Put the unit in the header row and use a sticky first column.
  - Live now: Sticky first col, 13 px, swipe caption, caption "TWh … UK, including Northern Ireland"; unit not in header row. system__whole-energy/375-light.png
- **WE-03** (not done) Flows widget: Three numbers with no visual. A simple 3-stage flow (primary → transformation → final) using `chart-*`.
  - Live now: Three numbers, no flow visual
- **WE-04** (not done) Sub-rows: "Included in Transformation." italic note repeats 7 times. Use one footnote marker.
  - Live now: "Included in Transformation." repeats per sub-row
- **WE-05** (not done) Final consumption tabs: Plain table. Add inline bars and share (→XS-12).
  - Live now: Plain table

### /records
- **REC-02** (partly) Card meta: Dense 11 px paragraphs mixing GMT and BST. Use a 13 px floor and London time (→XS-08, XS-14).
  - Live now: Meta ≥13 px; still mixes GMT/BST labels (correct per date but dense)
- **REC-03** (partly) Coal vs wind chart: Grey and blue lines with no legend. 9 px ticks. Add direct labels (→XS-05/11).
  - Live now: Legend present (probe legends=1); ticks 12 px, no direct labels
- **REC-01** (partly) Record cards: The 5th card is an orphan at half width. Use a 3+2 grid or a full-width final card.
  - Live now: Not verified visually
- **REC-04** (not done) Milestones table: Good. Add a step-line sparkline beside it.
  - Live now: No sparkline

### /prices/gas
- **PGAS-01** (partly) h1 and title: "UK gas price today", but SAP is GB. Slot "GB gas price today" (→XS-10).
  - Live now: h1 "GB gas price today" but <title> still "UK gas price today…"
- **PGAS-02** (partly) KPI cards: Mixed freshness (daily 21 Oct, 20 Oct, monthly 1 Sep) at equal weight. Add a "Monthly" badge and the XS-03 stamp.
  - Live now: Per-card date + source shown; no "Monthly" badge
- **PGAS-03** (not done) KPI cards: No trend. Add a 30-day sparkline and change vs prior.
  - Live now: No sparkline
- **PGAS-04** (not done) Units: "$/MMBTU" here vs "$/MMBtu" elsewhere. Pick one.
  - Live now: "$/MMBTU" on cards vs "$/MMBtu" in method text
- **PGAS-05** (not done) Prose sections: Two unboxed prose blocks between cards and FAQ. Move under the KPIs as a 2-column explainer.
  - Live now: Prose blocks unboxed

### /explained/price-cap
- **CAP-01** (partly) Caps table: Fine. Use tabular numerals and right-aligned £. Move the 4 footnote paragraphs into the table as ¹ markers.
  - Live now: 4 footnote paragraphs still below table
- **CAP-02** (not done) SAP window card: Text only. Add a sparkline of SAP over the window.
  - Live now: SAP window card text only

### /changes
- **CHG-02** (not done) Grouping: Each project appears twice (construction and operational). Group by project, with from → to status chips.
  - Live now: Each project still listed twice (construction + operational). changes/copy.txt
- **CHG-03** (not done) List: No date grouping or filter. Group by observed date and add a type filter.
  - Live now: No date grouping/filter
- **CHG-04** (partly) Count line: "10 comparisons" at 12 px. Move to the card header (→XS-14).
  - Live now: "10 changes" now in card header

### /api
- **API-01** (partly) curl blocks: Clip on the right at all widths with no scroll cue. Use `overflow-x:auto`, a fade and a Copy button (→XS-04).
  - Live now: curl blocks scroll with fade at 375 (swipe=true); no Copy button found (copy.txt "copy" mentions only = 0)
- **API-02** (not done) Endpoint cards: Path repeated (h3 + "GET …"). Use a method badge plus the path once (→XS-09).
  - Live now: Path still repeated: "/api/v1/gas/overview" heading + "GET /api/v1/gas/overview". api/copy.txt
- **API-03** (not done) Page nav: 13 endpoints with no index. Add a sticky endpoint list (→XS-06).
  - Live now: No endpoint index/sticky list
- **API-04** (not done) Conventions: "Convert to UK time yourself". Slot "London time" (→XS-10).
  - Live now: "Convert to UK local time (Europe/London) yourself."

### /tools
- **TOOLS-01** (not done) Service lists: 9,145 px. Each item is 6 lines with a raw mono URL. Use a compact row (name, one-line description, domain only) and task anchors (→XS-06).
  - Live now: 9,587 px; items still 6 lines with raw URL
- **TOOLS-03** (not done) External links: Add an ↗ icon and `aria-label` "opens external site". "Runs on Grid" chip ✓.
  - Live now: No target=_blank / ↗ / external aria-label (probe ext 0/0)
- **TOOLS-02** (not done) "Verified 20 Oct 2026": Repeated on every item. Show once per section.
  - Live now: "Verified 20 Oct 2026" ×50

### /directory and /directory/identifiers
- **DIR-02** (partly) Search button: A ghost button at about 28 px for the primary action. Use the primary style and a ≥24 px target (2.5.8).
  - Live now: Search is a primary-style button; height not measured ≥24 px confirmed visually. directory/1280-light.png
- **DIR-03** (partly) Inputs: Span about 1,100 px. Cap at 480 px with a placeholder and example slot.
  - Live now: Inputs narrower at 1280; not measured
- **DIR-05** (partly) Intro copy: /directory describes MPID codes (it belongs on identifiers). **Draft for Writing Bot.**
  - Live now: /directory still includes MPID lookup copy
- **DIR-06** (not done) Initial state: No examples or empty state. Add 2–3 example chips.
  - Live now: No example chips

### /methodology
- **METH-01** (partly) Sources table: 6–8 line cells of licence prose at 11 px, duplicating /data-sources. Keep one canonical list and link to it from the other page.
  - Live now: Sources table now 4 cols at 13 px, still duplicates /data-sources

### /data-sources
- **SRC-03** (not done) Copy: "Tinybird", "warmed FUELINST envelope" (→XS-10).
  - Live now: "warmed", "envelope" on /data-sources
- **SRC-01** (not done) Breadcrumb: Missing (→XS-15).
  - Live now: No breadcrumb (probe bc=0)
- **SRC-02** (not done) Source sections: 16 prose sections. Use a card per source with labelled Licence, Attribution and Refresh fields.
  - Live now: Prose sections

### /privacy and /terms
- **LEGAL-01** (not done) Breadcrumb: Missing (→XS-15).
  - Live now: No breadcrumb on /privacy, /terms
