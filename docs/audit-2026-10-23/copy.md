# Grid copy review: every page, every widget

Reviewed: Fri 23 Oct 2026, from `/workspace/grid-audit/<slug>/copy.txt` and `REPORT.md` (captured 13:00 to 13:35 BST).
Approved sources this review follows: `/workspace/grid-review/plan/COPY.md` (v2) and `/workspace/grid-review/pipeline-page/COPY.md` (v3.2). Where a string below conflicts with those, those win.
Tags: **[DATA]** means the wording depends on a fact or figure that someone must confirm before shipping. **[DEV]** means the fix is in code or data, not only in the string.

## 0. Cross-site conventions

1. **Name and scope.** "Grid". Scope is "Great Britain" on first use, then "GB". Never "UK" or "Britain" alone. The one exception is the home H1 "What's powering Britain?". Where a source is genuinely UK-wide (DUKES energy balance, Ofgem rules for GB, legal pages), say so explicitly, for example "UK (includes Northern Ireland)".
2. **Northern Ireland.** Only on `/electricity/northern-ireland`, labelled "Outside GB". GB figures never include NI. SEM prices in €. NI carbon intensity reads "Not yet available".
3. **What Grid is.** "a public dashboard". Never "real-time", "live", "right now", "current" (for flows), "open source". No repo links.
4. **Refresh.** "Grid refreshes every hour" (all grid data, including the Elexon imbalance price). Physical gas: "updated hourly". Oil and gas prices: "refresh every 6 hours". Refresh time is never shown as data time.
5. **Number format.**
   - A space between number and unit, always: `30.3 GW`, `1,102 MW`, `86 gCO₂/kWh`, `£200.56/MWh` (currency symbol prefix, no space; `/MWh` suffix, no space).
   - Thousands separators on every number of four or more digits, including tables and axes: `1,800.0 MW`, `57,440.4 MW`, `1,099.3 TWh`.
   - GW to one decimal; MW to whole numbers for flows and headline readings, one decimal for capacities under 100 MW and for register capacities; percentages whole numbers except records (one decimal). Under 0.1 GW switch to MW (pipeline rule v3.2), never "0.0 GW".
   - Negative numbers use the minus sign "−", not a hyphen.
   - Prices: `£/MWh` to two decimals for a single half-hour, whole pounds for averages; gas `p/therm` to one decimal, `p/kWh` to two; `$/MMBtu` (that capitalisation everywhere); `$/bbl`.
   - Gas volumes: "million m³/day" in body copy and cards; "mcm/d" only where space forces it (map labels), defined once in the legend.
   - Carbon: always "gCO₂/kWh", never bare "g".
6. **Dates and times.** `Fri 23 Oct 2026, 11:30 BST` (BST or GMT as applicable). No ISO strings in visible copy (`2026-10-11` becomes `11 Oct 2026`). Ranges use an en dash with no spaces: `11:00–11:30 BST`. That is the only dash allowed; prose has none.
7. **States** (from plan v2 §R1). Badge text: Not updated, Partial, Unavailable, Not yet available, Forecast, So far, Revised, Provisional. Replace the "Stale" badge everywhere with "Not updated" and the body "Latest data is from {observedAt}. Grid checks every hour."
8. **Missing values.** Never a bare "—" next to a number, never "0" for missing. Use "Not available" (data gap), "Not published" (source does not publish the field), "Not known" (owner/operator), "Not yet available" (source not added).
9. **Source credits.** One line per widget, format `Source: {Org} ({dataset}).` Electricity: "Elexon (BMRS)", "NESO (demand)", "NESO (embedded)", "NESO (constraints)", "NESO (balancing)", "NESO (FES)", "Carbon Intensity API", "Sheffield Solar, solar (PV Live estimate)". Licence attribution strings stay verbatim in the footer and on Data sources; do not repeat them inside every widget.
10. **Mix language.** "Share of generation". Imports are a separate balance term, never a slice of the mix.
11. **No internal jargon** in visible copy: Tinybird, Blob, warmed, envelope, payload, job, PUBOB codes, FUELINST, UUIDs, ISO timestamps. Dataset codes may appear only on Data health and Data sources, in a muted "Dataset" line.
12. **Labels.** Sentence case ("Your area", "Gas and oil"), "and" not "&", no exclamation marks, no "right now".
13. **Titles.** One convention: `{Page title} | Grid` on every page (fix /data-health, /privacy, /terms, /data-sources which use "— Grid", and the eight pages with no suffix). [DEV]

---

