# Critiquito coverage check — live grid.vahaah.com, Sun 25 Oct 2026 (~18:45–19:30 GMT)

Method: Playwright (headless Chrome) on the box, Europe/London. Full-page screenshots at 1280/1024/768/375 × light/dark for all 26 audited pages are in `<slug>/<width>-<theme>.png` here; page copy in `<slug>/copy.txt`; structural probe (h1, titles, JSON-LD, breadcrumb, font sizes, table sticky/scroll, legends, 4xx) at 1280-light, 375-light, 1280-dark in `probe.json`. Status is a judgement from those artefacts; items marked "partly" with "not measured/verified" need a closer look.

**Counts:** partly: 49, done: 38, not done: 60 (total 147)

| ID | Page | Item | Status | Evidence |
|---|---|---|---|---|
| XS-01 | XS | Figures disagree between pages | partly | Home infra now 267.4 GW / 7,668 = /pipeline. But home KPI strip (Price 42.8 £/MWh, Carbon 72 g, Demand 24.8 GW) still disagrees with hero (£173.37, 101 g, 38.5 GW). home/1280-light.png y≈2500; home/copy.txt |
| XS-02 | XS | Number and unit format | partly | formatEnergy used (NI "1,062 MW", storage "7.8 GW", PROJ "57.4 GW"); still MW at GW scale on /projects tech list ("16,011.0 MW"), /map "Net import 4,630 MW", /assets "9 MW" vs "2.5 MW" |
| XS-03 | XS | Stale, unavailable and partial states | partly | Freshness stamp present on home/gas/NI; NI still uses banner + per-row "—"; gas shows Partial on all 4 KPI cards. gas/1280-dark.png |
| XS-04 | XS | Mobile tables and labels | partly | TableScroll with sticky first col + "Swipe" caption on /today,/assets,/pipeline,/system/*,/api at 375 (probe.json swipe=true, sticky). Regression: home 375 breakdown labels wrap one letter per line. home/375-light.png y≈700-1400 |
| XS-05 | XS | Colour-only encoding (1.4.1) | partly | Pipeline stage bar labelled + legend (done); constraints legend; map flows still single orange with no chevrons; home demand legend shows exports but only grey fill. map/1280-light.png |
| ASSET-01 | ASSET | Location minimap | partly | Minimap still a small SVG location box (probe svg=1), no tiles/scale. assets__ast_*/1280-light.png |
| ASSETS-01 | ASSETS | Table at 375 | done | 375: table in overflow-x:auto wrapper, sticky first col, "Swipe" caption (probe.json /assets 375-light) |
| CHG-01 | CHG | Change items | done | Times now "Thu 15 Oct 2026, 14:35 BST", dataset "NESO (TEC register)"; but text reads "Compared … 13 Oct 2026 with 13 Oct 2026" (same-date bug). changes/copy.txt |
| CONS-01 | CONS | Cost and volume charts | done | Legend: Reducing largest loss / Increasing system inertia / Voltage / Thermal (probe legends=2). system__constraints/1280-light.png |
| CONS-04 | CONS | Settlement-date table | partly | Lag note added ("published on a delay") but date still ISO "2026-10-11" (probe isoDate). system__constraints/copy.txt |
| DH-01 | DH | Series list | partly | Summary "48 current, 0 not updated, 1 missing", problem first, OK collapsed. Page still 11,886 px at 1280 / 13,784 at 375 from the NTS registry list. data-health/1280-light.png |
| DH-04 | DH | Source ID | done | No UUID in copy (probe dev/iso clean for UUID) |
| DIR-01 | DIR | Page | done | No HTTP 4xx on load at any width (probe errs=[]; result.json console) |
| GAS-01 | GAS | Data table | not done | Table still expanded above the chart (25 rows + "Show all 93 rows"); button reads "Show table". gas/1280-dark.png |
| GAS-02 | GAS | KPI cards | partly | All 4 KPIs still show "Partial"; one page note "This gas day is not complete…" added but no per-card reason tooltip. gas/1280-light.png |
| GAS-04 | GAS | Codes | not done | PUBOB2043/2044 mono codes under entry-point labels and in chart footnote. gas/1280-dark.png y≈1800 |
| HOME-01 | HOME | KPI strip (bottom) | not done | Bottom strip Price 42.8 £/MWh / Carbon 72 g / Demand 24.8 GW vs hero £173.37 / 101 g / 38.5 GW, no label/stamp. home/1280-light.png y≈2500 |
| HOME-02 | HOME | Generation bars at 375 | not done | Regressed: at 375 breakdown labels wrap one character per line ("Fo/ss/il"). home/375-light.png y≈700-1400 |
| HOME-03 | HOME | Infrastructure card | done | Infrastructure card 267.4 GW / 7,668 projects = /pipeline. home/copy.txt |
| HOME-04 | HOME | Settlement-period badge | done | "17:00–17:30 GMT settlement period · Latest settlement period is not in yet" at 17:50 GMT capture: current period, stale note shown |
| MAP-01 | MAP | Theme | partly | 375 light renders light tiles; 1280 light still fully dark chrome and tiles. map/1280-light.png vs map/375-light.png |
| MAP-02 | MAP | Inspector | partly | A "Flows table" list now exists, but at 1280 inspector says "Select a flow from the list." with list off-screen/below. map/1280-light.png |
| MAP-03 | MAP | Flows | partly | Width by MW + width legend added; still single orange, no chevrons/direction. map/1280-light.png |
| NI-01 | NI | Stale banner | partly | Still banner "Some of Northern Ireland's data is missing"; per-card stale state absent. electricity__northern-ireland/1280-light.png |
| NI-02 | NI | Future rows | partly | Future rows gone from actuals (latest 18:30 GMT) but trailing "—" rows still shown (generation 17:15–18:30 all "—"). NI 1280-light |
| NI-03 | NI | Tables vs headlines | done | Headline equals latest row value (1,062 MW = 18:00 row; wind 703). NI copy.txt |
| PIPE-01 | PIPE | Stage bar (PL-10 open) | done | Stage bar with inline 11%/54%/35% labels + legend. pipeline/1280-light.png |
| PIPE-07 | PIPE | Mismatch with home | done | Home 267.4 GW / 7,668 = /pipeline |
| PROJ-01 | PROJ | KPI cards | done | "57.4 GW", "689.9 GW". projects/copy.txt |
| PROJD-01 | PROJD | h1 | partly | h1 fixed ("Where is … up to?") but Connection row reads "Unknown, Unknown, Unknown". projects__epj_*/copy.txt |
| STOR-01 | STOR | Inventory table | partly | First 25 rows + "Show all 181 stations"; no type/status filters. system__storage/1280-light.png |
| TODAY-02 | TODAY | Half-hour table at 375 | done | 375: sticky first column + "Swipe" caption (probe /today 375-light) |
| WE-01 | WE | Energy balance table | partly | Sticky first col, 13 px, swipe caption, caption "TWh … UK, including Northern Ireland"; unit not in header row. system__whole-energy/375-light.png |
| XS-06 | XS | Long pages and unbounded lists | partly | Show-all disclosures on gas/storage; no sticky TOC / "Jump to" on any page (probe jump=false); home 7,375/11,714 px, tools 9,587 px, data-health 11,886 px |
| XS-07 | XS | Vocabulary | partly | "Not published" used on pipeline/projects; "Unknown" still 52× on /projects, 3× on project detail; "Not available" on storage/asset |
| XS-08 | XS | Time display | partly | lang="en-GB", London times on most pages; ISO dates on /system/constraints ("2026-10-11", "2026-10-24") |
| XS-09 | XS | Heading hierarchy | done | Exactly one h1 on every page (probe h1), nav no longer duplicates current page, all titles "/ Grid" |
| XS-10 | XS | Wording (GB, developer-speak) | partly | Tinybird/payload gone from /today; "warmed"/"envelope" still on /methodology, /data-sources, /data-health; h1s still "Britain" on home, /gas |
| XS-11 | XS | Charts without context | partly | Most charts titled with units (constraints "Cost, £ million"); ticks still 12 px and some charts (gas, records) lack "as of". probe smallEx |
| XS-13 | XS | Link affordance | not done | Pipeline/project rows: no chevron/hover affordance visible; storage only 4 rows link. pipeline/1280-light.png, system__storage/1280-light.png |
| XS-14 | XS | Footer and meta text at 11–12 px | partly | Footer text ≥13 px (probe footerMin=13) but footer link height 17–18 px (<24 px target); 12 px chart ticks/tabs on home |
| API-01 | API | curl blocks | partly | curl blocks scroll with fade at 375 (swipe=true); no Copy button found (copy.txt "copy" mentions only = 0) |
| API-02 | API | Endpoint cards | not done | Path still repeated: "/api/v1/gas/overview" heading + "GET /api/v1/gas/overview". api/copy.txt |
| ASSET-02 | ASSET | Metadata | partly | Metadata now label/value rows, but "MW 6.1 MW" still at KPI size. assets__ast_*/1280-light.png |
| ASSET-03 | ASSET | "MW: 6.1 MW" | not done | Still "MW / 6.1 MW". assets__ast_*/copy.txt |
| ASSET-04 | ASSET | Output empty | partly | Output empty state has a reason sentence; not a CardEmpty pattern. asset copy.txt |
| ASSETS-02 | ASSETS | Filters | not done | Still 4 stacked selects (Technology, Status, Source, Region). assets/375-light.png |
| ASSETS-03 | ASSETS | Capacity | not done | Mixed "9 MW" and "2.5 MW". assets/copy.txt |
| CAP-03 | CAP | Footnotes | done | No text <13 px on /explained/price-cap (probe smallCount=0) |
| CHG-02 | CHG | Grouping | not done | Each project still listed twice (construction + operational). changes/copy.txt |
| CONS-02 | CONS | Cost y-axis | done | Cost axis "£0.0m … £36m"; volume axis "GWh". system__constraints/375-light.png |
| CONS-05 | CONS | Table rows | partly | Table has sticky col at 375; sign-convention note not found, negative volume (-165.0) unexplained |
| DH-02 | DH | Status pills | done | Every row pill with icon + text ("✓ Current", "Not yet available"). data-health/1280-light.png |
| DH-03 | DH | Values | partly | Hero values 34,361 MW still large in source-time cards; registry values body size |
| DH-05 | DH | Copy | not done | "warmed", "envelope" still on /data-health (probe dev) |
| DIR-02 | DIR | Search button | partly | Search is a primary-style button; height not measured ≥24 px confirmed visually. directory/1280-light.png |
| DIR-04 | DIR | Date input | done | lang=en-GB + hint "Example: 23 Oct 2026" |
| GAS-03 | GAS | Timestamps | partly | Down to one "Data time … Published … Retrieved" line plus gas-day line and footnote stamp. gas/1280-light.png |
| GAS-06 | GAS | Forecast line (dark) | partly | Forecast in legend; forecast line not visible in dark chart (no data today) — cannot confirm contrast. gas/1280-dark.png |
| GAS-07 | GAS | Chart legend | done | Legend Supply/Demand/Forecast with swatches. gas/1280-dark.png |
| GAS-08 | GAS | Storage inventory | done | Storage net flow KPI present; storage reason text shown when absent |
| HOME-05 | HOME | Hero card heading | done | Hero card titled "Latest half-hour", not the h1 |
| HOME-06 | HOME | Range tabs | not done | Page-level Day/Week/Year/All and card-level Day/Week/Year/All both shown. home/1280-light.png top |
| HOME-07 | HOME | Demand chart legend | not done | Legend lists Exports (green) + Imports, chart renders only grey band. home/1280-light.png y≈1700 |
| HOME-08 | HOME | Demand chart x-axis | done | Last tick "17:30" fully visible |
| HOME-10 | HOME | Page length | not done | 7,375 px at 1280, 11,714 px at 375; no Jump to |
| HOME-13 | HOME | Unit rendering | done | Units rendered smaller with spacing ("33.8 GW", "42.8 £/MWh") |
| HOME-14 | HOME | Title copy | not done | h1 still "What's powering Britain?" |
| MAP-04 | MAP | Headings | done | One h1 "Flows across GB borders" |
| MAP-05 | MAP | Lines off canvas | partly | GB fitted, but interconnector lines still run off canvas (by design to foreign end). map/1280-light.png |
| MAP-06 | MAP | "— · 0.0" | done | "Barrow · Zero flow · 0.0 mcm/d" |
| METH-01 | METH | Sources table | partly | Sources table now 4 cols at 13 px, still duplicates /data-sources |
| METH-02 | METH | Table type | done | Table 13 px (probe fs) |
| NI-04 | NI | Tables | not done | Full date "Sun 25 Oct 2026, 16:45 GMT" on every row. NI/1280-light.png |
| NI-06 | NI | "1102MW" | done | "1,062 MW" |
| NI-07 | NI | "— gCO₂/kWh" | partly | Carbon now "56 gCO₂/kWh" with value; not re-testable without a missing value |
| PGAS-01 | PGAS | h1 and title | partly | h1 "GB gas price today" but <title> still "UK gas price today…" |
| PGAS-02 | PGAS | KPI cards | partly | Per-card date + source shown; no "Monthly" badge |
| PIPE-02 | PIPE | Technology table (PL-09 open) | not done | 19 rows, mixed GW/MW ("49.9 MW Liquid air"), no share col/grouping. pipeline/1280-light.png |
| PIPE-03 | PIPE | Median times (PL-08 partial) | not done | Median times text only |
| PIPE-06 | PIPE | Project rows | not done | Project table rows have no link affordance |
| PROJ-02 | PROJ | List rows | not done | "Unknown" ×52 on /projects ("Construction Not started · Unknown") |
| PROJ-03 | PROJ | Filters | not done | Search only |
| PROJ-05 | PROJ | Row links | not done | Rows have no chevron/hover |
| PROJD-02 | PROJD | Stage | not done | "Operation Proposed" still shown |
| REC-02 | REC | Card meta | partly | Meta ≥13 px; still mixes GMT/BST labels (correct per date but dense) |
| REC-03 | REC | Coal vs wind chart | partly | Legend present (probe legends=1); ticks 12 px, no direct labels |
| SRC-03 | SRC | Copy | not done | "warmed", "envelope" on /data-sources |
| STOR-02 | STOR | KPI | done | "7.8 GW" |
| STOR-05 | STOR | Row links | not done | Only 4 pumped-storage rows link |
| STOR-06 | STOR | "Not available" cells | not done | "Not available" cells mixed with numbers |
| TODAY-01 | TODAY | "Latest half-hour 38.4 GW" | partly | "Latest half-hour 38.5 GW" with "Demand." on next line; label still does not lead with metric |
| TODAY-04 | TODAY | Explainer copy | done | No Tinybird/payload wording |
| TODAY-05 | TODAY | h1 | done | h1 "GB electricity today" |
| TODAY-06 | TODAY | Chart ticks | partly | No chart ticks measured on /today (no chart); token not verifiable |
| TOOLS-01 | TOOLS | Service lists | not done | 9,587 px; items still 6 lines with raw URL |
| TOOLS-03 | TOOLS | External links | not done | No target=_blank / ↗ / external aria-label (probe ext 0/0) |
| WE-02 | WE | Scope label | done | Caption "UK, including Northern Ireland. Annual, 2025" |
| WE-06 | WE | h1 | done | h1 "How do electricity, gas, oil, heat and transport fit together?" |
| XS-12 | XS | Text-only breakdowns | partly | Home and pipeline breakdowns have inline bars + share; /projects tech list, /today imports text only |
| XS-15 | XS | Breadcrumb and JSON-LD consistency | partly | JSON-LD on all pages; breadcrumb missing on /data-sources, /privacy, /terms, /map, home (probe bc=0) |
| API-03 | API | Page nav | not done | No endpoint index/sticky list |
| API-04 | API | Conventions | not done | "Convert to UK local time (Europe/London) yourself." |
| ASSET-05 | ASSET | "Not available" | not done | "Owner · Not available" |
| ASSETS-04 | ASSETS | Empty result | not done | Not tested a zero-result state; no "Clear filters" control present in copy |
| CAP-01 | CAP | Caps table | partly | 4 footnote paragraphs still below table |
| CAP-02 | CAP | SAP window card | not done | SAP window card text only |
| CHG-03 | CHG | List | not done | No date grouping/filter |
| CHG-04 | CHG | Count line | partly | "10 changes" now in card header |
| CONS-03 | CONS | Daily series over 7 months | not done | Daily series only, no weekly toggle |
| DH-06 | DH | Gas series | done | "Not yet available" with reason text kept |
| DIR-03 | DIR | Inputs | partly | Inputs narrower at 1280; not measured |
| DIR-05 | DIR | Intro copy | partly | /directory still includes MPID lookup copy |
| DIR-06 | DIR | Initial state | not done | No example chips |
| GAS-05 | GAS | Comparison table | partly | Not located on live page |
| GAS-09 | GAS | Gas bases (D5) | done | Units label small next to KPI ("million m³/day") |
| GAS-10 | GAS | Mobile KPIs | not done | 375: KPIs stacked; gas/375-light.png |
| HOME-09 | HOME | Battery row note | done | Battery note one line "Not reported separately by the source." |
| HOME-11 | HOME | Static map card (D9) | done | Map card with "Open map →" and caption |
| HOME-12 | HOME | "?" info buttons | not done | "?" on every row (probe small "10px:?") |
| LEGAL-01 | LEGAL | Breadcrumb | not done | No breadcrumb on /privacy, /terms |
| LEGAL-02 | LEGAL | "UK GDPR" / jurisdiction | done | No change required |
| MAP-07 | MAP | "8,192 MW" | not done | "Net import 4,630 MW" |
| MAP-08 | MAP | Credits | not done | 5 stacked attribution lines in sidebar |
| NI-05 | NI | Charts | not done | No charts on NI (probe svg=0) |
| NI-08 | NI | Card grid | done | Card pairs equal height. NI/1280-light.png |
| NI-09 | NI | Mono table body | not done | Row labels (dates) still mono |
| PGAS-03 | PGAS | KPI cards | not done | No sparkline |
| PGAS-04 | PGAS | Units | not done | "$/MMBTU" on cards vs "$/MMBtu" in method text |
| PGAS-05 | PGAS | Prose sections | not done | Prose blocks unboxed |
| PIPE-04 | PIPE | Storage (PL-20 partial) | not done | Storage line text only |
| PIPE-05 | PIPE | Nation card | not done | Nation card mostly empty at 1280 |
| PROJ-04 | PROJ | By-technology list | not done | By-technology list text only, MW |
| PROJD-03 | PROJD | Fields | not done | Empty fields shown ("No date published", "No source published") |
| REC-01 | REC | Record cards | partly | Not verified visually |
| REC-04 | REC | Milestones table | not done | No sparkline |
| REC-05 | REC | FAQ copy | done | No standalone "Britain" in FAQ |
| SRC-01 | SRC | Breadcrumb | not done | No breadcrumb (probe bc=0) |
| SRC-02 | SRC | Source sections | not done | Prose sections |
| STOR-03 | STOR | Coverage | not done | "2,900.0 of 2,900.0 MW monitored" |
| STOR-04 | STOR | Split bars | not done | Two dark grey bars. system__storage/1280-light.png |
| TODAY-03 | TODAY | Imports list | not done | Imports list text only |
| TODAY-07 | TODAY | Card spacing | partly | Not measured |
| TOOLS-02 | TOOLS | "Verified 20 Oct 2026" | not done | "Verified 20 Oct 2026" ×50 |
| WE-03 | WE | Flows widget | not done | Three numbers, no flow visual |
| WE-04 | WE | Sub-rows | not done | "Included in Transformation." repeats per sub-row |
| WE-05 | WE | Final consumption tabs | not done | Plain table |

## Extra findings (not in the 147)
- /changes: every item says "Compared NESO (TEC register) of 13 Oct 2026 with 13 Oct 2026" — same date on both sides.
- /prices/gas `<title>` still "UK gas price today…" while h1 is "GB gas price today".
- Terms: MIT licence line is gone (Alex's decision holds).
