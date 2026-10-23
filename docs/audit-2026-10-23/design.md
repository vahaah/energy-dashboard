# Grid (grid.vahaah.com): site-wide design critique

Reviewer: Grok Bot, Tue 20 Oct 2026 (screenshots captured 23 Oct 2026, 13:00 BST, Europe/London)
Scope: 26 pages × 4 widths × 2 themes in `/workspace/grid-audit/`. Baseline: REPORT.md, the fix lists in `/workspace/grid-review/fix-lists/` (grid-home, grid-oct2, grid-balance, grid-map-card, grid-map-page, grid-generation-desk, grid-pipeline-page) and the plan/UX.md decisions D1–D9.
Rules applied: clean Vercel/Geist; existing tokens only (`gray-700/900`, `blue-700`, `amber-700`, `red-700`, `green-700`, `chart-*`, `surface-card`, `CARD_PAD` 1.5rem), and any new value is labelled **proposed**; copy is given as slots or marked **draft for Writing Bot**; GB, never UK; NI is kept separate (D2).

**Priority legend.** Must-fix covers *Blocker* (wrong or misleading data, unusable, or fails WCAG 2.2 AA) and *Worth fixing* (noticeably hurts comprehension or polish). Nice-to-have is *Minor*.

**Contrast references** (computed from tokens.json on `surface-card`): `gray-900` is 5.74:1 light and 7.66:1 dark, which passes. `gray-700` is 3.23:1 light, which **fails 1.4.3 for text** but passes 1.4.11 (non-text 3:1). `blue-700` is 4.55:1 light, a narrow pass, and 6.25:1 dark. Where small meta text, axis ticks or captions render in `gray-700`, they fail. I did not pixel-sample every page, so each such case is flagged "verify token".

---

## 1. Summary

**Widget count.** result.json (1280-light) finds **208 widgets** against REPORT.md's 201. /map registers 0 widgets, so I assessed it from screenshots as a set of page-level widgets. The figures below use 208.

**Fixes raised: 132 page-level + 15 cross-site (XS)**, for 147 in total. Of these, 33 are Blockers, 66 are Worth fixing and 48 are Minor, giving **99 must-fix** and 48 nice-to-have. See §6 for counts by page.

### Top 10 site-wide fixes (rank order)
1. **XS-01 Headline numbers disagree across pages.** Home infrastructure shows 283.9 GW / 10,126, but /pipeline ships 267.4 GW / 7,668. The home KPI strip (159.8 £/MWh, 107 g, 30.4 GW) contradicts the home hero (200.56, 86 g, 38.4 GW). Use one source per figure, with an "as of" stamp. *Blocker.*
2. **XS-02 Number formatting.** Use thousands separators everywhere, put the unit at a smaller size with a thin space, and switch to GW at or above 1,000 MW. Seen in 57440.4 MW, 689908.6 MW, 7846.3 MW, 1102MW, "8,192 MW" and "159.8£/MWh" (GB-11 still open). *Blocker* (misreadable).
3. **XS-03 Stale and unavailable states.** Apply the UX.md patterns everywhere: amber `border-l-2` + "Not updated" + "as of" for stale, "—" never 0, ◐ for partial. Affected: NI (stale since 10:15), home settlement period, constraints (11 Oct with no lag note), gas mixed-freshness cards, and /changes raw UTC. *Blocker.*
4. **XS-04 Mobile truncation and clipped tables.** Fuel labels show as "G…/W…" on home at 375. The assets, whole-energy, today and storage tables clip with no scroll cue, and curl blocks clip on /api. Fix with a shared `<TableScroll>` (edge fade plus "Scroll →" hint, **proposed**) or a card-list fallback at 375. *Blocker.*
5. **XS-05 Colour-only encoding.** Pipeline stage bar (PL-10), map flows (all one orange, no direction), constraints charts (3 series, no legend) and records coal/wind. Add direct labels or a legend, plus pattern or position. Fails 1.4.1. *Blocker.*
6. **XS-06 Unbounded lists.** Data-health is 18,822 px, storage 9,868 px, tools 9,145 px and the gas table about 100 rows expanded by default. Paginate or collapse, lead with a summary, and add in-page nav (G-12 still open). *Worth fixing* (Blocker on gas and data-health).
7. **XS-07 Vocabulary drift.** Not available / Not published / Unknown, Proposed vs "Consented, not yet built", Partial badges and "—" are used inconsistently. Use one glossary, and replace "Unknown, Unknown, Unknown" headings with a fallback name slot. *Blocker on PROJD.*
8. **XS-08 Times.** Raw ISO UTC strings appear (/changes "2026-10-13T13:58:33.756Z"). GMT and BST are mixed in records meta, and native date inputs show "10/23/2026". Format as `Fri 23 Oct 2026, 13:30` in Europe/London everywhere in UI. *Worth fixing.*
9. **XS-09 Duplicate and competing hierarchy.** Home h1 and card h2 are identical, there are two range-tab sets, /map has two h1s, API endpoint paths appear twice, and nav repeats the current page. Use one h1 per page and section h2s only. *Worth fixing.*
10. **XS-10 "Britain/UK" wording and developer-speak.** "Britain", "UK gas price today" (the price is GB SAP), "Convert to UK time", "cached week payload", "warmed row", "envelope", "Tinybird". Slots below; **draft for Writing Bot**. *Worth fixing.*