## 1. `/` Home

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 1 | Summary paragraph | "At 11:00 BST on Fri 23 Oct 2026, Wind was Britain's largest source of electricity at 13.9 GW (46%)." | "In the half-hour from 11:00 BST on Fri 23 Oct 2026, wind was Great Britain's largest source of electricity at 13.9 GW (46% of generation)." | Lower-case "wind"; GB scope; ties % to share of generation. |
| 2 | Summary paragraph | "Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV Live. Grid is free and updated hourly from public data." | "Sources: Elexon (BMRS), NESO (demand, embedded), Carbon Intensity API and solar (PV Live estimate). Grid is a free public dashboard and refreshes every hour." | Name NESO per dataset; approved solar credit; approved refresh line. |
| 3 | Mix card heading (second H) | "What's powering Britain?" (repeated under H1) | "Latest half-hour" | Duplicate of H1; card needs its own label. |
| 4 | Mix card subline | "Wind is the largest source of Britain’s electricity at 13.9 GW (46%)." | "Wind is the largest source of GB generation: 13.9 GW (46%)." | GB scope; consistent apostrophe style; less repetition of #1. |
| 5 | Balance line | "Generation 30.3 GW, plus Imports 8.1 GW, minus Exports 0.0 GW, equals Demand 38.4 GW." | "Generation 30.3 GW plus imports 8.1 GW minus exports 0.0 GW equals demand 38.4 GW." | Lower-case terms mid-sentence. |
| 6 | Balance tiles | "30.3GW", "8.1GW", "0.0GW", "38.4GW" | "30.3 GW", "8.1 GW", "0.0 GW", "38.4 GW" | Space before unit. [DEV] |
| 7 | Imports tile caption | "Power flowing into Britain" | "Into GB over interconnectors" | GB scope; says how. |
| 8 | Exports tile caption | "Power flowing out of Britain" | "Out of GB over interconnectors" | As above. |
| 9 | Demand tile caption | "Electricity use this half-hour" | "Demand in this half-hour, including embedded" | Precise; matches chart label. [DATA] confirm demand basis includes embedded. |
| 10 | Generation tile caption | "Plant and embedded wind and solar" | "Metered plant plus embedded wind and solar" | Clearer. |
| 11 | Donut heading | "Share of generation · of 30.3 GW generation" | "Share of generation (30.3 GW)" | Removes repetition. |
| 12 | Donut legend | "Solar\n1.7 GW · 6%" vs "Wind 46%" | Every row: "{Fuel} {x.x} GW · {n}%" | Same pattern for every slice. [DEV] |
| 13 | Stale state | "11:00–11:30 BST settlement period · Stale · Latest settlement period is not in yet" | Badge "Not updated". Body: "Latest data is from 11:00–11:30 BST. Elexon has not published a newer settlement period. Grid checks every hour." | Approved state copy (plan §R1). Also [DEV]: REPORT defect 3, two hours behind. |
| 14 | Card credit | "Elexon BMRS · NESO · Sheffield Solar PV Live" | "Source: Elexon (BMRS), NESO (embedded), solar (PV Live estimate)." | Credit convention. |
| 15 | Storage note | "Battery charging isn’t published." | "Battery charging is not published by Elexon, so it is not shown." | Plain, attributes the gap. [DATA] Data health lists a "Storage charging" series; confirm which is right. |
| 16 | Battery row | "discharge only; charging is a balance term" · "— —" | Caption "Discharge only. Charging counts in the balance, not the mix." Value "Not available". | Missing value convention; no semicolon chain. |
| 17 | Fuel group label | "Wind, solar and hydro" | Keep | Fine. |
| 18 | Fuel group label | "Other sources" (Nuclear, Biomass, Other) | "Nuclear, biomass and other" | "Other sources" containing "Other" is confusing. |
| 19 | Interconnector group | "Interconnectors 8.1 GW net import" | "Interconnectors · net import 8.1 GW" | Label then value; imports kept separate from mix. |
| 20 | Interconnector row | "Northern Ireland 0.2 GW net import" | Keep, add tooltip: "Flow on the Moyle link. NI figures are on a separate page, outside GB." | Makes the NI boundary explicit. |
| 21 | Chart heading | "Demand and generation, including embedded" | Keep | Fine. |
| 22 | Chart legend | "Exports (generation above demand)" / "Imports (demand above generation)" | "Net exports (generation above demand)" / "Net imports (demand above generation)" | They are net shading, not flows. |
| 23 | Chart credit | "Contains BMRS data © Elexon … Supported by National Energy SO Open Data. GB solar estimates from Sheffield Solar PV_Live…" | "Source: Elexon (BMRS), NESO (demand, embedded), solar (PV Live estimate)." Full licence text moves to footer. | Repeated three times per page. |
| 24 | Look-ahead | "Cleanest time to use power in the next 48 hours: 25 Oct 2026, 08:30–10:30 GMT (≈37 g)." | "Cleanest window in the next 48 hours: Sun 25 Oct 2026, 08:30–10:30 GMT (forecast about 37 gCO₂/kWh)." | Full unit; marks forecast; weekday; no ≈. |
| 25 | Look-ahead | "Wind is forecast to rise to 19.7 GW by tomorrow evening." | "Wind is forecast to reach 19.7 GW by Sat 24 Oct, {hh:mm} BST." | "Tomorrow evening" is vague and goes stale on share. [DEV] |
| 26 | Look-ahead credit | "Grid fetched 12:28 BST · Elexon WINDFOR · Contains BMRS data…" | "Forecast issued {time} BST. Source: Elexon (WINDFOR), NESO Carbon Intensity API." | Show issue time, not fetch time (plan R1); drop code jargon. |
| 27 | Stat strip | "159.8£/MWh" | "£159.80/MWh" | Symbol before number, two decimals for a half-hour. |
| 28 | Stat strip | "107g" | "107 gCO₂/kWh" | Full unit. |
| 29 | Stat strip | "30.4GW", "26.6GW", "5.4GW" | "30.4 GW", "26.6 GW", "5.4 GW" | Spacing. |
| 30 | Stat strip label | "Transfers" | "Net imports" | Says direction. |
| 31 | Stat strip | (no time shown; values differ from hero) | Add caption "Forecast for {time} BST" or "Average today so far" | [DATA] values (107 g, 30.4 GW) do not match the hero; state what period they cover. |
| 32 | Infrastructure H | "Power infrastructure in GB" | Keep | Fine. |
| 33 | Infrastructure sub | "England, Scotland and Wales." | "Great Britain: England, Scotland and Wales." | Ties to scope term. |
| 34 | Infrastructure note | "Rated capacity is not published for 49 sites. The gigawatts are the published total." | "49 sites do not publish a rated capacity and are not in this total." | Matches pipeline wording. |
| 35 | Infrastructure rows | "Gas 31.9 GW 48" | "Gas 31.9 GW · 48 sites" | Bare count is ambiguous. Same for every row and for pipeline rows ("486 projects"). |
| 36 | Pipeline block | "Pipeline 283.9 GW 10,126 projects"; "Consented 144.7 GW 5,956" | Use the /pipeline figures and labels: "In the pipeline 267.4 GW · 7,668 projects"; "Consented, not yet built". | [DATA] Home and /pipeline disagree (283.9 vs 267.4 GW; 10,126 vs 7,668). Home likely still includes Revised records. Must match. |
| 37 | Pipeline note | "Rated capacity is not published for 2,701 projects." | "{n} projects have no published capacity and are not in this sum." | Pipeline v3 wording; [DATA] count must match /pipeline (991). |
| 38 | Pipeline caveat | "Consent does not mean a project will be built." | Keep | Approved. |
| 39 | Links | "Open map →" | "Open map" | Arrow glyph as text; use icon. |
| 40 | Price H | "What does power cost?" | "What does electricity cost?" | Consistent with "electricity" elsewhere. |
| 41 | Price toggle | "Market" / "System" | "Market index" / "System price" | Match methodology terms. |
| 42 | Flows list | "2.00 GWin" | "2.00 GW in" and add "net import" header; or "Import 2.00 GW" | Missing space; make direction match /today ("Import 3.0 GW"). Pick one: "Import 2.0 GW". |
| 43 | Flows total | "Net transfers +8.10 GW import" | "Net import 8.1 GW" | No sign plus word; one decimal like hero. |
| 44 | Flows axis | "-2.1 … 2.1 GW" | "−2.1 … 2.1 GW" and axis title "Import (+) / export (−)" | Minus sign; explain sign. |
| 45 | Flows note | "Flows to and from Northern Ireland. NI figures are on a separate page." | "Moyle carries flows to and from Northern Ireland. NI figures are on a separate page, outside GB." | States which link; outside GB. |
| 46 | Mix-change axis | "0% 30% 60% 100%" | "0% 25% 50% 75% 100%" | Uneven ticks. [DEV] |
| 47 | Gas and oil H | "Gas & oil" | "Gas and oil prices" | No ampersand; says what. |
| 48 | Brent | "$115.22 /bbl" | "$115.22/bbl" | No space before slash. Same for "$3.10/MMBtu", "214.3 p/therm" keep space for p (p is unit). |
| 49 | SAP card | "The average price of gas traded on National Gas's On-the-day Commodity Market for that gas day. Data sourced from … Source: National Gas · gas day 21 Oct 2026" | "System Average Price for gas day 21 Oct 2026. Source: National Gas." | Shorter; one credit. |
| 50 | Gas chart caption | "Indexed, start = 100 (log scale). Source: U.S. EIA. Source: World Bank…. Data sourced from…" | "Indexed to 100 at the start of the period, log scale. Sources: U.S. EIA, World Bank (Pink Sheet), National Gas." | One "Sources:" line. |
| 51 | Gas chart trailing | "…Transmission Data Portal. UK gas price" | Separate link "Gas prices" | Link text fused into credit; "UK" breaks scope. |
| 52 | Records card | "23.9GW", "19g" | "23.9 GW", "19 gCO₂/kWh" | Spacing, unit. |
| 53 | Records card | "Days since coal power ended 753 · 30 Sep 2024" | "Days since GB's last coal power station closed: 753 (Ratcliffe-on-Soar, 30 Sep 2024)" | Precise claim, matches /records. |
| 54 | Coal story | "By 2026, coal’s share is 0% and carbon intensity has fallen to 141 g." | "In 2026 so far, coal's share is 0% and carbon intensity averages 141 gCO₂/kWh." | Year incomplete; full unit. |
| 55 | Coal story credit duplicated | "Supported by National Energy SO Open Data. Supported by National Energy SO Open Data. GB electricity records" | "Source: NESO (historic generation mix). See GB electricity records." | Duplicate string. [DEV] |
| 56 | Carbon H | "How clean is it?" | "How clean is GB electricity?" | Subject explicit. |
| 57 | Carbon axis | "g" | "gCO₂/kWh" | Unit. |
| 58 | Footer methodology | "Grid is compiled hourly from Elexon BMRS, NESO, the Carbon Intensity API and Sheffield Solar PV Live…" | "Grid is a public dashboard of Great Britain's electricity and gas. It refreshes every hour from Elexon, NESO, the Carbon Intensity API and solar (PV Live estimate). Oil and gas prices from EIA, the World Bank and National Gas refresh every 6 hours. How the numbers are made. The API page documents the public JSON." | Approved description (plan §1) plus refresh rule. |
| 59 | Footer stray | "25 Jul" (after footer links) | Remove | Leaked axis label. [DEV] |
| 60 | Header | "Data as of Fri 23 Oct 2026, 11:50 BST" | "Latest data: Fri 23 Oct 2026, 11:50 BST" | Plainer. |

