# Grid live-site audit — https://grid.vahaah.com

Captured Fri 23 Oct 2026, about 13:00–13:35 BST. Headless Chrome with SwiftShader, Europe/London time zone. Each page was captured at 1280/1024/768/375 widths in light and dark mode (208 full-page PNGs). Script: `audit.js`; raw results are in `<slug>/result.json` and page copy in `<slug>/copy.txt`.

Scope: 26 pages. That is every page URL in sitemap.xml except the 3,341 asset and 16,086 project detail URLs, which are covered by one example each. `/llms.txt` is a text route. `/share/[focus]` is a client redirect to `/` and was not audited separately.

Method caveats:
- Each widget is a main-area h2/h3 plus its container. On some card grids the container detection captured only the heading, so "OK" means no empty/stale/error marker was found in its text. Use the screenshots to confirm visually.
- The control test clicked up to 25 controls per page at 1280 light and compared main-content size and URL before and after each click. A control with "no change" was usually already the selected option.
- Every "clipped" hit came from sr-only captions or the skip link (clientWidth 1). These are not real defects and are not counted.
- No horizontal overflow was found at any width or theme.

## Ranked functional defects

1. **Northern Ireland data is stale again (P0).** On /data-health every EirGrid series (all 27: NI and all-island demand, generation, wind, solar, interconnectors, fuel mix, SNSP and SEMO prices) shows **Stale** with "Published 10:00 · Retrieved 10:15". No NI ingest has landed since 10:15 BST, so the 11:15, 12:15 and 13:15 runs did not publish. The /electricity/northern-ireland banner says "Some of Northern Ireland's data is missing for this period." Evidence: `data-health/copy.txt` lines 793–1215. The PR #88 fix may not be holding; check the cron logs.
2. **NI page future timestamps and empty rows (P0).** Every NI and all-island card lists rows for **Fri 23 Oct 2026, 22:00–23:45 BST**, which is about 9 hours in the future. Every actual value shows "—", and only the forecast cards have numbers (wind forecast 196–213). The headline values (1102 MW demand, 952 MW generation, 432 MW wind) appear above an all-dash table, so the table contradicts the headline. This is a time-zone or window bug: the table seems to take the last 8 quarter-hours of the UTC or Irish day instead of the latest 8 readings. Evidence: `electricity__northern-ireland/1280-light.png`, `copy.txt` lines 30–200. The headline also lacks a thousands separator ("1102MW"), while /data-health shows "1,102 MW".
3. **Home: latest settlement period is stale (P1).** The home hero mix card says "11:00–11:30 BST settlement period · **Stale** · Latest settlement period is not in yet" at about 13:00 BST, so two hours behind. /data-health shows "Storage charging 79 MW **Stale**, Published 06:50", and Battery discharge as "Not yet available — MW". On the home page the Battery row shows "— —" with "discharge only; charging is a balance term". Evidence: `home/copy.txt` lines 86–100 and 265–280.
4. **/directory and /directory/identifiers return HTTP 400 on load (P1).** The page fires `/api/v1/identifiers?name=&effective_on=…` and `?scheme=MPID&code=&…` with an empty query before the user types anything, and both return 400. This logs a console error on every load at all 8 viewport/theme combinations. Don't fetch until there's input. On /directory/identifiers, changing the scheme `<select>` did not change the content.
5. **/data-health shows many "Not yet available — · Published — · Retrieved —" rows (P2).** These are the daily NTS gas series: PUBOB4422, 4423, 4424, 637, J635, J636, 694, the LDZ, power, storage, industrial and interconnector offtakes, and J630. The day-ahead boundary flow and limit (NESO) rows are also empty. Day-end gas series may legitimately be pending for today's gas day. But "Retrieved —" means there is no stored row at all, even though 21 Oct is complete and published on /gas. The health page appears to look up only the current gas day, so it reads as broken. Evidence: `data-health/copy.txt` lines 300–520 and 766–780.
6. **/map (P2):**
   - The banner says "Not updated since 23 Oct, 11:50 BST" (electricity) at 13:00. This is the same lag as defect 3.
   - Barrow and Bacton IPs show "— · 0.0 mcm/d". A dash next to 0.0 is contradictory: show either 0 or no data.
   - The page has **two identical h1 elements** ("Flows across GB borders").
   - The title lacks the "| Grid" suffix.
   - In light mode the map canvas and header still render dark (`map/1280-light.png`). This may be intended, but confirm.
   - The full-page capture is viewport-height only, because the sidebar scrolls internally.