### Worst pages (by blockers, then must-fix density)
1. **/** (home): 4 blockers. Contradictory KPIs, truncated mobile fuel labels, pipeline mismatch, stale settlement period.
2. **/ni**: 3 blockers. Stale with no stale pattern, all-"—" future rows, tables contradict headlines.
3. **/gas**: 3 blockers. Table expanded above the chart with a "Show table" mismatch, four Partial badges, raw codes.
4. **/data-health**: 2 blockers. 18,822 px of 4-line blocks with problems buried, and a UUID exposed.
5. **/map**: 3 blockers. Light theme ignored at 1280, colour-only flows with no direction, inspector references a list that isn't there.
6. **/directory** and **/directory/identifiers**: HTTP 400 on load (REPORT P1), so the forms are unusable.

**Most illustrative screenshot:** `/workspace/grid-audit/home/375-light.png`. In one frame it shows truncated fuel labels, the 4-line battery note, a clipped axis label ("11:3(") and the KPI strip that contradicts the hero.

---

## 2. Cross-site fixes (fix once, closes the page items that reference them)

| ID | Pattern | Fix | Pages | Priority | Severity |
|---|---|---|---|---|---|
| XS-01 | Figures disagree between pages | Use a single selector per metric (generation mix, price, intensity, pipeline totals) and print one "as of" stamp per card. Home infrastructure should read the /pipeline aggregate (267.4 GW / 7,668). | home, today, pipeline | Must-fix | Blocker |
| XS-02 | Number and unit format | Add a shared `formatEnergy()` that applies separators, switches MW to GW at ≥1,000 MW (1 dp) and renders the unit in a `<span>` at 0.6em `gray-900` with a thin space. Applies to KPI, table and tooltip. | home, projects, storage, NI, map, balance | Must-fix | Blocker |
| XS-03 | Stale, unavailable and partial states | Use one `<Freshness>` component: amber-700 `border-l-2`, the "Not updated" slot and an "as of {London time}" slot. "—" with an `aria-label` slot for the reason, never 0. ◐ Partial shows a tooltip with the reason. Show it once per card, not three timestamp blocks. | NI, home, constraints, gas, prices/gas, data-health | Must-fix | Blocker |
| XS-04 | Mobile tables and labels | Use `<TableScroll>` with a right-edge fade (gradient from `surface-card`, **proposed**), a sticky first column and a caption "Swipe for more columns" (slot). Below 480 px, switch row-heavy tables to stacked key/value cards. Bar labels go above the bar, never truncated. | home, today, assets, whole-energy, storage, constraints, api | Must-fix | Blocker |
| XS-05 | Colour-only encoding (1.4.1) | Use direct labels at line ends or bar segments, plus a legend with swatch and text. Map flows get chevrons and width by MW. Stage bars get inline labels with % and a text table alternative. | pipeline, map, constraints, records, home demand | Must-fix | Blocker |
| XS-06 | Long pages and unbounded lists | Paginate at 25 rows with a "Show all n" disclosure. Lead with a summary and problems first. Add a sticky in-page TOC at ≥1024 and a "Jump to" select at 375 (closes G-12). Default tables to collapsed. | data-health, storage, tools, gas, home, api, methodology | Must-fix | Worth fixing |
| XS-07 | Vocabulary | Use one status glossary: *Not published* (source does not publish), *Not updated* (stale), *—* (missing for this period), *Partial* (◐). Pipeline stage names follow COPY v3 ("Consented, not yet built"). Hide unknown fields rather than print "Unknown". | assets, asset detail, projects, project detail, storage, changes | Must-fix | Worth fixing |
| XS-08 | Time display | Use `formatLondon()` for every UI time, with no ISO or Z strings. Set `lang="en-GB"` on `<html>` and show a format hint next to native date inputs. UTC stays in API docs only. | changes, records, directory, identifiers, NI | Must-fix | Worth fixing |
| XS-09 | Heading hierarchy | One h1 per page. The card title must not repeat the h1. Remove the current-page duplicate from the nav (REPORT P3). Use title format "{Page} \| Grid" consistently. | home, map, api, all | Must-fix | Worth fixing |
| XS-10 | Wording (GB, developer-speak) | Slots for page titles: "{What} in Great Britain". Remove implementation terms (Tinybird, payload, envelope, warmed row, UUIDs) from UI copy. **Draft for Writing Bot.** | home, today, gas, prices/gas, data-health, data-sources, api | Must-fix | Worth fixing |
| XS-11 | Charts without context | Every chart gets a title and unit in the subtitle, a y-axis in scaled units (£m, GW), a legend, an "as of" stamp, a 9→11 px tick floor and `gray-900` ticks (verify token: `gray-700` ticks would fail 1.4.3). | constraints, records, home, gas, today | Must-fix | Worth fixing |
| XS-12 | Text-only breakdowns | Breakdown lists get an inline bar (`chart-*` token per tech) and a share column (D1 share of generation). | today imports, projects by-tech, storage, whole-energy consumption, pipeline | Nice-to-have | Minor |
| XS-13 | Link affordance | Rows that navigate get a hover `surface` tint, a chevron and an underline on focus. Other rows should not look like links. Visible focus ring on all (2.4.7 / 2.4.11). | pipeline, storage, changes, projects | Must-fix | Worth fixing |
| XS-14 | Footer and meta text at 11–12 px | Raise to 13 px minimum. Meta goes in `gray-900` (5.74:1), never `gray-700` (3.23:1 fails). Footer link targets need ≥24×24 px (2.5.8). | all | Must-fix | Worth fixing |
| XS-15 | Breadcrumb and JSON-LD consistency | Data-sources, privacy and terms lack the breadcrumb. JSON-LD is missing on most pages (REPORT P3). | data-sources, privacy, terms | Nice-to-have | Minor |