## 2. `/today`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 61 | H1 | "Britain's electricity today" | "GB electricity today" | Only home H1 keeps "Britain"; matches title. |
| 62 | Summary | "…wind supplied 48% of Britain's generation, gas 14%, nuclear 20% and solar 1%… Source: Elexon BMRS, NESO; updated hourly." | "So far today (23 Oct 2026, to 11:30 BST), wind supplied 48% of GB generation, nuclear 20%, gas 14% and solar 1%. Carbon intensity averaged 75 gCO₂/kWh and the market index averaged £151/MWh. Sources: Elexon (BMRS), NESO (embedded), Carbon Intensity API, solar (PV Live estimate). Grid refreshes every hour." | Scope; descending order; full credit; approved refresh. |
| 63 | Meta line | "Updated 11:30 BST" | "Data to 11:30 BST" | It is data time, not update time (R1). |
| 64 | Latest half-hour card | "Demand. Generation 30.3 GW. Importing 8.1 GW, exporting 0.0 GW · 86 gCO₂/kWh · £200.56/MWh." | "Demand, 11:00–11:30 BST. Generation 30.3 GW, imports 8.1 GW, exports 0.0 GW. Carbon 86 gCO₂/kWh. Market index £200.56/MWh." | Readable list; states the half-hour. |
| 65 | Gas card | "How much came from gas · 3.4 GW average · 15.1 GWh so far today." | "Gas share of generation so far today · 3.4 GW average, 15.1 GWh" | Label consistent with "Share of generation". |
| 66 | Cheapest card | "Cheapest market index £84.57 · 04:30 BST · APXMIDP" | "Lowest market index £84.57/MWh · 04:30–05:00 BST" | Unit; half-hour range; drop code. |
| 67 | Dearest card | "Dearest market index £209.93" | "Highest market index £209.93/MWh · 10:00–10:30 BST" | Plain pair with "Lowest". |
| 68 | Comparison intro | "Yesterday and the weekly column reuse Grid's cached week payload, not a separate Tinybird query. The week window is the last seven days." | "Past 7 days covers the seven full days to yesterday." | Internal jargon. [DATA] confirm window definition. |
| 69 | Table headers | "Window · Carbon · Demand · Market index · Gas share" | "Period · Carbon (gCO₂/kWh) · Average demand (GW) · Market index (£/MWh) · Gas share of generation" | Units in header, values bare. |
| 70 | Imports list | "France · Import 3.0 GW" | Keep, list heading "Net flow by country" | Fine; heading precise. |
| 71 | Footer links | "See this settlement day on the homepage: 23 Oct 2026. Method and licences: /methodology." | "See 23 Oct 2026 on the home page. Method and licences: Methodology." | Raw path as link text. |
| 72 | FAQ Q1 | "How much of Britain's electricity is wind right now?" | "How much of GB electricity is from wind?" | "Right now" banned; scope. |
| 73 | FAQ A1 | "In the latest half-hour Grid holds, wind was 46% of generation (13.8 GW)." | "In the latest published half-hour ({time} BST), wind was 46% of generation (13.9 GW)." | [DATA] 13.8 vs 13.9 GW on home; use the same value. |
| 74 | FAQ Q3 | "Is Britain importing electricity today?" | "Is GB importing electricity today?" | Scope. |
| 75 | FAQ Q4 | "How clean is the grid today?" | "How clean is GB electricity today?" | Avoid lowercase "grid" clash with product name. |
| 76 | FAQ A5 credit | "Source: Elexon BMRS, NESO; updated hourly." (price) | "Source: Elexon (BMRS). Grid refreshes every hour." | Price is Elexon only. Same fix on every FAQ: credit only the actual source. |

