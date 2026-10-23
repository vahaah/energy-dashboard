# Fix list: grid-site-audit (all pages)

Source: /workspace/grid-audit/reviews/design.md (20 Oct 2026). Status: all items Open. Sorted by severity, then ID. XS items close the page items that reference them.

| Prefix | Blocker | Worth fixing | Minor | Must-fix | Nice-to-have | Total |
|---|--:|--:|--:|--:|--:|--:|
| XS | 5 | 8 | 2 | 13 | 2 | 15 |
| HOME | 4 | 7 | 3 | 11 | 3 | 14 |
| TODAY | 1 | 4 | 2 | 5 | 2 | 7 |
| GAS | 3 | 4 | 3 | 7 | 3 | 10 |
| NI | 3 | 3 | 3 | 6 | 3 | 9 |
| PIPE | 2 | 3 | 2 | 5 | 2 | 7 |
| MAP | 3 | 3 | 2 | 6 | 2 | 8 |
| ASSETS | 1 | 2 | 1 | 3 | 1 | 4 |
| ASSET | 1 | 3 | 1 | 4 | 1 | 5 |
| PROJ | 1 | 3 | 1 | 4 | 1 | 5 |
| PROJD | 1 | 1 | 1 | 2 | 1 | 3 |
| DH | 2 | 3 | 1 | 5 | 1 | 6 |
| CONS | 2 | 2 | 1 | 4 | 1 | 5 |
| STOR | 1 | 3 | 2 | 4 | 2 | 6 |
| WE | 1 | 2 | 3 | 3 | 3 | 6 |
| REC | 0 | 2 | 3 | 2 | 3 | 5 |
| PGAS | 0 | 2 | 3 | 2 | 3 | 5 |
| CAP | 0 | 1 | 2 | 1 | 2 | 3 |
| CHG | 1 | 1 | 2 | 2 | 2 | 4 |
| API | 0 | 2 | 2 | 2 | 2 | 4 |
| TOOLS | 0 | 2 | 1 | 2 | 1 | 3 |
| DIR | 1 | 2 | 3 | 3 | 3 | 6 |
| METH | 0 | 2 | 0 | 2 | 0 | 2 |
| SRC | 0 | 1 | 2 | 1 | 2 | 3 |
| LEGAL | 0 | 0 | 2 | 0 | 2 | 2 |
| **Total** | 33 | 66 | 48 | 99 | 48 | 147 |