---

## 3. Per-page findings (ranked within each page)

### HOME `/` (13 widgets)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| HOME-01 | KPI strip (bottom) | Use the same values and stamp as the hero (→XS-01), or delete the strip. It currently shows 159.8 vs 200.56 £/MWh, 107 vs 86 g and 30.4 vs 38.4 GW. | data/hierarchy | Must-fix | Blocker |
| HOME-02 | Generation bars at 375 | Labels show as "G…", "W…" and "Nuclea..". Put labels above bars at full width and the value right-aligned (→XS-04). | mobile | Must-fix | Blocker |
| HOME-03 | Infrastructure card | Shows 283.9 GW / 10,126 against /pipeline's 267.4 GW / 7,668. Read the pipeline aggregate. "2,701" has no unit or label: add a label slot. | data | Must-fix | Blocker |
| HOME-04 | Settlement-period badge | Shows 11:00–11:30 at 13:00 with no stale pattern. Apply XS-03. | state | Must-fix | Blocker |
| HOME-05 | Hero card heading | The h2 duplicates the h1 "What's powering Britain?". Make the card title "Generation mix" (slot) (→XS-09). | hierarchy | Must-fix | Worth fixing |
| HOME-06 | Range tabs | Two tab sets drive overlapping views. Keep one page-level range control. | hierarchy | Must-fix | Worth fixing |
| HOME-07 | Demand chart legend | "Exports" in green is listed but only a grey fill renders. Either draw exports with the `chart-*` token or remove it from the legend (→XS-05). | chart | Must-fix | Worth fixing |
| HOME-08 | Demand chart x-axis | End label is clipped "11:3(". Inset the last tick or right-align it. | chart | Must-fix | Worth fixing |
| HOME-09 | Battery row note | Wraps to 4 lines at 375. Move it to an ⓘ tooltip or a footnote. | mobile/spacing | Nice-to-have | Minor |
| HOME-10 | Page length | 7,194 px at 1280 and 10,140 px at 375. Add "Jump to" (→XS-06, G-12). | spacing | Must-fix | Worth fixing |
| HOME-11 | Static map card (D9) | Keep it, and add a caption slot and an "Open map" affordance. | hierarchy | Nice-to-have | Minor |
| HOME-12 | "?" info buttons | Repeated ⓘ on every card. Keep one per card header, label `aria-label="About {card}"`. | a11y | Nice-to-have | Minor |
| HOME-13 | Unit rendering | "159.8£/MWh": unit same size with no space (GB-11) (→XS-02). | type | Must-fix | Worth fixing |
| HOME-14 | Title copy | "Britain" stands alone. Slot "{h1} in Great Britain" (→XS-10). | copy | Must-fix | Worth fixing |