7. **/system/constraints is old (P2).** The latest settlement date shown is **2026-10-11**, 12 days ago, and the chart axis ends 11 Oct. If NESO publishes with a lag this may be expected, but the page has no "as of"/lag note. The /data-health NESO constraints section also contains "Not yet available".
8. **/gas: storage inventory missing (P3).** The page says "Storage inventory unavailable for this selection… Grid does not currently have a compatible inventory series." Its hourly table is sparse by design, with one value per row and "—" in the other columns. All four headline cards had values.
9. **Navigation (P3).** At desktop widths the header nav repeats the current page's name as its first item ("Grid Northern Ireland Today Gas…", "Grid Map Map Today…"), so on /map, "Map" appears twice. Check whether this is meant to be a mobile page-title slot leaking into the desktop layout.
10. **SEO gaps (P3):**
    - JSON-LD is missing on most data pages: /gas, /map, /assets, /projects, /pipeline, NI, the /system/* pages, /changes, /data-health, /directory*, /tools, and the asset and project detail pages. A Dataset, Place or Project schema would help AEO.
    - The /assets, /explained/price-cap, /records, /methodology, /today, /prices/gas, /map and home titles lack the "| Grid" suffix. This is inconsistent; pick one convention.
    - /data-health, /privacy, /terms and /data-sources use "— Grid" while the other pages use "| Grid".

Not defects:
- All 26 og:image URLs return 200 image/png.
- Every page has a meta description, a canonical URL and exactly one h1, except /map, which has two.
- No horizontal overflow at 375 in either theme.
- Range, tab and picker controls changed the content on home, gas, assets, pipeline, NI and whole-energy.

## SEO summary
| Page | Title | Desc | H1 | Canonical | OG image | JSON-LD | Internal links |
|---|---|---|---|---|---|---|---|
| `/api` | Grid API: public energy data in JSON | Grid | yes | What data can I get from Grid, and how? | ok | set | BreadcrumbList,Dataset | 16 |
| `/assets` | GB stations, interconnectors and gas terminals | yes | Power assets | ok | set | — | 41 |
| `/assets/ast_0003670fbf90f564/cuckoo-grove-farm` | Cuckoo Grove Farm: Solar PV | Grid | yes | Cuckoo Grove Farm | ok | set | — | 17 |
| `/changes` | What changed in Britain's energy system | Grid | yes | What has changed, and how do we know? | ok | set | — | 21 |
| `/data-health` | Data health — Grid | yes | Data health | ok | set | — | 18 |
| `/data-sources` | Data sources — Grid | yes | Data sources | ok | set | — | 16 |
| `/directory` | Energy organisations and codes | Grid | yes | Who is behind this name or code? | ok | set | — | 17 |
| `/directory/identifiers` | Look up an MPID or industry code | Grid | yes | Which organisation does this code belong to, and when? | ok | set | — | 17 |
| `/electricity/northern-ireland` | Northern Ireland electricity (outside GB) | Grid | yes | What's powering Northern Ireland? | ok | set | — | 16 |
| `/explained/price-cap` | Will energy bills go up in January 2027? | yes | Will energy bills go up in January 2027? | ok | set | BreadcrumbList,FAQPage | 16 |
| `/gas` | Britain's gas system: supply, demand and storage | Grid | yes | Where is Britain's gas coming from, and where is it going? | ok | set | — | 17 |
| `/` | Grid: what's powering Britain's electricity today | yes | What's powering Britain? | ok | set | WebSite,WebApplication,Person,Dataset | 21 |
| `/map` | Flows across GB borders | yes | Flows across GB borders / Flows across GB borders | ok | set | — | 11 |
| `/methodology` | How Grid's numbers are made: sources and method | yes | How Grid's numbers are made | ok | set | BreadcrumbList,FAQPage | 16 |
| `/pipeline` | GB renewable and storage project pipeline | Grid | yes | What's in GB's pipeline of new energy projects? | ok | set | — | 18 |
| `/prices/gas` | UK gas price today: SAP, Henry Hub, Europe, Japan LNG | yes | UK gas price today | ok | set | BreadcrumbList,FAQPage,WebPage | 16 |
| `/privacy` | Privacy — Grid | yes | Privacy | ok | set | — | 16 |
| `/projects` | Energy projects in Britain | Grid | yes | What is being built, and how far has it got? | ok | set | — | 56 |
| `/projects/epj_000824bd5aa1f616/perham-down-meadow-solar-farm-and-battery-storage` | Perham Down - Meadow Solar Farm & Battery Storage | Grid | yes | Where is Perham Down - Meadow Solar Farm & Battery Storage up to? | ok | set | — | 17 |
| `/records` | GB electricity records: wind, solar and carbon | yes | GB electricity records | ok | set | Dataset,ItemList,BreadcrumbList,FAQPage | 16 |
| `/system/constraints` | Grid constraints and their cost | Grid | yes | What stops electricity reaching demand, and what was done about it? | ok | set | — | 16 |
| `/system/storage` | Electricity storage in Britain | Grid | yes | How much electricity storage is there, and what is it doing? | ok | set | — | 21 |
| `/system/whole-energy` | How Britain's energy fits together | Grid | yes | How do electricity, gas, oil, heat and transport fit together? | ok | set | — | 16 |
| `/terms` | Terms — Grid | yes | Terms | ok | set | — | 16 |
| `/today` | GB electricity today: mix, carbon and price | yes | Britain's electricity today | ok | set | BreadcrumbList,FAQPage,WebPage | 17 |
| `/tools` | Energy tools and official services | Grid | yes | Where do I go to do this? | ok | set | — | 30 |
## Per-page widgets

### `/api` (HTTP 200)

Screenshots: `api/1280-light.png`, `api/1280-dark.png`, `api/375-dark.png` (all 8 in `api/`). Copy: `api/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Conventions | OK | error-ish, NaN/undefined — Conventions Times are UTC, ISO 8601 (2026-10-14T09:30:00Z). Convert to UK time yourself. Every value carries i |
| Endpoints | OK | Endpoints /api/v1/gas/overview GET /api/v1/gas/overview Summary for one gas day, with freshness and coverage f |
| /api/v1/gas/overview | OK | /api/v1/gas/overview |
| /api/v1/gas/series | OK | /api/v1/gas/series |
| /api/v1/map/layers | OK | /api/v1/map/layers |
| /api/v1/projects | OK | /api/v1/projects |
| /api/v1/constraints | OK | /api/v1/constraints |
| /api/v1/identifiers | OK | /api/v1/identifiers |
| /api/v1/identifiers/resolve | OK | /api/v1/identifiers/resolve |
| /api/v1/changes | OK | /api/v1/changes |
| /api/v1/data-health | OK | /api/v1/data-health |
| Errors | OK | error-ish — Errors Unknown ID. No results for these filters. This scope is not supported. The source is unavailable. The l |
| Licence | OK | Licence Data in API responses is subject to each source's licence, listed in sources on every response and on  |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/assets` (HTTP 200)

Screenshots: `assets/1280-light.png`, `assets/1280-dark.png`, `assets/375-dark.png` (all 8 in `assets/`). Copy: `assets/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Assets | OK | Assets |

Controls tested: 13; changed content: 12; no change: []; click errors: 1


### `/assets/ast_0003670fbf90f564/cuckoo-grove-farm` (HTTP 200)

Screenshots: `assets__ast_0003670fbf90f564__cuckoo-grove-farm/1280-light.png`, `assets__ast_0003670fbf90f564__cuckoo-grove-farm/1280-dark.png`, `assets__ast_0003670fbf90f564__cuckoo-grove-farm/375-dark.png` (all 8 in `assets__ast_0003670fbf90f564__cuckoo-grove-farm/`). Copy: `assets__ast_0003670fbf90f564__cuckoo-grove-farm/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| MW | OK | MW |
| Capacity basis | OK | Capacity basis |
| Location precision | OK | Location precision |
| Location | OK | Location |
| Identity and relationships | OK | Identity and relationships |
| Output | OK | Output |
| Ownership and operator | OK | Ownership and operator |
| Related projects | OK | Related projects |
| Change history | OK | Change history |
| Source records | OK | Source records |

Controls tested: 2; changed content: 2; no change: []; click errors: 0


### `/changes` (HTTP 200)

Screenshots: `changes/1280-light.png`, `changes/1280-dark.png`, `changes/375-dark.png` (all 8 in `changes/`). Copy: `changes/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Comparisons | OK | Comparisons |
| Clashindarroch 2 | OK | Clashindarroch 2 Clashindarroch 2 construction status changed from Not started to Under construction. Compared |
| Bumpers Farm BESS phase 2 | OK | Bumpers Farm BESS phase 2 Bumpers Farm BESS phase 2 construction status changed from Not started to Built. Com |
| Persley Croft - Battery Storage | OK | Persley Croft - Battery Storage Persley Croft - Battery Storage construction status changed from Not started t |
| Seagreen Phase 1A | OK | Seagreen Phase 1A Seagreen Phase 1A construction status changed from Not started to Under construction. Compar |
| Dalmarnock Road - Battery Storage | OK | Dalmarnock Road - Battery Storage Dalmarnock Road - Battery Storage construction status changed from Not start |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/data-health` (HTTP 200)

Screenshots: `data-health/1280-light.png`, `data-health/1280-dark.png`, `data-health/375-dark.png` (all 8 in `data-health/`). Copy: `data-health/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Source time and Grid time | OK | Source time and Grid time Demand Elexon BMRS · ITSDO · PT30M 33,687 MW Published 11:00 · Retrieved 13:00 GB ga |
| Every series | empty | not-yet-available, em-dash-value, stale — Every series Registry Gas generation Elexon BMRS · FUELINST · PT30M 4,569 MW Published 11:50 · Retrieved 13:00 |
| Registry | OK | Registry |
| National Transmission System | OK | National Transmission System Physical gas Supply, demand, linepack and storage for the gas day. These series a |
| Physical gas | OK | Physical gas |
| Transmission constraints | empty | not-yet-available, em-dash-value — Transmission constraints NESO constraints Published constraint cost and volume, and the day-ahead boundary sna |
| NESO constraints | OK | NESO constraints |
| Northern Ireland | empty | not-yet-available, em-dash-value, stale — Northern Ireland SONI and SEMO Outside GB. Northern Ireland, Ireland, and all-island stay on separate series.  |
| SONI and SEMO | OK | SONI and SEMO |
| Electricity storage | empty | not-yet-available, em-dash-value, stale — Electricity storage Pumped storage and batteries Discharge and charging from the warmed FUELINST envelope. The |
| Pumped storage and batteries | OK | Pumped storage and batteries |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/data-sources` (HTTP 200)

Screenshots: `data-sources/1280-light.png`, `data-sources/1280-dark.png`, `data-sources/375-dark.png` (all 8 in `data-sources/`). Copy: `data-sources/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| How Grid uses data | OK | NaN/undefined — How Grid uses data Ingest reads these APIs on a schedule, stores snapshots in Tinybird, and serves the dashboa |
| Elexon BMRS / Insights | OK | Elexon BMRS / Insights Market Index (APXMIDP), system (imbalance) price, ITSDO demand, FUELINST generation and |
| NESO Data Portal | OK | NESO Data Portal Embedded wind, embedded wind and solar forecasts, and historic generation mix used for Year,  |
| Carbon Intensity API | OK | Carbon Intensity API National carbon intensity (actual half-hours) and a derived cleanest-window look-ahead. L |
| Sheffield Solar PV_Live | OK | Sheffield Solar PV_Live National GB solar including estimated embedded / rooftop generation. Licence: Open acc |
| U.S. Energy Information Administration | OK | U.S. Energy Information Administration Daily Brent, WTI, and Henry Hub prices. Licence: U.S. government work.  |
| World Bank Pink Sheet | OK | World Bank Pink Sheet Monthly Europe natural gas and Japan LNG prices. Licence: CC BY 4.0. Source: www.worldba |
| National Gas | OK | National Gas Operational National Transmission System flows and the Great Britain System Average Price (PUBOB6 |
| DESNZ Renewable Energy Planning Database | OK | DESNZ Renewable Energy Planning Database Operational renewable power stations of 150 kW and above, with OSGB36 |
| DESNZ Digest of UK Energy Statistics | OK | DESNZ Digest of UK Energy Statistics DUKES 5.11 power stations, including conventional plant, matched against  |
| NESO DNO licence areas | OK | NESO DNO licence areas GB distribution network operator licence-area boundaries on the map. The boundaries in  |
| OS Open Zoomstack | OK | OS Open Zoomstack Vector basemap for the asset map. Edition 2026-06, zooms 0 to 13. Licence: Open Government L |
| EirGrid Group | OK | EirGrid Group Northern Ireland, Ireland, and all-island electricity from the Smart Grid Dashboard. SONI system |
| GeoNames | OK | GeoNames Schematic landing points for the ten electricity interconnectors, and approximate sites for NTS gas t |
| Elexon Industry Standing Data | OK | Elexon Industry Standing Data Organisation names, MPIDs, BM Unit IDs, GSP group labels, and role dates for the |
| ONS National Statistics Postcode Lookup | OK | ONS National Statistics Postcode Lookup Postcode to local authority, stored separately from the DNO licence ar |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/directory` (HTTP 200)

Screenshots: `directory/1280-light.png`, `directory/1280-dark.png`, `directory/375-dark.png` (all 8 in `directory/`). Copy: `directory/copy.txt`

Console/network errors: ['Failed to load resource: the server responded with a status of 400 ()', 'HTTP 400 https://grid.vahaah.com/api/v1/identifiers?name=&effective_on=2026-10-23'] · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Organisations | OK | Organisations |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/directory/identifiers` (HTTP 200)

Screenshots: `directory__identifiers/1280-light.png`, `directory__identifiers/1280-dark.png`, `directory__identifiers/375-dark.png` (all 8 in `directory__identifiers/`). Copy: `directory__identifiers/copy.txt`

Console/network errors: ['Failed to load resource: the server responded with a status of 400 ()', 'HTTP 400 https://grid.vahaah.com/api/v1/identifiers?scheme=MPID&code=&effective_on=2026-10-23'] · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Codes | OK | Codes |

Controls tested: 2; changed content: 1; no change: ['MPID BM Unit ID GSP group']; click errors: 0


### `/electricity/northern-ireland` (HTTP 200)

Screenshots: `electricity__northern-ireland/1280-light.png`, `electricity__northern-ireland/1280-dark.png`, `electricity__northern-ireland/375-dark.png` (all 8 in `electricity__northern-ireland/`). Copy: `electricity__northern-ireland/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| NI system demand | OK | NI system demand |
| NI system generation | OK | NI system generation |
| NI wind | OK | NI wind |
| NI wind forecast | OK | NI wind forecast |
| NI solar | OK | NI solar |
| NI solar forecast | OK | NI solar forecast |
| NI carbon intensity | OK | NI carbon intensity |
| Moyle | OK | Moyle |
| NI net transfer | OK | NI net transfer |
| Fuel mix | OK | Fuel mix |
| All-island system demand | OK | All-island system demand |
| All-island system generation | OK | All-island system generation |
| All-island wind | OK | All-island wind |
| All-island wind forecast | OK | All-island wind forecast |
| All-island solar | OK | All-island solar |
| All-island solar forecast | OK | All-island solar forecast |
| All-island carbon intensity | OK | All-island carbon intensity |
| All-island net transfer | OK | All-island net transfer |
| All-island SNSP | OK | All-island SNSP |
| Imbalance settlement price | OK | Imbalance settlement price |
| Net imbalance volume | OK | Net imbalance volume |

Controls tested: 2; changed content: 1; no change: ['Northern Ireland']; click errors: 0


### `/explained/price-cap` (HTTP 200)

Screenshots: `explained__price-cap/1280-light.png`, `explained__price-cap/1280-dark.png`, `explained__price-cap/375-dark.png` (all 8 in `explained__price-cap/`). Copy: `explained__price-cap/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Published Ofgem caps | OK | Published Ofgem caps Typical dual-fuel Direct Debit household. Each row is the figure Ofgem published, with th |
| What Ofgem has not published | OK | What Ofgem has not published Ofgem announces the next cap, covering 1 January to 31 March 2027, on 25 November |
| How the wholesale part is set | OK | How the wholesale part is set Ofgem updates the cap every quarter. The wholesale allowance follows observed wh |
| GB gas SAP in that window | OK | GB gas SAP in that window |
| What the cap does and does not cover | OK | What the cap does and does not cover The current published cap (1 October to 31 December 2026) is £1,723 a yea |
| Questions | OK | Questions When is the January 2027 price cap announced? Ofgem says it will announce the cap for 1 January to 3 |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/gas` (HTTP 200)

Screenshots: `gas/1280-light.png`, `gas/1280-dark.png`, `gas/375-dark.png` (all 8 in `gas/`). Copy: `gas/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Supply (NTS entry) | OK | Supply (NTS entry) |
| Demand (NTS exit) | OK | Demand (NTS exit) |
| Linepack | OK | Linepack |
| Storage net flow | OK | Storage net flow |
| Supply and demand | OK | Supply and demand |
| Entry points | OK | Entry points |
| Demand | OK | Demand |
| Storage | OK | Storage |
| Comparison with recent days | OK | Comparison with recent days |
| Sources and definitions | OK | Sources and definitions |

Controls tested: 4; changed content: 4; no change: []; click errors: 0


### `/` (HTTP 200)

Screenshots: `home/1280-light.png`, `home/1280-dark.png`, `home/375-dark.png` (all 8 in `home/`). Copy: `home/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): ['P "Coal" 29>17', 'P "Fossil fuels" 73>17', 'P "Gas" 25>17', 'P "Solar" 34>17', 'P "Wind" 33>17', 'P "Wind, solar and hydro" 138>17', 'SPAN "Denmark (Viking Link)" 140>128', 'SPAN "Netherlands (BritNed)" 138>128', 'SPAN "Northern Ireland (Moyle)" 154>128', 'SPAN "Pumped storage" 90>74']

| Widget | Status | Evidence |
|---|---|---|
| What's powering Britain? | OK | What's powering Britain? Wind is the largest source of Britain’s electricity at 13.9 GW (46%). Day Week Year A |
| Demand and generation, including embedded | OK | em-dash-value — Fossil fuels 4.4 GW 14% ? Gas 4.4 GW 14% ? Coal 0.0 GW 0% ? Oil 0.0 GW 0% ? Wind, solar and hydro 16.4 GW 55%  |
| Power infrastructure in GB | OK | Power infrastructure in GB |
| What does power cost? | OK | What does power cost? ? Day Week Year All Market System |
| Where is power flowing? | OK | Where is power flowing? ? Day Week Year All |
| Latest flows | OK | Latest flows ? France (IFA) 2.00 GWin Denmark (Viking Link) 1.42 GWin Norway (NSL) 1.40 GWin Belgium (Nemo) 1. |
| Flows over time | OK | Latest flows ? France (IFA) 2.00 GWin Denmark (Viking Link) 1.42 GWin Norway (NSL) 1.40 GWin Belgium (Nemo) 1. |
| How has the mix changed? | OK | How has the mix changed? ? Day Week Year All |
| Gas & oil | OK | Gas & oil ? 30d 90d 1y |
| Records and the energy transition | OK | Records and the energy transition ? |
| Coal gives way to wind | OK | Highest wind since Grid's records began ? 23.9GW Wed 25 Mar 2026, 13:30 GMT Lowest carbon since Grid's records |
| How clean is it? | OK | How clean is it? ? Day Week Year All |
| Sources and methodology | OK | Sources and methodology Grid is compiled hourly from Elexon BMRS, NESO, the Carbon Intensity API and Sheffield |

Controls tested: 25; changed content: 17; no change: ['Day', '?', '?', '?', '?', '?', '?', '?']; click errors: 0


### `/map` (HTTP 200)

Screenshots: `map/1280-light.png`, `map/1280-dark.png`, `map/375-dark.png` (all 8 in `map/`). Copy: `map/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|

Controls tested: 25; changed content: 23; no change: ['']; click errors: 1


### `/methodology` (HTTP 200)

Screenshots: `methodology/1280-light.png`, `methodology/1280-dark.png`, `methodology/375-dark.png` (all 8 in `methodology/`). Copy: `methodology/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Sources | OK | Sources Grid data sources, licences and refresh Source Used for Licence Refresh Elexon BMRS / Insights Market  |
| Definitions | OK | Definitions Market index: Elexon APXMIDP, the short-term wholesale price in £/MWh. System price: imbalance / c |
| Data checks | OK | NaN/undefined — Data checks Snapshot integrity tests drop rows with impossible fuel shares, wind above 25.5 GW, or solar above |
| Records | OK | Records A Grid record is the highest or lowest valid half-hour since Grid's records began (NESO historic data  |
| Questions | OK | NaN/undefined — Questions How often does Grid update? Ingest runs hourly for the GB grid and every six hours for commodities.  |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/pipeline` (HTTP 200)

Screenshots: `pipeline/1280-light.png`, `pipeline/1280-dark.png`, `pipeline/375-dark.png` (all 8 in `pipeline/`). Copy: `pipeline/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| In the pipeline | OK | In the pipeline |
| How the pipeline works | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Under construction | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Consented, not yet built | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| In planning | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Refusals | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Withdrawals | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Appeals | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Call-ins | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Abandonment | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| Expiry | OK | How the pipeline works Under construction DESNZ has recorded a construction start, and the project is not oper |
| By technology | OK | By technology |
| By nation | OK | By nation |
| What happened to applications from 2015 to 2020 | OK | What happened to applications from 2015 to 2020 |
| Median time in each stage | OK | Median time in each stage |
| Projects | OK | Projects Download CSV |
| Northern Ireland | OK | Northern Ireland |
| Methodology | OK | Methodology |

Controls tested: 12; changed content: 11; no change: []; click errors: 1


### `/prices/gas` (HTTP 200)

Screenshots: `prices__gas/1280-light.png`, `prices__gas/1280-dark.png`, `prices__gas/375-dark.png` (all 8 in `prices__gas/`). Copy: `prices__gas/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| GB gas (SAP) | OK | GB gas (SAP) |
| Henry Hub gas | OK | Henry Hub gas |
| EU natural gas | OK | EU natural gas |
| LNG, Japan | OK | LNG, Japan |
| What this means for electricity | OK | What this means for electricity Gas-fired stations are often the last plants needed to meet demand, so wholesa |
| Units and method | OK | Units and method SAP is stored in p/kWh and shown in p/therm using 1 therm = 29.3071 kWh. Henry Hub is $/MMBtu |
| Questions | OK | Questions What is the System Average Price? SAP is National Gas's published System Average Price for the GB ga |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/privacy` (HTTP 200)

Screenshots: `privacy/1280-light.png`, `privacy/1280-dark.png`, `privacy/375-dark.png` (all 8 in `privacy/`). Copy: `privacy/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Who is responsible | OK | Who is responsible The data controller is Comonad Ltd. Contact: alex@comonad.co.uk. |
| What we collect | OK | What we collect Grid does not ask you to create an account, and we do not store a user profile. Vercel platfor |
| Cookies | OK | Cookies Grid does not set first-party cookies. The app deletes any Set-Cookie header on cached JSON responses. |
| Analytics | OK | Analytics The production site measures visits with cookieless Plausible analytics. Plausible does not use cook |
| Lawful basis and retention | OK | Lawful basis and retention We process this information under UK GDPR legitimate interests: keeping a public el |
| Your rights | OK | Your rights You can ask Comonad Ltd for access, rectification, erasure, restriction, or objection, and for a c |
| International transfers | OK | International transfers The site is hosted on Vercel. Request logs may be processed outside the UK under Verce |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/projects` (HTTP 200)

Screenshots: `projects/1280-light.png`, `projects/1280-dark.png`, `projects/375-dark.png` (all 8 in `projects/`). Copy: `projects/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Operating rated power | OK | Operating rated power |
| Connection capacity | OK | Connection capacity |
| Storage energy | OK | Storage energy |
| Operating rated power by technology | OK | Operating rated power by technology |
| Projects | OK | Projects |

Controls tested: 2; changed content: 1; no change: []; click errors: 1


### `/projects/epj_000824bd5aa1f616/perham-down-meadow-solar-farm-and-battery-storage` (HTTP 200)

Screenshots: `projects__epj_000824bd5aa1f616__perham-down-meadow-solar-farm-and-battery-storag/1280-light.png`, `projects__epj_000824bd5aa1f616__perham-down-meadow-solar-farm-and-battery-storag/1280-dark.png`, `projects__epj_000824bd5aa1f616__perham-down-meadow-solar-farm-and-battery-storag/375-dark.png` (all 8 in `projects__epj_000824bd5aa1f616__perham-down-meadow-solar-farm-and-battery-storag/`). Copy: `projects__epj_000824bd5aa1f616__perham-down-meadow-solar-farm-and-battery-storag/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Planning | OK | Planning |
| Construction | OK | Construction |
| Connection | OK | Connection |
| Operation | OK | Operation |
| Measures | OK | Measures |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/records` (HTTP 200)

Screenshots: `records/1280-light.png`, `records/1280-dark.png`, `records/375-dark.png` (all 8 in `records/`). Copy: `records/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Highest wind since Grid's records began | OK | Highest wind since Grid's records began |
| Lowest carbon since Grid's records began | OK | Lowest carbon since Grid's records began |
| Highest renewable share since Grid's records began | OK | Highest renewable share since Grid's records began |
| Highest zero-carbon share since Grid's records began | OK | Highest zero-carbon share since Grid's records began |
| Days since coal power ended | OK | Days since coal power ended |
| First time above N GW of wind | OK | First time above N GW of wind Transmission-connected wind plus embedded wind. The first half-hour that series  |
| Coal gives way to wind | OK | Coal gives way to wind Yearly averages computed from the same NESO historic series. The sentences use those av |
| Questions | OK | Questions What is the wind record based on? Transmission-connected wind plus embedded wind from NESO historic  |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/system/constraints` (HTTP 200)

Screenshots: `system__constraints/1280-light.png`, `system__constraints/1280-dark.png`, `system__constraints/375-dark.png` (all 8 in `system__constraints/`). Copy: `system__constraints/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Constraint cost | OK | Constraint cost |
| Constraint volume | OK | Constraint volume |
| Settlement date 2026-10-11 | OK | Settlement date 2026-10-11 |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/system/storage` (HTTP 200)

Screenshots: `system__storage/1280-light.png`, `system__storage/1280-dark.png`, `system__storage/375-dark.png` (all 8 in `system__storage/`). Copy: `system__storage/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Rated capacity | OK | Rated capacity |
| Storage fleet covered | OK | Storage fleet covered |
| Inventory | OK | Inventory |
| Monitored fleet | OK | Monitored fleet |
| Discharging | OK | The monitored fleet is the FUELINST pumped-storage total for transmission-connected generation. These national |
| Charging | OK | The monitored fleet is the FUELINST pumped-storage total for transmission-connected generation. These national |
| Sources | OK | Sources |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/system/whole-energy` (HTTP 200)

Screenshots: `system__whole-energy/1280-light.png`, `system__whole-energy/1280-dark.png`, `system__whole-energy/375-dark.png` (all 8 in `system__whole-energy/`). Copy: `system__whole-energy/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Whole energy flows | OK | Whole energy flows |
| Natural gas | OK | TWh, year 2025. UK, annual statistic. 1 Natural gas 671.4TWh 35% of primary energy supply Primary supply. 2 Po |
| Power generation | OK | TWh, year 2025. UK, annual statistic. 1 Natural gas 671.4TWh 35% of primary energy supply Primary supply. 2 Po |
| Final electricity | OK | TWh, year 2025. UK, annual statistic. 1 Natural gas 671.4TWh 35% of primary energy supply Primary supply. 2 Po |
| Energy balance | OK | Energy balance |
| Final consumption | OK | Final consumption |

Controls tested: 3; changed content: 2; no change: ['Homes']; click errors: 0


### `/terms` (HTTP 200)

Screenshots: `terms/1280-light.png`, `terms/1280-dark.png`, `terms/375-dark.png` (all 8 in `terms/`). Copy: `terms/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Informational use | OK | Informational use Figures come from third-party feeds, are ingested on a half-hourly or slower cadence, and ca |
| No warranty | OK | No warranty The site is provided "as is" and "as available", without warranty of any kind, express or implied, |
| Not financial advice | OK | Not financial advice Nothing on Grid is advice on securities, commodities, electricity contracts, or any other |
| Code licence | OK | Code licence The Grid source code is released under the MIT Licence. Third-party data stays under the licences |
| Liability | OK | Liability To the fullest extent permitted by law, Comonad Ltd and its contributors are not liable for any indi |
| Law | OK | Law These terms are governed by the laws of England and Wales. Contact alex@comonad.co.uk. |

Controls tested: 0; changed content: 0; no change: []; click errors: 0


### `/today` (HTTP 200)

Screenshots: `today/1280-light.png`, `today/1280-dark.png`, `today/375-dark.png` (all 8 in `today/`). Copy: `today/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Latest half-hour | OK | Latest half-hour |
| How much came from gas | OK | How much came from gas |
| Cheapest market index | OK | Cheapest market index |
| Dearest market index | OK | Dearest market index |
| Today, yesterday and the past 7 days | OK | Today, yesterday and the past 7 days Yesterday and the weekly column reuse Grid's cached week payload, not a s |
| Imports and exports | OK | Imports and exports France Import 3.0 GW Denmark Import 1.4 GW Norway Import 1.4 GW Belgium Import 1.0 GW Neth |
| Questions | OK | Questions How much of Britain's electricity is wind right now? In the latest half-hour Grid holds, wind was 46 |

Controls tested: 1; changed content: 1; no change: []; click errors: 0


### `/tools` (HTTP 200)

Screenshots: `tools/1280-light.png`, `tools/1280-dark.png`, `tools/375-dark.png` (all 8 in `tools/`). Copy: `tools/copy.txt`

Console/network errors: none · Horizontal overflow: none · Clipped text (non-sr-only): none

| Widget | Status | Evidence |
|---|---|---|
| Understand a bill | OK | Understand a bill |
| Find a network operator | OK | Find a network operator |
| Find an official outage service | OK | Find an official outage service |
| Investigate a connection | OK | Investigate a connection |
| Find a code | OK | Find a code |
| Access a dataset | OK | Access a dataset |
| Explore planning or network evidence | OK | Explore planning or network evidence |
| Report a broken link | OK | Report a broken link |

Controls tested: 0; changed content: 0; no change: []; click errors: 0