## 3. `/api`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 77 | Intro | "It is free, needs no account, and is rate limited. … The limit is 60 requests a minute." | "It is free, needs no account and allows 60 requests a minute per IP address." | Merge; matches privacy. |
| 78 | Intro | "Existing endpoints keep working; new endpoints are under /api/v1." | "Older endpoints keep working. New endpoints are under /api/v1." | No semicolon; plainer. |
| 79 | Conventions | "Convert to UK time yourself." | "Convert to UK local time (Europe/London) yourself." | Precise zone; "UK time" is fine as a clock term. |
| 80 | Conventions | "Unsupported filters return an error; they are not silently ignored." | "An unsupported filter returns an error. It is never ignored." | Plain. |
| 81 | identifiers | "name is a separate search of 2 to 80 characters." | "Or search by name (2 to 80 characters)." | Clearer. |
| 82 | changes | "scope other than GB is rejected." | "Only scope=GB is supported." | Positive phrasing. |
| 83 | data-health | "Northern Ireland and other geographies are left out." | Keep | Fine. |
| 84 | Errors | "Unknown ID." etc. | Prefix with HTTP status: "404 Unknown ID.", "200 No results for these filters.", "400 This scope is not supported.", "503 The source is unavailable…" | [DATA] confirm codes. |
| 85 | Licence | "…on the Data sources page. Data sources" | "…on the Data sources page." (link the phrase) | Duplicated link text. |

## 4. `/assets` and asset detail

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 86 | H1 | "Power assets" | "Power stations, interconnectors and gas terminals in GB" | Matches title; scope. |
| 87 | Intro | "…schematic interconnectors from Elexon BMRS, and National Gas terminal names. Capacity is the megawatts the register counts, so a matched site is not added twice." | "Operating stations from DESNZ (REPD) and DESNZ (DUKES 5.11), interconnectors from Elexon and gas terminals from National Gas. A site in both registers is counted once." | Plain. |
| 88 | Region filter | Mixed lists: "East England" and "East of England", "North East" and "North East England", "Yorkshire" and "Yorkshire and the Humber", "Great Britain", "Northern Ireland" | One region scheme (ONS regions plus Scotland and Wales, plus "Offshore", "Location unavailable"). Remove "Northern Ireland" unless the asset is an interconnector landing. | [DATA][DEV] two schemes merged. NI in a GB list breaks scope. |
| 89 | Region option | "Not located" | "Location unavailable" | Approved term (plan §3). |
| 90 | Capacity column | "9 MW", "48.3 MW", "0.18 MW" | One decimal: "9.0 MW", "48.3 MW", "0.2 MW" | Consistent decimals. |
| 91 | Count | "3,340 assets" | "3,340 assets" keep; sort label ", ascending" → "Sorted by name, A to Z" | Fragment leaks. |
| 92 | Detail: capacity label | "MW · 6.1 MW" | "Rated capacity · 6.1 MW" | Label repeats the unit. |
| 93 | Detail: location | "Location precision · Published, approximate" and "Location · Published, approximate" | "Location · Published approximate · 51.80994, −5.00745" (once) | Duplicate; approved term has no comma. |
| 94 | Detail: Output | "Grid does not have this data yet. It will appear here once Elexon BMU metering is added." | "Grid does not have output data for this site yet. It will appear here once Elexon (BMRS) unit metering is added." | Approved template; less jargon. |
| 95 | Detail: operator | "REPD records 2376 as the operator." | "REPD records Foresight as the operator." | Bug: shows ID instead of name. [DEV] |
| 96 | Detail: owner | "Not available" | "Not known" | Approved term for owner/operator. |
| 97 | Detail: change history | "3 Aug 2026 · REPD · 6.1 MW · Counted" | "3 Aug 2026 · DESNZ (REPD) Q2 2026 · 6.1 MW" | "Counted" means nothing to readers. |

## 5. `/changes`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 98 | Title | "What changed in Britain's energy system" | "What changed in GB's energy system \| Grid" | Scope. |
| 99 | Item evidence | "Compared neso-open-data:tec-register:2026-10-13T13:58:33.755Z with neso-open-data:tec-register:2026-10-13T13:58:33.755Z." | "Compared NESO (TEC register) of {old date} with {new date}." | Jargon; [DEV] both sides show the same snapshot, so the comparison is wrong or the label is. |
| 100 | Item time | "Observed 2026-10-15T13:35:58.791Z" | "Found Thu 15 Oct 2026, 14:35 BST" | ISO and UTC in visible copy. |
| 101 | Count | "10 comparisons" | "10 changes" | Items are changes. |
| 102 | Credit | "Supported by National Energy SO Open Data" | "Source: NESO (TEC register)." | Credit convention. |

## 6. `/directory` and `/directory/identifiers`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 103 | Breadcrumb/heading | "Directory Directory Directory" | One "Directory" breadcrumb | Triple repeat. [DEV] |
| 104 | /directory section | "Look up an MPID or industry code" on the name search page | "Search by organisation name" | This page searches names. |
| 105 | /identifiers heading | "Energy organisations and codes" | "Look up a code" | Heading matches function. |
| 106 | Source note | "Elexon Industry Standing Data. Industry Standing Data from the Elexon ISD Data Store. The store is publicly available. Grid shows the fields needed to look up a code. Elexon has not identified ISD under the BSC Open Data Licence, so Grid does not offer a download of the extract." | "Source: Elexon (Industry Standing Data). Grid shows only the fields needed for a lookup and does not offer a download." | Repetitive. Licence reasoning stays on Data sources. |
| 107 | Empty state (new) | none; page errors on load (REPORT defect 4) | "Enter a name or code to search." | [DEV] no fetch until input. |