### TODAY `/today` (7)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| TODAY-01 | "Latest half-hour 38.4 GW" | The label must name the metric: slot "{metric}, latest half-hour". | hierarchy/copy | Must-fix | Worth fixing |
| TODAY-02 | Half-hour table at 375 | Only 2 of n columns are visible with no cue (→XS-04). | mobile | Must-fix | Blocker |
| TODAY-03 | Imports list | Text only with a wide label–value gap. Use an inline bar with value next to the label and a direction arrow (→XS-12). | chart/spacing | Nice-to-have | Minor |
| TODAY-04 | Explainer copy | "cached week payload, not a separate Tinybird query". Remove (→XS-10). | copy | Must-fix | Worth fixing |
| TODAY-05 | h1 | "Britain's…" (→XS-10). | copy | Must-fix | Worth fixing |
| TODAY-06 | Chart ticks | Verify the tick colour token is not `gray-700` (fails 3.23:1) (→XS-11). | a11y | Must-fix | Worth fixing |
| TODAY-07 | Card spacing | Cards use mixed internal padding. Standardise on `CARD_PAD`. | spacing | Nice-to-have | Minor |

### GAS `/gas` (11)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| GAS-01 | Data table | Expanded by default (about 100 sparse rows) above the chart while the button reads "Show table". Collapse by default, put it below the chart, and fix the button state and `aria-expanded`. | hierarchy/a11y | Must-fix | Blocker |
| GAS-02 | KPI cards | All four show "Partial". Give the reason per card in a tooltip. If all are partial, use one page-level ◐ note (→XS-03). | state | Must-fix | Blocker |
| GAS-03 | Timestamps | Three timestamp blocks. Use one `<Freshness>` per page. | hierarchy | Must-fix | Worth fixing |
| GAS-04 | Codes | Raw PUBOB codes are shown. Use human labels, with the code in a tooltip or table only. | copy | Must-fix | Blocker |
| GAS-05 | Comparison table | Only 1 row. Render it as an inline sentence or stat instead of a table. | empty state | Nice-to-have | Minor |
| GAS-06 | Forecast line (dark) | Low contrast. Use a dashed `chart-*` token with ≥3:1 against the dark surface (1.4.11). | dark/chart | Must-fix | Worth fixing |
| GAS-07 | Chart legend | Actual vs forecast need a legend plus line style, not only colour (→XS-05). | chart | Must-fix | Worth fixing |
| GAS-08 | Storage inventory | Missing (REPORT P3). Show "Not yet available" with the reason (D8). | empty | Must-fix | Worth fixing |
| GAS-09 | Gas bases (D5) | Keep. Align the units label with the KPI unit size (→XS-02). | type | Nice-to-have | Minor |
| GAS-10 | Mobile KPIs | 4 stacked cards push the chart below the fold. Use a 2×2 grid at 375. | mobile | Nice-to-have | Minor |

### NORTHERN IRELAND `/ni` (22, D2)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| NI-01 | Stale banner | Data stale since 10:15. The banner is not the UX.md stale pattern. Apply XS-03 to every card, not only the banner. | state | Must-fix | Blocker |
| NI-02 | Future rows | 22:00–23:45 are all "—". Hide future periods or group them as "Not yet published" (slot). | empty | Must-fix | Blocker |
| NI-03 | Tables vs headlines | 8-row mono tables contradict the headline figures. Use one source (→XS-01). | data | Must-fix | Blocker |
| NI-04 | Tables | The full date repeats on every row. Put the date in the caption and show times only. | spacing/type | Must-fix | Worth fixing |
| NI-05 | Charts | None. Add a small half-hour line per metric, matching GB cards. | chart | Nice-to-have | Minor |
| NI-06 | "1102MW" | Format as "1,102 MW" or GW (→XS-02). | type | Must-fix | Worth fixing |
| NI-07 | "— gCO₂/kWh" | Hide the unit when the value is "—" and add the reason slot. | empty | Must-fix | Worth fixing |
| NI-08 | Card grid | Uneven card heights. Align with `items-stretch` and a fixed table height. | spacing | Nice-to-have | Minor |
| NI-09 | Mono table body | Mono for numerics only. Labels use Geist Sans. | type | Nice-to-have | Minor |