| ID | Widget | Fix | Priority | Severity | Status |
|---|---|---|---|---|---|
| XS-01 | Figures disagree between pages | Use a single selector per metric (generation mix, price, intensity, pipeline totals) and print one "as of" stamp per card. Home infrastructure should read the /pipeline aggregate (267.4 GW / 7,668). | Must-fix | Blocker | Open |
| XS-02 | Number and unit format | Add a shared `formatEnergy()` that applies separators, switches MW to GW at ≥1,000 MW (1 dp) and renders the unit in a `<span>` at 0.6em `gray-900` with a thin space. Applies to KPI, table and tooltip. | Must-fix | Blocker | Open |
| XS-03 | Stale, unavailable and partial states | Use one `<Freshness>` component: amber-700 `border-l-2`, the "Not updated" slot and an "as of {London time}" slot. "—" with an `aria-label` slot for the reason, never 0. ◐ Partial shows a tooltip with the reason. Show it once per card, not three timestamp blocks. | Must-fix | Blocker | Open |
| XS-04 | Mobile tables and labels | Use `<TableScroll>` with a right-edge fade (gradient from `surface-card`, **proposed**), a sticky first column and a caption "Swipe for more columns" (slot). Below 480 px, switch row-heavy tables to stacked key/value cards. Bar labels go above the bar, never truncated. | Must-fix | Blocker | Open |
| XS-05 | Colour-only encoding (1.4.1) | Use direct labels at line ends or bar segments, plus a legend with swatch and text. Map flows get chevrons and width by MW. Stage bars get inline labels with % and a text table alternative. | Must-fix | Blocker | Open |
| ASSET-01 | Location minimap | A blank box with one dot. Use Protomaps tiles at zoom 9 with a scale, or remove it. | Must-fix | Blocker | Open |
| ASSETS-01 | Table at 375 | "Statu…", "Opera…" clipped with no scroll cue (→XS-04). | Must-fix | Blocker | Open |
| CHG-01 | Change items | Raw "2026-10-13T13:58:33.756Z" and dataset slugs in the body. Use London time and a human dataset name (→XS-08). | Must-fix | Blocker | Open |
| CONS-01 | Cost and volume charts | Three series (grey, amber, blue) with no legend (→XS-05). | Must-fix | Blocker | Open |
| CONS-04 | Settlement-date table | 2026-10-11 is 12 days old with no lag note, and the date is in ISO. Use XS-03 plus a "Published with a lag of n days" slot, with the date as "Sun 11 Oct 2026". | Must-fix | Blocker | Open |
| DH-01 | Series list | 18,822 px of about 150 four-line blocks. Use a status-first table: summary counts (OK / Stale / Missing) at top, problems first, OK collapsed (→XS-06). | Must-fix | Blocker | Open |
| DH-04 | Source ID | Exposes a UUID. Remove it from the UI. | Must-fix | Blocker | Open |
| DIR-01 | Page | HTTP 400 on load (REPORT P1). Add an error state slot with a retry option (→XS-03). | Must-fix | Blocker | Open |
| GAS-01 | Data table | Expanded by default (about 100 sparse rows) above the chart while the button reads "Show table". Collapse by default, put it below the chart, and fix the button state and `aria-expanded`. | Must-fix | Blocker | Open |
| GAS-02 | KPI cards | All four show "Partial". Give the reason per card in a tooltip. If all are partial, use one page-level ◐ note (→XS-03). | Must-fix | Blocker | Open |
| GAS-04 | Codes | Raw PUBOB codes are shown. Use human labels, with the code in a tooltip or table only. | Must-fix | Blocker | Open |
| HOME-01 | KPI strip (bottom) | Use the same values and stamp as the hero (→XS-01), or delete the strip. It currently shows 159.8 vs 200.56 £/MWh, 107 vs 86 g and 30.4 vs 38.4 GW. | Must-fix | Blocker | Open |
| HOME-02 | Generation bars at 375 | Labels show as "G…", "W…" and "Nuclea..". Put labels above bars at full width and the value right-aligned (→XS-04). | Must-fix | Blocker | Open |
| HOME-03 | Infrastructure card | Shows 283.9 GW / 10,126 against /pipeline's 267.4 GW / 7,668. Read the pipeline aggregate. "2,701" has no unit or label: add a label slot. | Must-fix | Blocker | Open |
| HOME-04 | Settlement-period badge | Shows 11:00–11:30 at 13:00 with no stale pattern. Apply XS-03. | Must-fix | Blocker | Open |
| MAP-01 | Theme | Light mode renders dark at 1280 (light is correct at 375). Respect the theme for tiles and chrome (D4 Protomaps light flavour). | Must-fix | Blocker | Open |
| MAP-02 | Inspector | "Select a flow from the list." but there is no list. Add the flow list, or change the empty-state slot. | Must-fix | Blocker | Open |
| MAP-03 | Flows | All one orange with no direction. Add chevrons, width by MW, and a direction label in the inspector (→XS-05). MP-06 is still open. | Must-fix | Blocker | Open |
| NI-01 | Stale banner | Data stale since 10:15. The banner is not the UX.md stale pattern. Apply XS-03 to every card, not only the banner. | Must-fix | Blocker | Open |
| NI-02 | Future rows | 22:00–23:45 are all "—". Hide future periods or group them as "Not yet published" (slot). | Must-fix | Blocker | Open |
| NI-03 | Tables vs headlines | 8-row mono tables contradict the headline figures. Use one source (→XS-01). | Must-fix | Blocker | Open |
| PIPE-01 | Stage bar (PL-10 open) | Colour-only blue/green/amber. Add inline segment labels and a legend (→XS-05). | Must-fix | Blocker | Open |
| PIPE-07 | Mismatch with home | →XS-01 / HOME-03. | Must-fix | Blocker | Open |
| PROJ-01 | KPI cards | "57440.4 MW" and "689908.6 MW" have no separators and should be in GW (→XS-02). | Must-fix | Blocker | Open |
| PROJD-01 | h1 | "Unknown, Unknown, Unknown". Fallback slot "{technology} project, {ref}" (→XS-07). | Must-fix | Blocker | Open |
| STOR-01 | Inventory table | Hundreds of rows, 9,868 px at 1280 and 19,316 px at 375. Paginate at 25 and add type and status filters (→XS-06). | Must-fix | Blocker | Open |
| TODAY-02 | Half-hour table at 375 | Only 2 of n columns are visible with no cue (→XS-04). | Must-fix | Blocker | Open |
| WE-01 | Energy balance table | 12 columns at 11 px, clipped at 375 ("Prima…") (→XS-04). Units only in the caption. Put the unit in the header row and use a sticky first column. | Must-fix | Blocker | Open |
| XS-06 | Long pages and unbounded lists | Paginate at 25 rows with a "Show all n" disclosure. Lead with a summary and problems first. Add a sticky in-page TOC at ≥1024 and a "Jump to" select at 375 (closes G-12). Default tables to collapsed. | Must-fix | Worth fixing | Open |
| XS-07 | Vocabulary | Use one status glossary: *Not published* (source does not publish), *Not updated* (stale), *—* (missing for this period), *Partial* (◐). Pipeline stage names follow COPY v3 ("Consented, not yet built"). Hide unknown fields rather than print "Unknown". | Must-fix | Worth fixing | Open |
| XS-08 | Time display | Use `formatLondon()` for every UI time, with no ISO or Z strings. Set `lang="en-GB"` on `<html>` and show a format hint next to native date inputs. UTC stays in API docs only. | Must-fix | Worth fixing | Open |
| XS-09 | Heading hierarchy | One h1 per page. The card title must not repeat the h1. Remove the current-page duplicate from the nav (REPORT P3). Use title format "{Page} \| Grid" consistently. | Must-fix | Worth fixing | Open |
| XS-10 | Wording (GB, developer-speak) | Slots for page titles: "{What} in Great Britain". Remove implementation terms (Tinybird, payload, envelope, warmed row, UUIDs) from UI copy. **Draft for Writing Bot.** | Must-fix | Worth fixing | Open |
| XS-11 | Charts without context | Every chart gets a title and unit in the subtitle, a y-axis in scaled units (£m, GW), a legend, an "as of" stamp, a 9→11 px tick floor and `gray-900` ticks (verify token: `gray-700` ticks would fail 1.4.3). | Must-fix | Worth fixing | Open |
| XS-13 | Link affordance | Rows that navigate get a hover `surface` tint, a chevron and an underline on focus. Other rows should not look like links. Visible focus ring on all (2.4.7 / 2.4.11). | Must-fix | Worth fixing | Open |
| XS-14 | Footer and meta text at 11–12 px | Raise to 13 px minimum. Meta goes in `gray-900` (5.74:1), never `gray-700` (3.23:1 fails). Footer link targets need ≥24×24 px (2.5.8). | Must-fix | Worth fixing | Open |
| API-01 | curl blocks | Clip on the right at all widths with no scroll cue. Use `overflow-x:auto`, a fade and a Copy button (→XS-04). | Must-fix | Worth fixing | Open |
| API-02 | Endpoint cards | Path repeated (h3 + "GET …"). Use a method badge plus the path once (→XS-09). | Must-fix | Worth fixing | Open |
| ASSET-02 | Metadata | Shown at KPI size. Use a definition list at body size, and keep KPI size for capacity only. | Must-fix | Worth fixing | Open |
| ASSET-03 | "MW: 6.1 MW" | Redundant label. Use "Capacity 6.1 MW". | Must-fix | Worth fixing | Open |
| ASSET-04 | Output empty | Plain text. Use CardEmpty with the reason (→XS-03). | Must-fix | Worth fixing | Open |
| ASSETS-02 | Filters | 4 stacked selects take about 300 px. Use one "Filters" sheet with a count chip. | Must-fix | Worth fixing | Open |
| ASSETS-03 | Capacity | Inconsistent decimals. Use 1 dp MW and right-aligned tabular numerals. | Must-fix | Worth fixing | Open |
| CAP-03 | Footnotes | 11 px (→XS-14). | Must-fix | Worth fixing | Open |
| CHG-02 | Grouping | Each project appears twice (construction and operational). Group by project, with from → to status chips. | Must-fix | Worth fixing | Open |
| CONS-02 | Cost y-axis | Raw "9,000,000" £ ticks. Use £m. The volume "MWh" label overlaps ticks at 375. | Must-fix | Worth fixing | Open |
| CONS-05 | Table rows | "Reducing largest loss 0 / 0 / 0%" and a negative −3,557 MWh have no explanation. Add a sign-convention note slot, and either hide zero rows or label them "None". At 375 the £ total is clipped (→XS-04). | Must-fix | Worth fixing | Open |
| DH-02 | Status pills | Tiny, and OK rows have no status. Every row gets a pill with icon and text (1.4.1). | Must-fix | Worth fixing | Open |
| DH-03 | Values | 28 px values for metadata. Use body size. | Must-fix | Worth fixing | Open |
| DH-05 | Copy | "warmed row", "envelope" (→XS-10). | Must-fix | Worth fixing | Open |
| DIR-02 | Search button | A ghost button at about 28 px for the primary action. Use the primary style and a ≥24 px target (2.5.8). | Must-fix | Worth fixing | Open |
| DIR-04 | Date input | Renders "10/23/2026". Set `lang` en-GB and add a hint (→XS-08). | Must-fix | Worth fixing | Open |
| GAS-03 | Timestamps | Three timestamp blocks. Use one `<Freshness>` per page. | Must-fix | Worth fixing | Open |
| GAS-06 | Forecast line (dark) | Low contrast. Use a dashed `chart-*` token with ≥3:1 against the dark surface (1.4.11). | Must-fix | Worth fixing | Open |
| GAS-07 | Chart legend | Actual vs forecast need a legend plus line style, not only colour (→XS-05). | Must-fix | Worth fixing | Open |
| GAS-08 | Storage inventory | Missing (REPORT P3). Show "Not yet available" with the reason (D8). | Must-fix | Worth fixing | Open |
| HOME-05 | Hero card heading | The h2 duplicates the h1 "What's powering Britain?". Make the card title "Generation mix" (slot) (→XS-09). | Must-fix | Worth fixing | Open |
| HOME-06 | Range tabs | Two tab sets drive overlapping views. Keep one page-level range control. | Must-fix | Worth fixing | Open |
| HOME-07 | Demand chart legend | "Exports" in green is listed but only a grey fill renders. Either draw exports with the `chart-*` token or remove it from the legend (→XS-05). | Must-fix | Worth fixing | Open |
| HOME-08 | Demand chart x-axis | End label is clipped "11:3(". Inset the last tick or right-align it. | Must-fix | Worth fixing | Open |
| HOME-10 | Page length | 7,194 px at 1280 and 10,140 px at 375. Add "Jump to" (→XS-06, G-12). | Must-fix | Worth fixing | Open |
| HOME-13 | Unit rendering | "159.8£/MWh": unit same size with no space (GB-11) (→XS-02). | Must-fix | Worth fixing | Open |
| HOME-14 | Title copy | "Britain" stands alone. Slot "{h1} in Great Britain" (→XS-10). | Must-fix | Worth fixing | Open |
| MAP-04 | Headings | Two h1s (→XS-09). | Must-fix | Worth fixing | Open |
| MAP-05 | Lines off canvas | Fit bounds to GB with padding. | Must-fix | Worth fixing | Open |
| MAP-06 | "— · 0.0" | Zero shown alongside "—". Use "—" plus the reason (→XS-03). | Must-fix | Worth fixing | Open |
| METH-01 | Sources table | 6–8 line cells of licence prose at 11 px, duplicating /data-sources. Keep one canonical list and link to it from the other page. | Must-fix | Worth fixing | Open |
| METH-02 | Table type | 11 px (→XS-14). | Must-fix | Worth fixing | Open |
| NI-04 | Tables | The full date repeats on every row. Put the date in the caption and show times only. | Must-fix | Worth fixing | Open |
| NI-06 | "1102MW" | Format as "1,102 MW" or GW (→XS-02). | Must-fix | Worth fixing | Open |
| NI-07 | "— gCO₂/kWh" | Hide the unit when the value is "—" and add the reason slot. | Must-fix | Worth fixing | Open |
| PGAS-01 | h1 and title | "UK gas price today", but SAP is GB. Slot "GB gas price today" (→XS-10). | Must-fix | Worth fixing | Open |
| PGAS-02 | KPI cards | Mixed freshness (daily 21 Oct, 20 Oct, monthly 1 Sep) at equal weight. Add a "Monthly" badge and the XS-03 stamp. | Must-fix | Worth fixing | Open |
| PIPE-02 | Technology table (PL-09 open) | 19 ungrouped rows mixing GW and MW, with no stage split or share. Group into ≤8 plus "Other", GW only, add a share column. | Must-fix | Worth fixing | Open |
| PIPE-03 | Median times (PL-08 partial) | Text only. Show a dot-and-IQR row per technology. | Must-fix | Worth fixing | Open |
| PIPE-06 | Project rows | Don't look like links (→XS-13). | Must-fix | Worth fixing | Open |
| PROJ-02 | List rows | Full of "Unknown · Unknown". Hide unknown fields (→XS-07). | Must-fix | Worth fixing | Open |
| PROJ-03 | Filters | Search only. Add stage, technology and nation filters (nation excludes NI, D2). | Must-fix | Worth fixing | Open |
| PROJ-05 | Row links | →XS-13. | Must-fix | Worth fixing | Open |
| PROJD-02 | Stage | "Proposed" doesn't match the COPY v3 stage names. | Must-fix | Worth fixing | Open |
| REC-02 | Card meta | Dense 11 px paragraphs mixing GMT and BST. Use a 13 px floor and London time (→XS-08, XS-14). | Must-fix | Worth fixing | Open |
| REC-03 | Coal vs wind chart | Grey and blue lines with no legend. 9 px ticks. Add direct labels (→XS-05/11). | Must-fix | Worth fixing | Open |
| SRC-03 | Copy | "Tinybird", "warmed FUELINST envelope" (→XS-10). | Must-fix | Worth fixing | Open |
| STOR-02 | KPI | "7846.3 MW" → "7.8 GW" (→XS-02). | Must-fix | Worth fixing | Open |
| STOR-05 | Row links | Only the 4 pumped-storage rows link (→XS-13). | Must-fix | Worth fixing | Open |
| STOR-06 | "Not available" cells | Mixed with numbers. Use "—" plus the glossary (→XS-07). | Must-fix | Worth fixing | Open |
| TODAY-01 | "Latest half-hour 38.4 GW" | The label must name the metric: slot "{metric}, latest half-hour". | Must-fix | Worth fixing | Open |
| TODAY-04 | Explainer copy | "cached week payload, not a separate Tinybird query". Remove (→XS-10). | Must-fix | Worth fixing | Open |
| TODAY-05 | h1 | "Britain's…" (→XS-10). | Must-fix | Worth fixing | Open |
| TODAY-06 | Chart ticks | Verify the tick colour token is not `gray-700` (fails 3.23:1) (→XS-11). | Must-fix | Worth fixing | Open |
| TOOLS-01 | Service lists | 9,145 px. Each item is 6 lines with a raw mono URL. Use a compact row (name, one-line description, domain only) and task anchors (→XS-06). | Must-fix | Worth fixing | Open |
| TOOLS-03 | External links | Add an ↗ icon and `aria-label` "opens external site". "Runs on Grid" chip ✓. | Must-fix | Worth fixing | Open |
| WE-02 | Scope label | "UK, annual statistic". The source (DUKES) is UK-wide, so do **not** relabel it GB. Slot: "{Source} covers the whole UK including Northern Ireland; not comparable with GB pages". **Draft for Writing Bot.** | Must-fix | Worth fixing | Open |
| WE-06 | h1 | "Britain" wording (→XS-10). | Must-fix | Worth fixing | Open |
| XS-12 | Text-only breakdowns | Breakdown lists get an inline bar (`chart-*` token per tech) and a share column (D1 share of generation). | Nice-to-have | Minor | Open |
| XS-15 | Breadcrumb and JSON-LD consistency | Data-sources, privacy and terms lack the breadcrumb. JSON-LD is missing on most pages (REPORT P3). | Nice-to-have | Minor | Open |
| API-03 | Page nav | 13 endpoints with no index. Add a sticky endpoint list (→XS-06). | Nice-to-have | Minor | Open |
| API-04 | Conventions | "Convert to UK time yourself". Slot "London time" (→XS-10). | Nice-to-have | Minor | Open |
| ASSET-05 | "Not available" | →XS-07 glossary. | Nice-to-have | Minor | Open |
| ASSETS-04 | Empty result | No zero-results state. Add a slot plus "Clear filters". | Nice-to-have | Minor | Open |
| CAP-01 | Caps table | Fine. Use tabular numerals and right-aligned £. Move the 4 footnote paragraphs into the table as ¹ markers. | Nice-to-have | Minor | Open |
| CAP-02 | SAP window card | Text only. Add a sparkline of SAP over the window. | Nice-to-have | Minor | Open |
| CHG-03 | List | No date grouping or filter. Group by observed date and add a type filter. | Nice-to-have | Minor | Open |
| CHG-04 | Count line | "10 comparisons" at 12 px. Move to the card header (→XS-14). | Nice-to-have | Minor | Open |
| CONS-03 | Daily series over 7 months | Spiky and unreadable. Offer weekly aggregation by default with a daily toggle. | Nice-to-have | Minor | Open |
| DH-06 | Gas series | "Not yet available" (REPORT P2). Keep it, with the reason slot (D8). | Nice-to-have | Minor | Open |
| DIR-03 | Inputs | Span about 1,100 px. Cap at 480 px with a placeholder and example slot. | Nice-to-have | Minor | Open |
| DIR-05 | Intro copy | /directory describes MPID codes (it belongs on identifiers). **Draft for Writing Bot.** | Nice-to-have | Minor | Open |
| DIR-06 | Initial state | No examples or empty state. Add 2–3 example chips. | Nice-to-have | Minor | Open |
| GAS-05 | Comparison table | Only 1 row. Render it as an inline sentence or stat instead of a table. | Nice-to-have | Minor | Open |
| GAS-09 | Gas bases (D5) | Keep. Align the units label with the KPI unit size (→XS-02). | Nice-to-have | Minor | Open |
| GAS-10 | Mobile KPIs | 4 stacked cards push the chart below the fold. Use a 2×2 grid at 375. | Nice-to-have | Minor | Open |
| HOME-09 | Battery row note | Wraps to 4 lines at 375. Move it to an ⓘ tooltip or a footnote. | Nice-to-have | Minor | Open |
| HOME-11 | Static map card (D9) | Keep it, and add a caption slot and an "Open map" affordance. | Nice-to-have | Minor | Open |
| HOME-12 | "?" info buttons | Repeated ⓘ on every card. Keep one per card header, label `aria-label="About {card}"`. | Nice-to-have | Minor | Open |
| LEGAL-01 | Breadcrumb | Missing (→XS-15). | Nice-to-have | Minor | Open |
| LEGAL-02 | "UK GDPR" / jurisdiction | Correct legal terms, exempt from the GB rule. No change. | Nice-to-have | Minor | Open |
| MAP-07 | "8,192 MW" | Use GW (→XS-02). | Nice-to-have | Minor | Open |
| MAP-08 | Credits | Stacked attributions. Use a single collapsible "©" control. | Nice-to-have | Minor | Open |
| NI-05 | Charts | None. Add a small half-hour line per metric, matching GB cards. | Nice-to-have | Minor | Open |
| NI-08 | Card grid | Uneven card heights. Align with `items-stretch` and a fixed table height. | Nice-to-have | Minor | Open |
| NI-09 | Mono table body | Mono for numerics only. Labels use Geist Sans. | Nice-to-have | Minor | Open |
| PGAS-03 | KPI cards | No trend. Add a 30-day sparkline and change vs prior. | Nice-to-have | Minor | Open |
| PGAS-04 | Units | "$/MMBTU" here vs "$/MMBtu" elsewhere. Pick one. | Nice-to-have | Minor | Open |
| PGAS-05 | Prose sections | Two unboxed prose blocks between cards and FAQ. Move under the KPIs as a 2-column explainer. | Nice-to-have | Minor | Open |
| PIPE-04 | Storage (PL-20 partial) | Text lines. Add the stage bar matching the main bar. | Nice-to-have | Minor | Open |
| PIPE-05 | Nation card | Mostly empty at 1280. Span 1 column, or merge with the stage card. | Nice-to-have | Minor | Open |
| PROJ-04 | By-technology list | Text only. Add an inline bar and share (→XS-12). | Nice-to-have | Minor | Open |
| PROJD-03 | Fields | Hide empty fields and group them as "Planning" and "Connection". | Nice-to-have | Minor | Open |
| REC-01 | Record cards | The 5th card is an orphan at half width. Use a 3+2 grid or a full-width final card. | Nice-to-have | Minor | Open |
| REC-04 | Milestones table | Good. Add a step-line sparkline beside it. | Nice-to-have | Minor | Open |
| REC-05 | FAQ copy | "Britain" (→XS-10). | Nice-to-have | Minor | Open |
| SRC-01 | Breadcrumb | Missing (→XS-15). | Nice-to-have | Minor | Open |
| SRC-02 | Source sections | 16 prose sections. Use a card per source with labelled Licence, Attribution and Refresh fields. | Nice-to-have | Minor | Open |
| STOR-03 | Coverage | "2900.0 of 2900.0 MW" reads oddly. Slot "{n}% of capacity reporting". | Nice-to-have | Minor | Open |
| STOR-04 | Split bars | Two grey bars. Use `chart-*` per technology, with labels. | Nice-to-have | Minor | Open |
| TODAY-03 | Imports list | Text only with a wide label–value gap. Use an inline bar with value next to the label and a direction arrow (→XS-12). | Nice-to-have | Minor | Open |
| TODAY-07 | Card spacing | Cards use mixed internal padding. Standardise on `CARD_PAD`. | Nice-to-have | Minor | Open |
| TOOLS-02 | "Verified 20 Oct 2026" | Repeated on every item. Show once per section. | Nice-to-have | Minor | Open |
| WE-03 | Flows widget | Three numbers with no visual. A simple 3-stage flow (primary → transformation → final) using `chart-*`. | Nice-to-have | Minor | Open |
| WE-04 | Sub-rows | "Included in Transformation." italic note repeats 7 times. Use one footnote marker. | Nice-to-have | Minor | Open |
| WE-05 | Final consumption tabs | Plain table. Add inline bars and share (→XS-12). | Nice-to-have | Minor | Open |