## 7. `/electricity/northern-ireland`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 108 | Intro | "Outside GB. This page covers Northern Ireland and the all-island Single Electricity Market (Northern Ireland and Ireland). Grid's GB figures never include Northern Ireland." | Keep | Matches rule. |
| 109 | Partial banner | "Some of Northern Ireland's data is missing for this period. Totals may be lower than the full figure." | Keep for partial. When stale (today's case) use: "Not updated · Latest data from SONI is from {observedAt}." | Approved stale string (plan §NI). |
| 110 | Headline values | "1102MW", "952MW", "432MW", "213MW", "14MW", "3MW", "0MW" | "1,102 MW", "952 MW", "432 MW" etc. | Separator and space. |
| 111 | Row timestamps | "Fri 23 Oct 2026, 22:00 BST … 23:45 BST" with "—" | Show latest 8 readings; missing reads "Not available" | [DEV] future times (REPORT defect 2); dash convention. |
| 112 | Carbon card | "—gCO₂/kWh" | "Not yet available" with body "Grid will show Northern Ireland carbon intensity once SONI's terms are confirmed." | Standing rule. |
| 113 | Solar forecast | "0MW" with eight "0" rows | "0 MW" and rows "0 MW"; label "Forecast" badge | Unit on rows; forecast distinguished. |
| 114 | Moyle / net transfer | "Moyle 14MW", "NI net transfer 14MW" | "Moyle · 14 MW to Northern Ireland" / "Net import to NI · 14 MW" | Direction missing. [DATA] GB home says Moyle 0.18 GW into GB at 11:00; confirm sign. |
| 115 | Fuel mix | "NI gas 6578.39 · 38%" | "Gas · 6,578 MWh · 38%" | Unit missing, false precision. [DATA] confirm unit and period. |
| 116 | Fuel mix | "NI net import 7238.90 · 41%" | Move out of mix: "Net import · 7,239 MWh (not part of generation share)" | Imports are a balance term. |
| 117 | SEM price (all-island tab) | (check) | "SEM imbalance price · €{x.xx}/MWh · Source: SEMO" | € rule; confirm tab copy, not captured in text. [DATA] |
| 118 | Credit | "Supported by EirGrid Group Data EirGrid Group Open Data Licence." | "Source: SONI and SEMO, via EirGrid Group Smart Grid Dashboard. EirGrid Group Open Data Licence." | Punctuation; names operators. |

## 8. `/explained/price-cap`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 119 | Intro | "Until Ofgem publishes that figure, Grid does not show a January 2027 cap." | Keep | Fine. |
| 120 | Table header | "Typical dual-fuel DD" | "Typical dual-fuel Direct Debit (a year)" | No abbreviation; unit. |
| 121 | Source column | "Ofgem, 21 November 2025" repeating Announced | "Ofgem" (link) | Duplicates the date column. |
| 122 | Not published | "That page may appear earlier." | "Ofgem may publish earlier." | "That page" unclear. |
| 123 | Window | "Secondary sources put the window for the January 2027 cap at 19 August to 17 November 2026." | Keep and name the source, or cut. | [DATA] unnamed secondary sources. |
| 124 | SAP | "6.36p/kWh (186.4 p/therm) over 64 published gas days from 19 Aug 2026 to 21 Oct 2026. … UK gas price." | "6.36 p/kWh (186.4 p/therm) across 64 published gas days, 19 Aug to 21 Oct 2026. See gas prices." | Spacing; link text. |
| 125 | Cover | "…not a fixed deal you already signed. … Today's electricity mix: /today." | "…and not fixed tariffs. See today's GB electricity mix." | Raw path. |
| 126 | FAQ Gas | "Gas-fired stations also often set Britain's wholesale electricity price" | "…often set the GB wholesale electricity price" | Scope. |
| 127 | Scope note (new) | none | "The price cap applies in England, Scotland and Wales." | Accurate scope statement (Ofgem cap is GB). |

## 9. `/gas`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 128 | H1 | "Where is Britain's gas coming from, and where is it going?" | "Where is GB's gas coming from, and where is it going?" | Scope. [DATA] plan v2 table approved the Britain H1 for /gas; if the Lead prefers that, keep it and note the exception. |
| 129 | Kicker | "GAS · GB / NTS" | "Gas · National Transmission System" | Sentence case; plain. |
| 130 | Data line | "Data time … · Published … · Retrieved …" | "Data to 13:00 BST · Published 13:05 BST" | Same day repeated thrice; retrieval belongs on Data health. |
| 131 | Partial note | "This gas day is not complete. Figures cover Fri 23 Oct 2026, 05:00 BST to Fri 23 Oct 2026, 13:00 BST." | "So far · This gas day runs 05:00 to 05:00. Figures cover 05:00–13:00 BST on Fri 23 Oct 2026." | Shorter; "So far" badge. |
| 132 | Card badges | "Partial" + "Current flow rate" | Badge "So far"; caption "Latest hourly flow rate" | "Partial" means missing data in the approved scheme; "current" banned. |
| 133 | Linepack card | "338.4 million m³ · Current flow rate" | "338.4 million m³ · Latest reading" | Linepack is a stock, not a rate. |
| 134 | Table | Supply/Demand alternate rows with "—" | Columns aligned to the hour; blank cells empty, not "—"; note "Supply is hourly; demand is published every 2 minutes in the last part of each hour." | [DATA] confirm cadence; dash convention. |
| 135 | Chart caption | "National Gas PUBOB19, PUBOB2042, PUBOB2043, PUBOB2044. Data sourced from…" | "Source: National Gas (NTS flows). Updated hourly." | No codes. |
| 136 | Entry rows | "System Entry Flows, North, Physical · PUBOB2043" | "North entry points · 69.1 million m³/day · 43%" | Plain labels; same order as demand rows. |
| 137 | Demand rows | "Distribution networks (LDZ offtake) — Gas taken by local distribution networks. Includes homes, businesses and some industry." | "Distribution networks (LDZ offtake). Gas taken by local networks for homes, businesses and some industry." | No dash. |
| 138 | Demand rows | "Industrial Demand Flow", "Power Station Demand Flow" etc. sub-labels | Remove sub-labels | Raw dataset names repeat the label. |
| 139 | LDZ caveat | "It is not a direct live measure of household heating." | "It is not a direct measure of household heating." | "live" banned. |
| 140 | Storage empty | "Storage inventory unavailable for this selection. … Grid does not currently have a compatible inventory series." | Badge "Not yet available": "Grid does not have gas storage stock levels yet. Injection and withdrawal flows are shown above." | Approved template. |
| 141 | Comparison table | "Gas day 22 Oct 2026, 05:00–05:00 BST · Current flow rate · Complete" | "22 Oct 2026 · Completed gas day · 151.2 · 134.9" with unit "million m³/day" in header | Basis contradicts state; unit missing. [DATA] only one comparison row shown. |
| 142 | Definitions | "System Average Price, a wholesale benchmark." / "Gas held in the pipelines." | "SAP: System Average Price, a wholesale benchmark, not a household tariff." / "Linepack: gas held in the pipelines." | Definitions lack terms. |
| 143 | Stray | trailing "0.0" | Remove | Leaked axis label. [DEV] |

## 10. `/map`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 144 | H1 | two "Flows across GB borders" | One H1 | [DEV] |
| 145 | Stale banner | "Not updated since 23 Oct, 11:50 BST. Showing the last published reading." | "Not updated · Latest electricity data is from 23 Oct, 11:50 BST. Grid checks every hour." | Approved template. |
| 146 | Direction labels | "Importing to GB" vs "Into the GB system" vs "Out of the GB system", "Exporting from GB" | Electricity and gas both: "Into GB" / "Out of GB" | One pair. |
| 147 | Zero rows | "Barrow · — · 0.0 mcm/d" | "Barrow · No flow · 0.0 mcm/d" or "Not available" if missing | Dash beside a number contradicts. [DATA] which is it. |
| 148 | Legend | "Under 500 MW. Under 20 mcm/d" | "Under 500 MW or under 20 mcm/d" | Read as one band. |
| 149 | Totals | "Net import 8,192 MW across 10 links" | "Net import 8,192 MW across 10 interconnectors" | Term used site-wide. |
| 150 | Totals | "Net into the GB system 147.8 mcm/d" | "Net gas into GB 147.8 mcm/d (million m³/day)" | Defines unit once. |
| 151 | Projects note | "Projects stay off the map until each one has a coordinate and a country." | "A project appears on the map once it has a published location." | Plain. |
| 152 | Credits | five stacked lines | "Sources: Elexon (BMRS), National Gas, NESO (DNO licence areas), GeoNames, OS." Licence lines to footer. | Convention. |

## 11. `/methodology`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 153 | Intro | "…Sheffield Solar PV Live, plus slower oil and gas series…" | "…solar (PV Live estimate), plus oil and gas prices from EIA, the World Bank and National Gas, which refresh every 6 hours." | Approved credit and refresh. |
| 154 | Sources table (Elexon row) | "…attach the warmed FUELINST series… reads the warmed interconnector envelope from Blob…" | "Market index, system price, demand (ITSDO), generation and interconnector flows (FUELINST), wind forecast (WINDFOR) and demand forecast (NDF). Refreshes every hour." | Internal jargon. |
| 155 | Sources table (NESO row) | "…published to Blob…" | Split by dataset: "NESO (embedded): embedded wind and solar estimates and forecasts. NESO (constraints): weekly constraint costs and volumes. NESO (balancing): day-ahead boundary flows and limits. NESO (TEC register): connection capacity. NESO historic generation mix: Year, All and records." | NESO named per dataset. [DATA] confirm FES use; none visible. |
| 156 | National Gas row | "The hourly job also reads the instantaneous per-site flow API, without a login, and publishes terminal readings to Blob" | "Also hourly readings for each terminal, used on the map. Theddlethorpe is omitted; Moffat is included because National Gas publishes that exit. Updated hourly." | Jargon. |
| 157 | DUKES row | "DESNZ Digest of UK Energy Statistics … UK annual energy balance" | Keep "UK", add "(includes Northern Ireland)" | Correct scope disclosure. |
| 158 | DNO row | "…come with the disclaimer that they are probably a little outdated and not 100% accurate." | "NESO notes the boundaries may be out of date and are not exact." | Plain. |
| 159 | FAQ | "Ingest runs hourly for the GB grid and every six hours for commodities." | "Grid refreshes every hour. Oil and gas prices refresh every 6 hours. Physical gas data is updated hourly." | Approved wording; numeral 6. |
| 160 | FAQ | "The site is not a second-by-second feed." | Keep | Fine. |
| 161 | Data checks | "1.15× demand" | Keep | Fine. |
| 162 | Cite | "{date time}" | "{date, time BST}" | Placeholder clarity. |

## 12. `/pipeline`

Approved copy is v3.2. Items below are drift from it only.

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 163 | Rated capacity | "267.4GW" | "267.4 GW" | Spacing. |
| 164 | Edition line | "July 2026 (Q2). Published 3 Aug 2026." | "DESNZ (REPD), July 2026 (Q2). Published 3 Aug 2026." | Source named on first figure. |
| 165 | Stage rows | "27.9 GW 452" | "27.9 GW · 452 projects" | Bare count. |
| 166 | Tech rows | "Anaerobic digestion 0.1 GW 90" | Keep (0.1 GW is not under 0.1). | Checked against v3.2 rule. |
| 167 | Tech rows | "Unspecified · Not published 2" | "Technology not published · capacity not published · 2 projects" | Clearer. |
| 168 | Attrition | "34% 616" etc., no labels for 9% 163 / 18% 318 | Label every bar: "Operating 34% (616)", "Built, not yet operating 9% (163)", "Consented, not yet built 18% (318)" | [DATA] confirm the two unlabelled bars' meaning against COPY.md. |
| 169 | Medians | "1 year, 34 days" | "1 year 34 days" (or "399 days") | One format; others in days. |
| 170 | Medians | "120 days · 11,376 projects" | Add step labels: "Application to decision", "Consent to construction", "Construction to operation" | Unlabelled. |
| 171 | NI card | "282 projects, 3.2 GW. These are outside the GB total." | Keep | Approved. |

## 13. `/prices/gas`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 172 | H1/title | "UK gas price today" | "GB gas price today" (title "GB gas price today: SAP, Henry Hub, Europe and Japan LNG \| Grid") | Scope rule. [DATA] SEO case for "UK" in title; Lead decides, but H1 must say GB. |
| 173 | Summary | "7.31p/kWh (214.3p/therm)" | "7.31 p/kWh (214.3 p/therm)" | Spacing. |
| 174 | Meta | "Updated 21 Oct 2026" | "Gas day 21 Oct 2026. Prices refresh every 6 hours." | Data time vs refresh. |
| 175 | Cards | "3.10 $/MMBTU", "25.42 $/MMBTU" | "$3.10/MMBtu", "$25.42/MMBtu" | Symbol prefix; one capitalisation. |
| 176 | Card | "EU natural gas" | "Europe natural gas" | World Bank series is Europe, not EU. |
| 177 | Cards | "1 Sep 2026 · World Bank Pink Sheet" | "Sep 2026 (monthly) · World Bank" | Monthly series, not a day. |
| 178 | Body | "World Bank monthly Europe gas and Japan LNG are the Asian and European context" | "World Bank monthly Europe gas and Japan LNG prices give European and Asian context." | Order matches. |
| 179 | FAQ | "Grid stores SAP in p/kWh and shows p/therm for traders." | "Grid stores SAP in p/kWh and also shows p/therm, the unit traders use." | Clearer. |
| 180 | FAQ | "See today's mix on /today. Grid does not claim a share of hours without a cited calculation." | "See today's GB electricity mix." | Raw path; second sentence is internal. |

## 14. `/records`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 181 | Kicker | "Great Britain" | Keep | Fine. |
| 182 | Card meta | "NESO historic generation mix. From 1 Jan 2009. Half-hour. Transmission-connected wind plus embedded wind, from NESO historic generation mix." | "Transmission-connected and embedded wind, half-hourly, from 1 Jan 2009. Source: NESO historic generation mix." | Dataset named twice. |
| 183 | NESO compare | "NESO official record: 23,880 MW, 25 Mar 2026, 13:30 (source: NESO)" | "NESO official record: 23.9 GW (23,880 MW), Wed 25 Mar 2026, 13:30 GMT" | Unit match; zone; "(source: NESO)" redundant. |
| 184 | Zero-carbon | Grid 90.2% vs "NESO official record: 98.8%, 22 Apr 2026" | Add: "NESO's record uses a different definition, so the figures differ." | [DATA] confirm reason; 8.6-point gap unexplained. |
| 185 | Coal card | "Britain's last coal power station" | "GB's last coal power station" | Scope. |
| 186 | Coal card | "NESO official record: Britain stopped using coal for electricity in 2024" | "NESO: GB stopped using coal for electricity in 2024." | Not a record; scope. |
| 187 | Milestones H | "First time above N GW of wind" | "First half-hour with wind above each gigawatt" | Placeholder "N". |
| 188 | Table header | "First half-hour (London)" | "First half-hour (UK time)" | Plain. |
| 189 | Chart note | "The sentences use those averages; they are not hard-coded." | Cut | Internal. |
| 190 | FAQ | "When did Britain stop burning coal for electricity?" | "When did GB stop burning coal for electricity?" | Scope. |
| 191 | Stray | "Back to Grid", trailing "0%" | "Back to home"; remove "0%" | Leak. [DEV] |

## 15. `/system/constraints`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 192 | Sub | "NESO financial year 2026-2027." | "NESO financial year 2026/27 (from 1 Apr 2026)." | No hyphen range in prose. |
| 193 | Stale note (new) | none | "From NESO (constraints), latest settlement date 11 Oct 2026. NESO publishes this with a lag." | [DATA] confirm lag; REPORT defect 7. |
| 194 | Cost caption | "Source: NESO (constraints). Published cost of actions taken to manage transmission constraints, £." | "Cost of actions NESO took to manage transmission constraints, in £. Source: NESO (constraints)." | Unit in sentence, credit last. |
| 195 | Axes | "£9,000,000 … £36,000,000" | "£9m … £36m" | Readable. |
| 196 | Axes | "-165,000MWh … 55,000MWh" | "−165,000 MWh … 55,000 MWh" | Minus and spacing. |
| 197 | Table | "Settlement date 2026-10-11" | "Settlement date 11 Oct 2026" | Date format. |
| 198 | Table | "968,377 · 13,928 · 37%" under "£ · MWh" | "£968,377 · 13,928 MWh"; negative "−3,557" | Units and minus. |

## 16. `/system/storage`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 199 | Title | "Electricity storage in Britain" | "Electricity storage in GB \| Grid" | Scope. |
| 200 | Headline | "Rated capacity 7846.3 MW" | "Operating rated capacity 7,846.3 MW" | Separator; says operating. |
| 201 | Coverage | "2900.0 of 2900.0 MW" | "2,900.0 of 2,900.0 MW monitored" | Separator; meaning. |
| 202 | Coverage | "Batteries are not reported separately by the source." | "Elexon does not report batteries separately." | Names source. |
| 203 | Coverage | "FUELINST publishes national totals…" | "Elexon publishes national totals for transmission-connected pumped storage. The capacity shown is the operating pumped storage in the registers." | Jargon. |
| 204 | Inventory | "2463 records are not operating…" | "2,463 records are not operating…" | Separator. |
| 205 | Split | "37% 2900.0 MW / Battery 63% 4946.3 MW" | "Pumped storage 2,900.0 MW (37%) · Battery 4,946.3 MW (63%)" | Pumped storage label missing. [DATA] home and projects say battery 4.9 GW / 4,946.4 MW; align rounding. |
| 206 | Table | "1800.0" and blanks | "1,800.0"; blank cells "Not published" | Separator; missing convention. |
| 207 | Monitored | "A positive FUELINST sample is discharge. A negative sample is charging." | "Positive values are discharge; negative are charging." | Jargon. |
| 208 | Monitored | "Charging 0.0 MW" | "Charging 0 MW" | Whole MW for flows. |

## 17. `/system/whole-energy`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 209 | Title | "How Britain's energy fits together" | "How UK energy fits together \| Grid" | Source is the UK balance; say so rather than "Britain". |
| 210 | Scope tag | "UK, annual statistic." | "UK, including Northern Ireland. Annual, 2025." | Explicit because Grid is GB elsewhere. [DATA] confirm Lead accepts a UK page. |
| 211 | Cards | "671.4TWh" etc. | "671.4 TWh" | Spacing. |
| 212 | Table | "1099.3", "1579.9", "-730.4" | "1,099.3", "1,579.9", "−730.4"; header "TWh" | Separator; minus. |
| 213 | Notes | "Stock fall (+), stock rise (-)." | "Stock change: a fall is positive, a rise is negative." | Plain. |
| 214 | Homes card | "395.5TWh · 26% of final consumption" under heading "Final consumption · Transport · Industry" | Heading "Homes"; "395.5 TWh · 26% of final consumption" | Heading mismatch. [DEV] |

## 18. `/projects` and project detail

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 215 | Title | "Energy projects in Britain" | "Energy projects in GB \| Grid" | Scope. |
| 216 | Headline | "57440.4 MW" / "689908.6 MW" | "57,440.4 MW" / "689,908.6 MW" (or "57.4 GW", "689.9 GW") | Separator; GW for consistency with home. |
| 217 | Connection caveat | "Capacity across stages and technology types is currently presented in aggregate, which may result in duplicate entries." | "NESO notes that this total may count some capacity twice." | Plain. |
| 218 | Tech rows | "16011.0 MW · 28%", "Anaerobic digestion 322.9 MW · 0%" | "16,011.0 MW · 28%"; under 1% show "<1%" | Separator; 0% for nonzero misleads. |
| 219 | Tech rows | "Flywheel 400.0 MW · 1%" | [DATA] Flywheels were removed from GB data elsewhere; confirm or remove. | Consistency with pipeline decision. |
| 220 | Card status | "Planning Granted · Construction Not started · Unknown" | "Planning: granted · Construction: not started · Connection: not known" | Unlabelled third value. |
| 221 | Card status | "Planning Revised" | Hide Revised records, or label "Revised (replaced by a newer application)" | Matches pipeline rule. |
| 222 | Card | "Connection capacity Not published" | Keep | Approved term. |
| 223 | Detail H1 | "Where is Perham Down - Meadow Solar Farm & Battery Storage up to?" | "Where has Perham Down Meadow Solar Farm and Battery Storage got to?" | Grammar; hyphen and & in source name normalised. [DATA] confirm name normalisation is acceptable. |
| 224 | Detail connection | "Unknown, Unknown, Unknown · No source published" | "Not known · No connection record found" | Triple repeat. |
| 225 | Detail operation | "Proposed" with no source | "Proposed · DESNZ (REPD), 3 Aug 2026" | Every status needs a source per page promise. |
| 226 | Detail | "Storage energy" (empty) | "Storage energy · Not published" | Empty label. |

## 19. `/data-health`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 227 | Badge | "Stale" | "Not updated" | Approved badge. |
| 228 | Empty rows | "Not yet available — · Published — · Retrieved —" | Gas-day series pending: "Pending · Published after the gas day ends". Never retrieved: "Not yet available · Grid does not have this series yet." | Dashes; distinguishes pending from missing. [DEV] REPORT defect 5. |
| 229 | Value rows | "{n} %" | "{n}%" | No space before %. |
| 230 | Dataset ids | "NESO · 7f5…-uuid · PTNM" | "NESO (embedded) · Dataset: Embedded wind and solar" | UUIDs and cadence codes ("PTNM", "PND") are unreadable. |
| 231 | Intro | "…Retrieved is when Grid stored that envelope." | "Retrieved is when Grid fetched it." | Jargon. |
| 232 | NI section | EirGrid rows on this page | Group under heading "Northern Ireland and all-island (outside GB)" | Scope label. |

## 20. `/data-sources`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 233 | How Grid uses data | "Ingest reads these APIs on a schedule, stores snapshots in Tinybird, and serves the dashboard from cache… published to Blob" | "Grid reads these sources on a schedule, stores each reading with its source time, and serves the dashboard from stored copies. Missing values stay empty, never zero." | Jargon. |
| 234 | Licence lines | "Read on 20 Oct 2026.. Source:" | "Read on 20 Oct 2026. Source:" | Double full stop (every row). [DEV] |
| 235 | NESO licence | "The previous licence path returned 404; this URL is the NESO Open Licence v1.0." | Cut first clause: "NESO Open Data Licence v1.0." | Internal note. |
| 236 | Sheffield credit | "GB solar estimates from Sheffield Solar PV_Live…" | Keep verbatim (licence text); label row "Sheffield Solar, solar (PV Live estimate)" | Attribution text stays; name follows convention. |
| 237 | ONS credit | "licensed under the Open Government Licence v.3.0" | "v3.0" | Matches other rows. |

## 21. `/tools`, `/privacy`, `/terms`

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 238 | Tools intro | "Grid links to them; it does not run them unless marked." | "Grid links to these services. Ones marked Runs on Grid are Grid pages." | Plain. |
| 239 | Tools cards | Full URLs shown as text | Show domain only ("ofgem.gov.uk") | Readability. |
| 240 | Tools DNO card | "Stations and DNO licence areas. The DNO layer starts off." | "Turn on the DNO licence areas layer on the map to see your network operator." | Instruction, not state. |
| 241 | Tools Citizens Advice | "England and Wales" | Keep; add Advice Direct Scotland link for Scotland. | [DATA] scope gap for GB. |
| 242 | Privacy | "public electricity dashboard" | "public dashboard" | Standard phrase. |
| 243 | Terms | "Grid is a public, informational GB electricity dashboard. It is not a trading terminal, not a forecast product you should rely on, and not financial advice." | "Grid is a public dashboard of GB energy data for information only. It is not a trading tool, a forecast to rely on, or financial advice." | Covers gas too; tidy list. |
| 244 | Terms | "…ingested on a half-hourly or slower cadence…" | "…refreshed every hour or less often…" | Matches refresh rule. |
| 245 | Terms "Code licence" | "The Grid source code is released under the MIT Licence." | Remove section or reword to "Third-party data stays under the licences listed on Data sources." | [DATA] conflicts with "never say open source / don't reference the repo"; Lead to decide. |

## 22. Global chrome

| # | Widget | Current | Replacement | Reason |
|---|---|---|---|---|
| 246 | Desktop nav | current page name repeated first ("Grid Map Map Today…") | Hide page-title slot at desktop widths | [DEV] REPORT defect 9. |
| 247 | Footer | "Made by Alex Vakhitov." | Keep | Fine. |
| 248 | Help buttons | "?" | Accessible name "About {widget}" | Screen readers hear "question mark". [DEV] |

---

## Flags needing data confirmation (summary)
36/37 home vs /pipeline totals; 31 stat strip period; 73 wind 13.8 vs 13.9 GW; 15 battery charging published or not; 114 Moyle direction; 115 NI fuel-mix unit; 117 SEM € tab copy; 123 cap window source; 134 gas cadence; 141 gas comparison rows; 147 Barrow/Bacton zero vs missing; 168 attrition bar labels; 184 zero-carbon gap; 193 constraints lag; 205 battery rounding; 210 UK whole-energy page; 219 flywheel; 223 name normalisation; 241 Scotland advice; 245 MIT code licence; 84 API status codes; 155 NESO FES use.