### PIPELINE `/pipeline` (18), re-check of grid-pipeline-page
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| PIPE-01 | Stage bar (PL-10 open) | Colour-only blue/green/amber. Add inline segment labels and a legend (→XS-05). | a11y | Must-fix | Blocker |
| PIPE-02 | Technology table (PL-09 open) | 19 ungrouped rows mixing GW and MW, with no stage split or share. Group into ≤8 plus "Other", GW only, add a share column. | hierarchy/type | Must-fix | Worth fixing |
| PIPE-03 | Median times (PL-08 partial) | Text only. Show a dot-and-IQR row per technology. | chart | Must-fix | Worth fixing |
| PIPE-04 | Storage (PL-20 partial) | Text lines. Add the stage bar matching the main bar. | chart | Nice-to-have | Minor |
| PIPE-05 | Nation card | Mostly empty at 1280. Span 1 column, or merge with the stage card. | spacing | Nice-to-have | Minor |
| PIPE-06 | Project rows | Don't look like links (→XS-13). | a11y | Must-fix | Worth fixing |
| PIPE-07 | Mismatch with home | →XS-01 / HOME-03. | data | Must-fix | Blocker |

### MAP `/map` (0 detected, assessed as page-level widgets)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| MAP-01 | Theme | Light mode renders dark at 1280 (light is correct at 375). Respect the theme for tiles and chrome (D4 Protomaps light flavour). | dark mode | Must-fix | Blocker |
| MAP-02 | Inspector | "Select a flow from the list." but there is no list. Add the flow list, or change the empty-state slot. | empty state | Must-fix | Blocker |
| MAP-03 | Flows | All one orange with no direction. Add chevrons, width by MW, and a direction label in the inspector (→XS-05). MP-06 is still open. | chart/a11y | Must-fix | Blocker |
| MAP-04 | Headings | Two h1s (→XS-09). | a11y | Must-fix | Worth fixing |
| MAP-05 | Lines off canvas | Fit bounds to GB with padding. | chart | Must-fix | Worth fixing |
| MAP-06 | "— · 0.0" | Zero shown alongside "—". Use "—" plus the reason (→XS-03). | empty | Must-fix | Worth fixing |
| MAP-07 | "8,192 MW" | Use GW (→XS-02). | type | Nice-to-have | Minor |
| MAP-08 | Credits | Stacked attributions. Use a single collapsible "©" control. | spacing | Nice-to-have | Minor |

### ASSETS `/assets` (1)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| ASSETS-01 | Table at 375 | "Statu…", "Opera…" clipped with no scroll cue (→XS-04). | mobile | Must-fix | Blocker |
| ASSETS-02 | Filters | 4 stacked selects take about 300 px. Use one "Filters" sheet with a count chip. | mobile | Must-fix | Worth fixing |
| ASSETS-03 | Capacity | Inconsistent decimals. Use 1 dp MW and right-aligned tabular numerals. | type | Must-fix | Worth fixing |
| ASSETS-04 | Empty result | No zero-results state. Add a slot plus "Clear filters". | empty | Nice-to-have | Minor |

### ASSET DETAIL `/assets/[id]` (10)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| ASSET-01 | Location minimap | A blank box with one dot. Use Protomaps tiles at zoom 9 with a scale, or remove it. | chart | Must-fix | Blocker |
| ASSET-02 | Metadata | Shown at KPI size. Use a definition list at body size, and keep KPI size for capacity only. | hierarchy | Must-fix | Worth fixing |
| ASSET-03 | "MW: 6.1 MW" | Redundant label. Use "Capacity 6.1 MW". | copy/type | Must-fix | Worth fixing |
| ASSET-04 | Output empty | Plain text. Use CardEmpty with the reason (→XS-03). | empty | Must-fix | Worth fixing |
| ASSET-05 | "Not available" | →XS-07 glossary. | copy | Nice-to-have | Minor |

### PROJECTS `/projects` (5)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| PROJ-01 | KPI cards | "57440.4 MW" and "689908.6 MW" have no separators and should be in GW (→XS-02). | type | Must-fix | Blocker |
| PROJ-02 | List rows | Full of "Unknown · Unknown". Hide unknown fields (→XS-07). | copy/empty | Must-fix | Worth fixing |
| PROJ-03 | Filters | Search only. Add stage, technology and nation filters (nation excludes NI, D2). | hierarchy | Must-fix | Worth fixing |
| PROJ-04 | By-technology list | Text only. Add an inline bar and share (→XS-12). | chart | Nice-to-have | Minor |
| PROJ-05 | Row links | →XS-13. | a11y | Must-fix | Worth fixing |

### PROJECT DETAIL `/projects/[id]` (5)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| PROJD-01 | h1 | "Unknown, Unknown, Unknown". Fallback slot "{technology} project, {ref}" (→XS-07). | copy | Must-fix | Blocker |
| PROJD-02 | Stage | "Proposed" doesn't match the COPY v3 stage names. | copy | Must-fix | Worth fixing |
| PROJD-03 | Fields | Hide empty fields and group them as "Planning" and "Connection". | hierarchy | Nice-to-have | Minor |

### DATA HEALTH `/data-health` (11)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| DH-01 | Series list | 18,822 px of about 150 four-line blocks. Use a status-first table: summary counts (OK / Stale / Missing) at top, problems first, OK collapsed (→XS-06). | hierarchy | Must-fix | Blocker |
| DH-02 | Status pills | Tiny, and OK rows have no status. Every row gets a pill with icon and text (1.4.1). | a11y | Must-fix | Worth fixing |
| DH-03 | Values | 28 px values for metadata. Use body size. | type | Must-fix | Worth fixing |
| DH-04 | Source ID | Exposes a UUID. Remove it from the UI. | copy | Must-fix | Blocker |
| DH-05 | Copy | "warmed row", "envelope" (→XS-10). | copy | Must-fix | Worth fixing |
| DH-06 | Gas series | "Not yet available" (REPORT P2). Keep it, with the reason slot (D8). | empty | Nice-to-have | Minor |

### CONSTRAINTS `/system/constraints` (3)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| CONS-01 | Cost and volume charts | Three series (grey, amber, blue) with no legend (→XS-05). | a11y/chart | Must-fix | Blocker |
| CONS-02 | Cost y-axis | Raw "9,000,000" £ ticks. Use £m. The volume "MWh" label overlaps ticks at 375. | chart/type | Must-fix | Worth fixing |
| CONS-03 | Daily series over 7 months | Spiky and unreadable. Offer weekly aggregation by default with a daily toggle. | chart | Nice-to-have | Minor |
| CONS-04 | Settlement-date table | 2026-10-11 is 12 days old with no lag note, and the date is in ISO. Use XS-03 plus a "Published with a lag of n days" slot, with the date as "Sun 11 Oct 2026". | state | Must-fix | Blocker |
| CONS-05 | Table rows | "Reducing largest loss 0 / 0 / 0%" and a negative −3,557 MWh have no explanation. Add a sign-convention note slot, and either hide zero rows or label them "None". At 375 the £ total is clipped (→XS-04). | empty/mobile | Must-fix | Worth fixing |

### STORAGE `/system/storage` (7)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| STOR-01 | Inventory table | Hundreds of rows, 9,868 px at 1280 and 19,316 px at 375. Paginate at 25 and add type and status filters (→XS-06). | hierarchy | Must-fix | Blocker |
| STOR-02 | KPI | "7846.3 MW" → "7.8 GW" (→XS-02). | type | Must-fix | Worth fixing |
| STOR-03 | Coverage | "2900.0 of 2900.0 MW" reads oddly. Slot "{n}% of capacity reporting". | copy | Nice-to-have | Minor |
| STOR-04 | Split bars | Two grey bars. Use `chart-*` per technology, with labels. | chart/colour | Nice-to-have | Minor |
| STOR-05 | Row links | Only the 4 pumped-storage rows link (→XS-13). | a11y | Must-fix | Worth fixing |
| STOR-06 | "Not available" cells | Mixed with numbers. Use "—" plus the glossary (→XS-07). | empty | Must-fix | Worth fixing |

### WHOLE ENERGY `/system/whole-energy` (6)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| WE-01 | Energy balance table | 12 columns at 11 px, clipped at 375 ("Prima…") (→XS-04). Units only in the caption. Put the unit in the header row and use a sticky first column. | mobile/type | Must-fix | Blocker |
| WE-02 | Scope label | "UK, annual statistic". The source (DUKES) is UK-wide, so do **not** relabel it GB. Slot: "{Source} covers the whole UK including Northern Ireland; not comparable with GB pages". **Draft for Writing Bot.** | copy | Must-fix | Worth fixing |
| WE-03 | Flows widget | Three numbers with no visual. A simple 3-stage flow (primary → transformation → final) using `chart-*`. | chart | Nice-to-have | Minor |
| WE-04 | Sub-rows | "Included in Transformation." italic note repeats 7 times. Use one footnote marker. | spacing | Nice-to-have | Minor |
| WE-05 | Final consumption tabs | Plain table. Add inline bars and share (→XS-12). | chart | Nice-to-have | Minor |
| WE-06 | h1 | "Britain" wording (→XS-10). | copy | Must-fix | Worth fixing |

### RECORDS `/records` (8)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| REC-01 | Record cards | The 5th card is an orphan at half width. Use a 3+2 grid or a full-width final card. | spacing | Nice-to-have | Minor |
| REC-02 | Card meta | Dense 11 px paragraphs mixing GMT and BST. Use a 13 px floor and London time (→XS-08, XS-14). | type | Must-fix | Worth fixing |
| REC-03 | Coal vs wind chart | Grey and blue lines with no legend. 9 px ticks. Add direct labels (→XS-05/11). | chart | Must-fix | Worth fixing |
| REC-04 | Milestones table | Good. Add a step-line sparkline beside it. | chart | Nice-to-have | Minor |
| REC-05 | FAQ copy | "Britain" (→XS-10). | copy | Nice-to-have | Minor |

### PRICES / GAS `/prices/gas` (7)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| PGAS-01 | h1 and title | "UK gas price today", but SAP is GB. Slot "GB gas price today" (→XS-10). | copy | Must-fix | Worth fixing |
| PGAS-02 | KPI cards | Mixed freshness (daily 21 Oct, 20 Oct, monthly 1 Sep) at equal weight. Add a "Monthly" badge and the XS-03 stamp. | state | Must-fix | Worth fixing |
| PGAS-03 | KPI cards | No trend. Add a 30-day sparkline and change vs prior. | chart | Nice-to-have | Minor |
| PGAS-04 | Units | "$/MMBTU" here vs "$/MMBtu" elsewhere. Pick one. | type | Nice-to-have | Minor |
| PGAS-05 | Prose sections | Two unboxed prose blocks between cards and FAQ. Move under the KPIs as a 2-column explainer. | spacing | Nice-to-have | Minor |

### PRICE CAP `/explained/price-cap` (6)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| CAP-01 | Caps table | Fine. Use tabular numerals and right-aligned £. Move the 4 footnote paragraphs into the table as ¹ markers. | type/spacing | Nice-to-have | Minor |
| CAP-02 | SAP window card | Text only. Add a sparkline of SAP over the window. | chart | Nice-to-have | Minor |
| CAP-03 | Footnotes | 11 px (→XS-14). | a11y | Must-fix | Worth fixing |

### CHANGES `/changes` (11)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| CHG-01 | Change items | Raw "2026-10-13T13:58:33.756Z" and dataset slugs in the body. Use London time and a human dataset name (→XS-08). | copy/type | Must-fix | Blocker |
| CHG-02 | Grouping | Each project appears twice (construction and operational). Group by project, with from → to status chips. | hierarchy | Must-fix | Worth fixing |
| CHG-03 | List | No date grouping or filter. Group by observed date and add a type filter. | hierarchy | Nice-to-have | Minor |
| CHG-04 | Count line | "10 comparisons" at 12 px. Move to the card header (→XS-14). | type | Nice-to-have | Minor |

### API `/api` (13)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| API-01 | curl blocks | Clip on the right at all widths with no scroll cue. Use `overflow-x:auto`, a fade and a Copy button (→XS-04). | mobile/a11y | Must-fix | Worth fixing |
| API-02 | Endpoint cards | Path repeated (h3 + "GET …"). Use a method badge plus the path once (→XS-09). | hierarchy | Must-fix | Worth fixing |
| API-03 | Page nav | 13 endpoints with no index. Add a sticky endpoint list (→XS-06). | hierarchy | Nice-to-have | Minor |
| API-04 | Conventions | "Convert to UK time yourself". Slot "London time" (→XS-10). | copy | Nice-to-have | Minor |

### TOOLS `/tools` (8)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| TOOLS-01 | Service lists | 9,145 px. Each item is 6 lines with a raw mono URL. Use a compact row (name, one-line description, domain only) and task anchors (→XS-06). | spacing/hierarchy | Must-fix | Worth fixing |
| TOOLS-02 | "Verified 20 Oct 2026" | Repeated on every item. Show once per section. | spacing | Nice-to-have | Minor |
| TOOLS-03 | External links | Add an ↗ icon and `aria-label` "opens external site". "Runs on Grid" chip ✓. | a11y | Must-fix | Worth fixing |

### DIRECTORY `/directory` (1) and IDENTIFIERS `/directory/identifiers` (1)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| DIR-01 | Page | HTTP 400 on load (REPORT P1). Add an error state slot with a retry option (→XS-03). | empty | Must-fix | Blocker |
| DIR-02 | Search button | A ghost button at about 28 px for the primary action. Use the primary style and a ≥24 px target (2.5.8). | hierarchy/a11y | Must-fix | Worth fixing |
| DIR-03 | Inputs | Span about 1,100 px. Cap at 480 px with a placeholder and example slot. | spacing | Nice-to-have | Minor |
| DIR-04 | Date input | Renders "10/23/2026". Set `lang` en-GB and add a hint (→XS-08). | type | Must-fix | Worth fixing |
| DIR-05 | Intro copy | /directory describes MPID codes (it belongs on identifiers). **Draft for Writing Bot.** | copy | Nice-to-have | Minor |
| DIR-06 | Initial state | No examples or empty state. Add 2–3 example chips. | empty | Nice-to-have | Minor |

### METHODOLOGY `/methodology` (5) and DATA SOURCES `/data-sources` (16)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| METH-01 | Sources table | 6–8 line cells of licence prose at 11 px, duplicating /data-sources. Keep one canonical list and link to it from the other page. | hierarchy | Must-fix | Worth fixing |
| METH-02 | Table type | 11 px (→XS-14). | a11y | Must-fix | Worth fixing |
| SRC-01 | Breadcrumb | Missing (→XS-15). | hierarchy | Nice-to-have | Minor |
| SRC-02 | Source sections | 16 prose sections. Use a card per source with labelled Licence, Attribution and Refresh fields. | spacing | Nice-to-have | Minor |
| SRC-03 | Copy | "Tinybird", "warmed FUELINST envelope" (→XS-10). | copy | Must-fix | Worth fixing |

### PRIVACY `/privacy` (7) and TERMS `/terms` (6)
| ID | Widget | Fix | Area | Priority | Severity |
|---|---|---|---|---|---|
| LEGAL-01 | Breadcrumb | Missing (→XS-15). | hierarchy | Nice-to-have | Minor |
| LEGAL-02 | "UK GDPR" / jurisdiction | Correct legal terms, exempt from the GB rule. No change. | copy | Nice-to-have | Minor |

---

## 4. Old findings: status
| List | Cleared | Still open (→ new ID) |
|---|---|---|
| grid-home (G-) | G-02/03/04 hero structure and G-09 card spacing are mostly cleared | G-12 in-page nav (→XS-06); G-13/14 repeated ⓘ (→HOME-12); G-16–20 mobile labels and KPI duplication (→HOME-01/02) |
| grid-oct2 (O2-01–18) | Most layout items cleared | Number format and units (→XS-02); stale state (→XS-03) |
| grid-balance (GB-01–14) | Card layout cleared | GB-11 unit spacing (→HOME-13/XS-02) |
| grid-map-card (MC-01–11) | Static card per D9 | Caption and affordance (→HOME-11) |
| grid-map-page (MP-01–17) | MP-01, MP-02 | MP-04, MP-06 (→MAP-03), MP-11 (→MAP-08), MP-16 (→MAP-01) |
| grid-generation-desk (GD) | Mostly cleared | Tick contrast (→XS-11) |
| grid-pipeline-page (PL) | PL-01–05, PL-07, PL-20–24 closed per list | PL-08 partial (→PIPE-03), PL-09 (→PIPE-02), PL-10 (→PIPE-01), PL-20 storage bar partial (→PIPE-04) |

Note: the "cleared" verdicts for G-, O2- and GD- are from visual inspection against the current screenshots. I did not re-run every item one by one.

## 5. Widgets not assessed, and why
- **/map: 0 widgets detected** by the audit tool (a canvas/MapLibre root). Assessed visually as MAP-01 to MAP-08. Layer internals and hover states could not be checked.
- **Interactive states.** Hover, focus rings, tooltips, open dropdowns, tab switches and the "Show table" toggle were not captured, so focus-visible (2.4.7/2.4.11) is flagged but not verified.
- **/directory, /directory/identifiers: results views** were never rendered because of HTTP 400, so only the form shell was assessed.
- **Asset and project detail:** one sample each. Other records may differ.
- **Chart canvas colours** were not pixel-sampled. Contrast relies on token values, so the "verify token" items need a pixel or DOM check.
- **REPORT count discrepancy:** 201 claimed against 208 in result.json. The difference was not reconciled widget by widget.

## 6. Counts by page
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
