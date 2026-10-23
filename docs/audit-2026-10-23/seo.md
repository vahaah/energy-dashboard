# Grid (grid.vahaah.com): per-page SEO and AEO spec, 23 Oct 2026

For: Energy Dashboard Lead (builder). British English. Every value below is copy-paste ready; `{placeholders}` are filled from live data at render time. Nothing on the site or repo was changed while writing this.

Inputs: `/workspace/grid-audit/REPORT.md` and all 26 `copy.txt` files; my own crawl of the live site on Fri 23 Oct 2026, about 13:40–14:00 BST, with a browser user agent and the GPTBot user agent (raw HTML and extracted heads in `/workspace/grid-audit/reviews/crawl/`, `heads.json`); and the earlier plans (`grid-review/oct10/seo.md`, `oct2/seo.md`, `seo-aeo-plan.md`). The generator for §3, which also checks lengths and JSON validity, is `reviews/gen.py`.

## 0. Summary

- **Pages covered: 26.** That's 24 fixed routes plus 2 templates: asset detail (3,340 URLs) and project detail (16,085 URLs). The sitemap holds 19,450 URLs. `/llms.txt` is covered in §2.6, and `/share/[focus]` is a redirect.
- **Title convention:** `{Topic} | Grid`, at most 60 characters, with a pipe and a space each side. No "Grid:" prefix and no "— Grid". The home page follows the same rule.
- **Big change since 10 Oct:** the home P0 is fixed. Raw server HTML now holds the answer sentence and every key number for both browser and GPTBot (13.9 GW wind, 86 gCO₂/kWh, £200.56/MWh), and "No data yet" is gone. Crawlers get byte-identical HTML whatever the user agent.
- **New P0s:**
  1. Duplicate `<h1>` on **both** `/` and `/map`. The audit missed the home one because only one is visible.
  2. Northern Ireland page shows future-dated empty rows.
  3. Home freshness is inconsistent: the hero said 11:00 and the badge said 11:50, at 13:00.
  4. `/changes` compares a snapshot with itself.
  5. Home and `/pipeline` give different pipeline totals.
  6. The zero-carbon record conflicts with NESO's.
  7. JSON-LD is missing on 19 of 26 pages.

## 1. What has changed since 10 Oct

| 10 Oct item | State on 23 Oct |
|---|---|
| P0-1 Home server HTML had no numbers or H1 | **Done.** Answer sentence and figures are in the SSR HTML for browser and GPTBot. New problem: the H1 is rendered twice. |
| P0-2 robots.txt 404 | **Done.** `Allow: /`, `Disallow: /api/`, plus the Sitemap line. It also has a non-standard `Host:` line; harmless, but remove it. |
| llms.txt 404 | **Done**, with a templated "Latest" line. Gaps are listed in §2.6. |
| P0-3 Canonicals | **Done.** Every page has one, and query strings are stripped (`/?range=week` → `/`, `/today?date=…` → `/today`). The home canonical has no trailing slash; keep it that way consistently. |
| P0-3 Titles and descriptions | **Partly done.** 8 titles still lack the suffix and 4 use "— Grid" (§3). |
| P0-4 Records wording plus NESO pairing | **Done.** "since Grid's records began" is used everywhere, NESO's figure sits beside each record, and the solar card is hidden. |
| Solar record disagreement | **Still open, now handled by hiding the card.** The page now cites NESO's official 15.4 GW, 23 Apr 2026, 12:30–13:00. Note that 10 Oct cited NESO's *historic-data* peak of 15,158 MW. Both are NESO figures on different bases: the press release uses PV_Live distribution-connected; the historic mix uses its own series. Pick the press-release figure, as the page does now. |
| P0-5 Snapshot sum check (162 bad half-hours) | **Can't re-run.** `/api/snapshots?date=YYYY-MM-DD` now returns **one row per date** (count 1), not 48 half-hours. My 365-day run found 0 failures, but only on daily rows, so it proves nothing. Please confirm where half-hourly history is served now and re-run the check before any new "highest/lowest" claim. |
| P0-6 Home JSON-LD | **Done.** WebSite, WebApplication, Person and Dataset, with the right `@id`s. To fix: no WebPage node, `temporalCoverage` is `2025-03-18/..`, and there are two separate CreativeWork nodes. The spec in §3.1 adds the WebPage node and merges the CreativeWork nodes into the Dataset. |
| /today, /explained/price-cap, /prices/gas, /methodology, /api pages | **All live**, with visible FAQs and FAQPage markup where a FAQ exists. The price-cap page went up before 1 Nov as planned. |
| Sitemap | **Expanded** from 2 to 19,450 URLs. Problems: no `<lastmod>` on any URL, `/llms.txt` is listed although it isn't HTML, and the same `changefreq hourly` is set on the NI page while its data is stale. |
| JSON-LD on data pages | **Not done.** None on /gas, /map, /assets, /projects, /pipeline, NI, /system/*, /changes, /data-health, /directory*, /tools, /data-sources, /privacy, /terms, or asset and project detail pages. |
| Banned wording | **Clean**, apart from one negated use on /gas ("not a direct live measure"). Change it to "not a direct measure". No "real-time" or "open source" anywhere. |

## 2. Site-wide

### 2.1 Title convention
- Pattern: `{Topic} | Grid`, at most 60 characters including the suffix. Use one separator only, the pipe; replace every "— Grid", and drop the "Grid:" prefix on the home page.
- Make the topic the query people type ("UK gas price today", "GB electricity records"). Keep question-style H1s; titles carry the keyword.
- Set it in Next.js `app/layout.tsx` with `title: { template: '%s | Grid', default: "What's powering Britain's electricity today? | Grid" }`, and give each page only the topic. Never pass a title that already ends in "| Grid" (/api currently would give "… | Grid | Grid" if a template were added naively).
- Descriptions: 120–155 characters, with the source and "free" or "updated hourly" where true. Never use "live" or "real-time".
- `og:title` and `twitter:title` equal the `<title>`. `og:description` and `twitter:description` equal the meta description.

### 2.2 Site graph (in `app/layout.tsx`, or the home page only, referenced by `@id` from every other page)
See the §3.1 JSON-LD block. WebSite `https://grid.vahaah.com/#website`, WebApplication `https://grid.vahaah.com/#app`, Person `https://vahaah.com/#person`. Other pages reference them as `{"@id": …}` and do not redeclare them. Ask the vahaah.com builder to keep the full Person node (name, url, sameAs) at `https://vahaah.com/#person`. Grid only needs `name` and `url` locally.

### 2.3 Canonicals and query parameters
- Canonical is the absolute URL without query or fragment. The home page uses `https://grid.vahaah.com` (as now).
- `?range=`, `?period=`, `?focus=`, `?date=` (on `/` and `/today`) and filter or sort parameters on `/assets`, `/projects` and `/pipeline` all canonicalise to the bare path. This is already the case for `/` and `/today`, so apply the same to the list pages.
- Pagination (`?page=n`): self-canonical plus crawlable `<a href>` links. Alternatively, if pages 2+ are thin, use `noindex,follow`.
- Detail pages: canonical uses the current slug. An old slug 301-redirects to the current one.

### 2.4 robots.txt (replace the current file)
```
User-agent: *
Allow: /
Disallow: /api/
Allow: /api/snapshots

Sitemap: https://grid.vahaah.com/sitemap.xml
```
Notes: the `Allow: /api/snapshots` line is there because llms.txt and the Dataset `contentUrl` point to it. Drop it if you prefer JSON uncrawled (decision D2). Remove `Host:`. Don't add AI-bot-specific blocks: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended are all allowed today, which suits the goal.

### 2.5 Sitemap
- Split into a sitemap index: `sitemap-pages.xml` (the 24 routes), `sitemap-assets.xml` and `sitemap-projects.xml`. Each file must stay under 50,000 URLs.
- Add `<lastmod>` (W3C datetime, UTC) to every URL. Hourly pages use the last successful ingest time. Assets and projects use the REPD edition date, or the TEC snapshot date if later. `/explained/price-cap` uses the last edit. Static pages use the deploy date. Google ignores `changefreq` and `priority`, so they can stay or go.
- Remove `/llms.txt` from the sitemap.
- Leave out detail pages that fail the thin-page rule (§3.9).

### 2.6 llms.txt (full draft, `text/plain; charset=utf-8`, revalidate 3600)
```
# Grid

> Grid is a free view of Great Britain's electricity and gas system, updated hourly from public data: Elexon BMRS, NESO, the NESO Carbon Intensity API and Sheffield Solar PV_Live for electricity; National Gas, the U.S. EIA and the World Bank for gas and oil. Made by Alex Vakhitov (https://vahaah.com). Every figure carries its source, time and unit. Grid's derived data is CC BY 4.0; upstream licences and attributions are on https://grid.vahaah.com/data-sources.

Latest (GB, half-hour starting {HH:MM} {BST|GMT} on {Ddd D Mon YYYY}): {top_fuel} supplied {top_pct}% of generation ({top_gw} GW), gas {gas_pct}%, carbon intensity {ci} gCO2/kWh, market index £{mip}/MWh. Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV_Live.
Latest GB gas System Average Price: {sap_pkwh}p/kWh ({sap_ptherm}p/therm) for gas day {D Mon YYYY}. Source: National Gas.
Ofgem price cap: £1,723 a year (typical dual-fuel Direct Debit, 1 Oct–31 Dec 2026). Next cap announced 25 Nov 2026.

## Answers
- [Britain's electricity today](https://grid.vahaah.com/today): today's generation mix, gas share, carbon intensity, demand, imports and market price, with a visible FAQ
- [What's powering Britain](https://grid.vahaah.com/): the latest half-hour, with day, week, year and all-time views
- [UK gas price today](https://grid.vahaah.com/prices/gas): GB System Average Price, Henry Hub, World Bank Europe gas and Japan LNG
- [Will energy bills go up in January 2027?](https://grid.vahaah.com/explained/price-cap): Ofgem price caps as published, and what sets the next one
- [GB electricity records](https://grid.vahaah.com/records): records since Grid's records began, next to NESO's official records
- [GB gas system](https://grid.vahaah.com/gas): National Transmission System supply, demand, linepack and storage by gas day

## Data pages
- [Map](https://grid.vahaah.com/map): interconnector and gas entry-point flows, power stations, DNO licence areas
- [Storage](https://grid.vahaah.com/system/storage): battery and pumped-storage capacity, and what pumped storage is doing
- [Constraints](https://grid.vahaah.com/system/constraints): published transmission constraint cost and volume (NESO, published with a lag)
- [Pipeline](https://grid.vahaah.com/pipeline): renewable and storage projects by stage, technology and nation (DESNZ REPD, quarterly)
- [Projects](https://grid.vahaah.com/projects): planning, construction and connection status from REPD and the NESO TEC register
- [Assets](https://grid.vahaah.com/assets): operational stations from REPD and DUKES
- [Whole energy](https://grid.vahaah.com/system/whole-energy): UK annual energy balance 2025 (DUKES 2026), not today's figures
- [Northern Ireland](https://grid.vahaah.com/electricity/northern-ireland): NI and all-island electricity, kept outside GB totals
- [Changes](https://grid.vahaah.com/changes): changes found in published registers, with evidence
- [Directory](https://grid.vahaah.com/directory): who holds an MPID or industry code, by date
- [Tools](https://grid.vahaah.com/tools): official services by task (bills, network operators, power cuts, gas emergencies)

## Method and data
- [Methodology](https://grid.vahaah.com/methodology): sources, cadence, definitions, data checks, how records work
- [Data sources](https://grid.vahaah.com/data-sources): every source with its licence and required attribution
- [Data health](https://grid.vahaah.com/data-health): when each source published and when Grid fetched it
- [API](https://grid.vahaah.com/api): free JSON, no key, 60 requests a minute
- [Snapshots JSON, last 24 hours](https://grid.vahaah.com/api/snapshots?range=24h)

## How to cite
Grid (grid.vahaah.com), {page title}, data from {sources named on the page}, retrieved {D Mon YYYY, HH:MM} {BST|GMT}. Licence: CC BY 4.0 for Grid's derived data; upstream attributions apply.
```
Changes from the current file: it adds /gas, NI, /data-sources and /directory, and adds the gas price and price-cap lines. It also fixes the citation line, which named only Elexon and NESO. And the "Latest" timestamp must come from the same half-hour as the home hero.

### 2.7 Open Graph and Twitter defaults (layout)
```ts
openGraph: { siteName: 'Grid', locale: 'en_GB', type: 'website', images: [{ url: '/og', width: 1200, height: 630, alt: '{page-specific alt}' }] },
twitter: { card: 'summary_large_image' /* add site: '@{handle}' only if Alex wants one, D5 */ },
```
- `og:image:alt` and `twitter:image:alt`: a sentence describing the card, not the title repeated. Data pages use their summary sentence. `twitter:image:alt` is missing on every page today.
- `og:locale` is missing on every page today, so add `en_GB`.
- `/data-health` uses the generic `/og`; give it a route card like the other pages.
- Detail pages: the card shows the name, technology, capacity and region. That's already per-route, so keep it.
- For `/explained/price-cap`, set `og:type` to `article` and add `article:published_time` and `article:modified_time`. Everything else stays `website`.

### 2.8 Language
`<html lang="en-GB">` on every page (currently `lang="en"`). Add `inLanguage: "en-GB"` to every JSON-LD node that has one, as the §3 blocks do. Use "Great Britain" or "GB" for electricity and gas, "UK" only for DUKES (whole energy) and the price-cap page (Ofgem: England, Scotland and Wales).

### 2.9 Licence and attribution (applies to every Dataset)
- `license`: `https://creativecommons.org/licenses/by/4.0/` for Grid's derived data. Each upstream source goes in `isBasedOn` with its required `creditText` (wording copied from /data-sources):
  - Elexon: "Contains BMRS data © Elexon Limited copyright and database right 2026."
  - NESO: "Supported by National Energy SO Open Data"
  - Carbon Intensity API: "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF."
  - Sheffield Solar: "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO." (licence: see D3)
- The visible figure credit on each page must match the `isBasedOn` list.

## 3. Per-page spec

Lengths are in characters. Detail-page rows show the template plus the audited example.

### 3.1 `/`

| Field | Current | New |
|---|---|---|
| Title | Grid: what's powering Britain's electricity today (49) | **What's powering Britain's electricity today? | Grid** (51) |
| Meta description | see REPORT.md | GB electricity mix, carbon intensity, demand and prices. Free and updated hourly from Elexon, NESO and Sheffield Solar, with a source on each figure. (149) |
| H1 (one only) | — | What's powering Britain? |

**H1 fix:** Server HTML has TWO identical `<h1>` elements (desktop and mobile hero both render one). Keep one `<h1>`; make the other a `<p class=…>` or render one component with responsive CSS.

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> At {HH:MM} {BST|GMT} on {Ddd D Mon YYYY}, {top_fuel} was Britain's largest source of electricity at {top_gw} GW ({top_pct}%). Gas supplied {gas_pct}%, and carbon intensity was {ci} gCO₂/kWh. The market index price was £{mip}/MWh. Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV_Live. Grid is free and updated hourly from public data.

Already server-rendered (confirmed in raw HTML for browser and GPTBot UAs, 23 Oct). Lower-case the fuel mid-sentence (copy shows 'Wind was'). The timestamp must be the settlement period the figures come from, and the 'Data as of' badge must use the same period; on 23 Oct at 13:00 the hero said 11:00 while the badge said 11:50.

No visible FAQ on the home page, so no FAQPage. Put Q&A on /today instead.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebSite",
   "@id": "https://grid.vahaah.com/#website",
   "url": "https://grid.vahaah.com/",
   "name": "Grid",
   "description": "Free view of Great Britain's electricity and gas system, updated hourly from public data.",
   "inLanguage": "en-GB",
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "creator": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "WebApplication",
   "@id": "https://grid.vahaah.com/#app",
   "name": "Grid",
   "url": "https://grid.vahaah.com/",
   "applicationCategory": "ReferenceApplication",
   "operatingSystem": "Any (web browser)",
   "isAccessibleForFree": true,
   "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "GBP"
   },
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "inLanguage": "en-GB"
  },
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/#webpage",
   "url": "https://grid.vahaah.com/",
   "name": "What's powering Britain's electricity today? | Grid",
   "description": "GB electricity mix, carbon intensity, demand and prices. Free and updated hourly from Elexon, NESO and Sheffield Solar, with a source on each figure.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "about": {
    "@id": "https://grid.vahaah.com/#dataset"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}"
  },
  {
   "@type": "Person",
   "@id": "https://vahaah.com/#person",
   "name": "Alex Vakhitov",
   "url": "https://vahaah.com/"
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/#dataset",
   "name": "Great Britain electricity generation, demand, carbon intensity and prices (half-hourly)",
   "description": "Half-hourly GB generation by fuel, demand, interconnector flows, carbon intensity and market prices, with gas and oil prices for context. Updated hourly.",
   "url": "https://grid.vahaah.com/",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Generation by fuel",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Demand",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Interconnector flow",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Carbon intensity",
     "unitText": "gCO2/kWh"
    },
    {
     "@type": "PropertyValue",
     "name": "Market index price",
     "unitText": "GBP/MWh"
    },
    {
     "@type": "PropertyValue",
     "name": "System (imbalance) price",
     "unitText": "GBP/MWh"
    },
    {
     "@type": "PropertyValue",
     "name": "GB gas System Average Price",
     "unitText": "p/kWh"
    }
   ],
   "temporalCoverage": "2025-03-18/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    },
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    },
    {
     "@type": "Dataset",
     "name": "NESO Carbon Intensity API",
     "url": "https://carbonintensity.org.uk/",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF."
    },
    {
     "@type": "Dataset",
     "name": "Sheffield Solar PV_Live",
     "url": "https://www.solar.sheffield.ac.uk/pvlive/",
     "creditText": "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO."
    },
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    },
    {
     "@type": "Dataset",
     "name": "U.S. Energy Information Administration",
     "url": "https://www.eia.gov/",
     "creditText": "Source: U.S. Energy Information Administration."
    },
    {
     "@type": "Dataset",
     "name": "World Bank Commodity Price Data (The Pink Sheet)",
     "url": "https://www.worldbank.org/en/research/commodity-markets",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/snapshots?range=24h"
    }
   ]
  }
 ]
}
```

**Links in:** Every page (logo, breadcrumb root).  
**Links out:** /today, /records, /prices/gas, /explained/price-cap, /gas, /map, /pipeline, /methodology, /api, /data-sources; replace any `?focus=` links with real URLs.

**AEO notes:** Keep the single citable sentence first in `<main>`. Make the hero sentence an `<p id="summary">` so llms.txt and others can deep-link `/#summary`. og:image is already a per-hour card (/og?p=…): good; make og:image:alt the summary sentence (it is the balance sentence now).

### 3.2 `/today`

| Field | Current | New |
|---|---|---|
| Title | GB electricity today: mix, carbon and price (43) | **GB electricity today: mix, carbon and price | Grid** (50) |
| Meta description | see REPORT.md | How Britain's electricity was made today: wind, gas, nuclear, solar and imports in GW and %, plus carbon intensity and market price. Free, updated hourly. (154) |
| H1 (one only) | — | Britain's electricity today |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> So far today ({D Mon YYYY}, to {HH:MM} {BST|GMT}), wind supplied {wind_pct}% of Britain's generation, gas {gas_pct}%, nuclear {nuc_pct}% and solar {solar_pct}%. Carbon intensity averaged {ci_avg} gCO₂/kWh and the market index price averaged £{mip_avg}/MWh. Source: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV_Live; updated hourly.

Exists and is server-rendered. Add 'Carbon Intensity API' and 'Sheffield Solar PV_Live' to the source line (the page cites carbon and solar but credits only Elexon and NESO).

**Visible FAQ:**

- *How much of Britain's electricity is wind right now?* — In the latest half-hour Grid holds ({HH:MM} {BST|GMT}, {D Mon}), wind was {wind_pct}% of generation ({wind_gw} GW). Source: Elexon BMRS, NESO.
- *How much came from gas today?* — So far today gas supplied {gas_pct}% of generation, averaging {gas_gw} GW ({gas_gwh} GWh). Source: Elexon BMRS.
- *Is Britain importing electricity today?* — In the latest half-hour Britain imported {imp_gw} GW and exported {exp_gw} GW, mostly from {top_ic}. Source: Elexon BMRS.
- *How clean is the grid today?* — Carbon intensity has averaged {ci_avg} gCO₂/kWh so far today. Source: NESO Carbon Intensity API (CC BY 4.0).
- *What's the wholesale electricity price today?* — The market index (APXMIDP) has averaged £{mip_avg}/MWh so far today, from £{mip_min} at {t_min} to £{mip_max}/MWh at {t_max}. Source: Elexon BMRS.

Already visible + FAQPage. Fix: every answer must use the same latest half-hour as the hero (on 23 Oct the FAQ said 13.8 GW wind while home said 13.9 GW). Name the time in each answer.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/today#webpage",
   "url": "https://grid.vahaah.com/today",
   "name": "GB electricity today: mix, carbon and price | Grid",
   "description": "How Britain's electricity was made today: wind, gas, nuclear, solar and imports in GW and %, plus carbon intensity and market price. Free, updated hourly.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/today#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/today#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/today#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Today",
     "item": "https://grid.vahaah.com/today"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/today#dataset",
   "name": "GB electricity today: generation mix, carbon intensity, demand and price",
   "description": "Today's half-hourly GB generation mix, carbon intensity, demand, imports and market index, compared with yesterday and the past 7 days.",
   "url": "https://grid.vahaah.com/today",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Generation by fuel",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Share of generation",
     "unitText": "percent"
    },
    {
     "@type": "PropertyValue",
     "name": "Carbon intensity",
     "unitText": "gCO2/kWh"
    },
    {
     "@type": "PropertyValue",
     "name": "Demand",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Market index price",
     "unitText": "GBP/MWh"
    }
   ],
   "temporalCoverage": "{YYYY-MM-DD}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    },
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    },
    {
     "@type": "Dataset",
     "name": "NESO Carbon Intensity API",
     "url": "https://carbonintensity.org.uk/",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF."
    },
    {
     "@type": "Dataset",
     "name": "Sheffield Solar PV_Live",
     "url": "https://www.solar.sheffield.ac.uk/pvlive/",
     "creditText": "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/snapshots?range=24h"
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/today#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "How much of Britain's electricity is wind right now?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "In the latest half-hour Grid holds ({HH:MM} {BST|GMT}, {D Mon}), wind was {wind_pct}% of generation ({wind_gw} GW). Source: Elexon BMRS, NESO."
     }
    },
    {
     "@type": "Question",
     "name": "How much came from gas today?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "So far today gas supplied {gas_pct}% of generation, averaging {gas_gw} GW ({gas_gwh} GWh). Source: Elexon BMRS."
     }
    },
    {
     "@type": "Question",
     "name": "Is Britain importing electricity today?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "In the latest half-hour Britain imported {imp_gw} GW and exported {exp_gw} GW, mostly from {top_ic}. Source: Elexon BMRS."
     }
    },
    {
     "@type": "Question",
     "name": "How clean is the grid today?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Carbon intensity has averaged {ci_avg} gCO₂/kWh so far today. Source: NESO Carbon Intensity API (CC BY 4.0)."
     }
    },
    {
     "@type": "Question",
     "name": "What's the wholesale electricity price today?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "The market index (APXMIDP) has averaged £{mip_avg}/MWh so far today, from £{mip_min} at {t_min} to £{mip_max}/MWh at {t_max}. Source: Elexon BMRS."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /explained/price-cap, /prices/gas, /records, nav.  
**Links out:** / (with ?date= of the same day), /records, /prices/gas, /explained/price-cap, /methodology, /map.

**AEO notes:** This is the target URL for 'UK electricity mix today', 'how much wind now', 'carbon intensity today'. `?date=` already canonicalises to /today: good. Consider dated archive URLs (/today/2026-10-23) later so past days are citable; until then keep the canonical.

### 3.3 `/gas`

| Field | Current | New |
|---|---|---|
| Title | Britain's gas system: supply, demand and storage | Grid (55) | **GB gas supply, demand and linepack by gas day | Grid** (52) |
| Meta description | see REPORT.md | Gas into and out of Britain's National Transmission System by gas day: supply by terminal, demand, linepack and storage flows. Free, updated hourly. (148) |
| H1 (one only) | — | Where is Britain's gas coming from, and where is it going? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> On gas day {D Mon YYYY} (05:00–05:00 UK time), to {HH:MM} {BST|GMT}, NTS supply was flowing at {supply} million m³/day and demand at {demand} million m³/day; power stations took {power_pct}% and distribution networks {ldz_pct}%. Source: National Gas Transmission Data Portal; updated hourly.

New: the page has no prose lead with numbers. Put it above the cards. Copy rule: change 'It is not a direct live measure of household heating' to 'It is not a direct measure of household heating' (banned word).

**Visible FAQ:**

- *Where does Britain's gas come from?* — Entry by terminal for gas day {D Mon}: {top_terminal} {x} million m³/day, … North/South split {n}%/{s}%. Link to /map for terminals.
- *How much gas do power stations use?* — {power} million m³/day ({power_pct}% of NTS demand) on gas day {D Mon}, to {HH:MM}. Link to /today for gas's share of electricity.
- *What is linepack?* — Gas held in the pipelines; opening {open} million m³, predicted close {close} million m³.
- *What is a gas day?* — 05:00 to 05:00 UK time; figures before 05:00 next day are partial.

Add a visible 'Questions' section, then FAQPage. Answers take live values.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/gas#webpage",
   "url": "https://grid.vahaah.com/gas",
   "name": "GB gas supply, demand and linepack by gas day | Grid",
   "description": "Gas into and out of Britain's National Transmission System by gas day: supply by terminal, demand, linepack and storage flows. Free, updated hourly.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/gas#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/gas#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/gas#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Gas",
     "item": "https://grid.vahaah.com/gas"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/gas#dataset",
   "name": "GB National Transmission System gas flows by gas day",
   "description": "Hourly NTS supply by terminal, demand by type, linepack and storage flows for each gas day (05:00–05:00 UK time).",
   "url": "https://grid.vahaah.com/gas",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "NTS entry (supply)",
     "unitText": "million m3/day"
    },
    {
     "@type": "PropertyValue",
     "name": "NTS exit (demand)",
     "unitText": "million m3/day"
    },
    {
     "@type": "PropertyValue",
     "name": "Linepack",
     "unitText": "million m3"
    },
    {
     "@type": "PropertyValue",
     "name": "Storage injection and withdrawal",
     "unitText": "million m3/day"
    }
   ],
   "temporalCoverage": "{GAS_DAY_START_ISO}/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/gas/overview"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/gas/series"
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/gas#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "Where does Britain's gas come from?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Entry by terminal for gas day {D Mon}: {top_terminal} {x} million m³/day, … North/South split {n}%/{s}%. Link to /map for terminals."
     }
    },
    {
     "@type": "Question",
     "name": "How much gas do power stations use?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "{power} million m³/day ({power_pct}% of NTS demand) on gas day {D Mon}, to {HH:MM}. Link to /today for gas's share of electricity."
     }
    },
    {
     "@type": "Question",
     "name": "What is linepack?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Gas held in the pipelines; opening {open} million m³, predicted close {close} million m³."
     }
    },
    {
     "@type": "Question",
     "name": "What is a gas day?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "05:00 to 05:00 UK time; figures before 05:00 next day are partial."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /prices/gas, /explained/price-cap, /map, /today.  
**Links out:** /prices/gas, /map (gas layer), /today, /data-health#gas, /api#gas.

**AEO notes:** Fix the storage-inventory gap message to say what is missing and why in one sentence. Fill the empty /data-health rows for completed gas days (audit defect 5) so the freshness story is consistent.

### 3.4 `/prices/gas`

| Field | Current | New |
|---|---|---|
| Title | UK gas price today: SAP, Henry Hub, Europe, Japan LNG (53) | **UK gas price today: SAP, Henry Hub and LNG | Grid** (49) |
| Meta description | see REPORT.md | Today's GB System Average Price of gas in p/therm and p/kWh from National Gas, with Henry Hub, European gas and Japan LNG for context. Free, with sources. (154) |
| H1 (one only) | — | UK gas price today |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> The GB System Average Price of gas for gas day {D Mon YYYY} was {sap_pkwh}p/kWh ({sap_ptherm}p/therm), published by National Gas on {D Mon YYYY}. Henry Hub was ${hh}/MMBtu on {D Mon} (EIA). Source: National Gas Transmission Data Portal (PUBOB603).

Exists. Note in the lead that SAP is published about a day after the gas day, so 'today' means the latest published gas day. Use '$/MMBtu' consistently (cards show '$/MMBTU').

**Visible FAQ:**

- *What is the System Average Price?* — Existing answer; keep live value + gas day.
- *What's the difference between SAP and NBP?* — Existing.
- *How do p/therm and p/kWh convert?* — 1 therm = 29.3071 kWh.
- *Why does gas set the electricity price?* — Existing; link /today and /explained/price-cap.

Already visible + FAQPage. Keep.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/prices/gas#webpage",
   "url": "https://grid.vahaah.com/prices/gas",
   "name": "UK gas price today: SAP, Henry Hub and LNG | Grid",
   "description": "Today's GB System Average Price of gas in p/therm and p/kWh from National Gas, with Henry Hub, European gas and Japan LNG for context. Free, with sources.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/prices/gas#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/prices/gas#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/prices/gas#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Prices",
     "item": "https://grid.vahaah.com/prices/gas"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Gas",
     "item": "https://grid.vahaah.com/prices/gas"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/prices/gas#dataset",
   "name": "GB gas System Average Price with Henry Hub, Europe gas and Japan LNG",
   "description": "Daily GB System Average Price (PUBOB603), daily Henry Hub, and monthly World Bank Europe natural gas and Japan LNG.",
   "url": "https://grid.vahaah.com/prices/gas",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "GB gas System Average Price",
     "unitText": "p/kWh"
    },
    {
     "@type": "PropertyValue",
     "name": "GB gas System Average Price",
     "unitText": "p/therm"
    },
    {
     "@type": "PropertyValue",
     "name": "Henry Hub",
     "unitText": "USD/MMBtu"
    },
    {
     "@type": "PropertyValue",
     "name": "Natural gas, Europe (World Bank)",
     "unitText": "USD/MMBtu"
    },
    {
     "@type": "PropertyValue",
     "name": "LNG, Japan (World Bank)",
     "unitText": "USD/MMBtu"
    }
   ],
   "temporalCoverage": "2025-03-18/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    },
    {
     "@type": "Dataset",
     "name": "U.S. Energy Information Administration",
     "url": "https://www.eia.gov/",
     "creditText": "Source: U.S. Energy Information Administration."
    },
    {
     "@type": "Dataset",
     "name": "World Bank Commodity Price Data (The Pink Sheet)",
     "url": "https://www.worldbank.org/en/research/commodity-markets",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com{CONFIRM_PRICE_ENDPOINT}"
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/prices/gas#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "What is the System Average Price?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing answer; keep live value + gas day."
     }
    },
    {
     "@type": "Question",
     "name": "What's the difference between SAP and NBP?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing."
     }
    },
    {
     "@type": "Question",
     "name": "How do p/therm and p/kWh convert?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "1 therm = 29.3071 kWh."
     }
    },
    {
     "@type": "Question",
     "name": "Why does gas set the electricity price?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing; link /today and /explained/price-cap."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /explained/price-cap, /gas, /today.  
**Links out:** /gas, /explained/price-cap, /today, /methodology#definitions.

**AEO notes:** No Dutch TTF anywhere (no licence): the 'EU natural gas' card is World Bank monthly Europe gas, so keep that label and never call it TTF. Add the 30/90-day SAP change in one sentence (already computed on home: '+60.4 p/therm, +39.2% over 90d') with its window dates.

### 3.5 `/explained/price-cap`

| Field | Current | New |
|---|---|---|
| Title | Will energy bills go up in January 2027? (40) | **Will energy bills go up in January 2027? | Grid** (47) |
| Meta description | see REPORT.md | Ofgem announces the January–March 2027 price cap on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, what it covers. (148) |
| H1 (one only) | — | Will energy bills go up in January 2027? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Ofgem will announce the price cap for 1 January to 31 March 2027 on 25 November 2026. The current cap (1 October to 31 December 2026) is £1,723 a year for a typical dual-fuel Direct Debit household. GB gas SAP averaged {sap_avg}p/kWh over {n} gas days from 19 Aug to {D Mon} 2026. Source: Ofgem; National Gas.

Exists and is correct against Ofgem (checked 23 Oct: £1,723, 26 Aug announcement, 2,500/9,500 kWh TDCV, £1,862 on the old TDCV). On or after 25 Nov swap the lead to: 'From 1 January 2027 the price cap is £{cap} a year for a typical dual-fuel Direct Debit household, {up|down} {pct}% from £1,723, Ofgem announced on {D Mon 2026}.' and the title to 'January 2027 price cap: £{cap} a year | Grid' (≤60).

**Visible FAQ:**

- *When is the January 2027 price cap announced?* — 25 November 2026, per Ofgem; may publish earlier.
- *What does the price cap limit?* — Unit rates and standing charges on default tariffs, not total bills.
- *Why does the gas price affect electricity bills?* — Wholesale allowance follows observed prices; gas often sets the marginal electricity price. Link /prices/gas.
- *Does the cap apply to fixed tariffs?* — No.

Already visible + FAQPage. Add one: 'How much is the price cap now?' → £1,723 (1 Oct–31 Dec 2026), with the Ofgem link.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/explained/price-cap#webpage",
   "url": "https://grid.vahaah.com/explained/price-cap",
   "name": "Will energy bills go up in January 2027? | Grid",
   "description": "Ofgem announces the January–March 2027 price cap on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, what it covers.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/explained/price-cap#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/explained/price-cap#article"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/explained/price-cap#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Explained",
     "item": "https://grid.vahaah.com/explained/price-cap"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Price cap",
     "item": "https://grid.vahaah.com/explained/price-cap"
    }
   ]
  },
  {
   "@type": "Article",
   "@id": "https://grid.vahaah.com/explained/price-cap#article",
   "headline": "Will energy bills go up in January 2027?",
   "description": "Ofgem announces the January–March 2027 price cap on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, what it covers.",
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "datePublished": "{FIRST_PUBLISHED_ISO}",
   "dateModified": "{LAST_EDIT_ISO}",
   "inLanguage": "en-GB",
   "about": [
    {
     "@type": "Thing",
     "name": "Ofgem energy price cap"
    }
   ],
   "citation": [
    "https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges",
    "https://www.ofgem.gov.uk/press-release/energy-price-cap-will-rise-4-october-2026"
   ],
   "isBasedOn": {
    "@type": "Dataset",
    "name": "National Gas Transmission Data Portal",
    "url": "https://data.nationalgas.com",
    "creditText": "Data sourced from the National Gas Transmission Data Portal."
   }
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/explained/price-cap#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "When is the January 2027 price cap announced?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "25 November 2026, per Ofgem; may publish earlier."
     }
    },
    {
     "@type": "Question",
     "name": "What does the price cap limit?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Unit rates and standing charges on default tariffs, not total bills."
     }
    },
    {
     "@type": "Question",
     "name": "Why does the gas price affect electricity bills?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Wholesale allowance follows observed prices; gas often sets the marginal electricity price. Link /prices/gas."
     }
    },
    {
     "@type": "Question",
     "name": "Does the cap apply to fixed tariffs?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "No."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /today, /prices/gas, /tools, nav.  
**Links out:** Ofgem unit-rates page, /prices/gas, /today, /gas.

**AEO notes:** Highest-intent page this winter. Make the 'Secondary sources put the window at 19 Aug to 17 Nov 2026' line cite the source by name, or drop the dates (unverified against Ofgem). Add a visible 'Last updated {D Mon YYYY}' line and match dateModified.

### 3.6 `/records`

| Field | Current | New |
|---|---|---|
| Title | GB electricity records: wind, solar and carbon (46) | **GB electricity records: wind, carbon, renewables | Grid** (55) |
| Meta description | see REPORT.md | Britain's highest wind, highest renewable share and lowest carbon half-hours since Grid's records began, each shown next to NESO's official record. (147) |
| H1 (one only) | — | GB electricity records |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> The highest wind since Grid's records began was {wind_gw} GW at {HH:MM} {BST|GMT} on {Ddd D Mon YYYY}; NESO's official record is {neso_wind_mw} MW on {D Mon YYYY}. Source: NESO historic generation mix (from 1 Jan 2009).

Title drops 'solar' because the solar card is hidden. Wording now uses 'since Grid's records began' and pairs with NESO: done since 10 Oct. See the records check in §4 for the zero-carbon mismatch.

**Visible FAQ:**

- *What is the wind record based on?* — Existing.
- *Why is there no solar record?* — Existing; NESO official 15.4 GW, 23 Apr 2026, 12:30–13:00.
- *What was the lowest carbon half-hour since Grid's records began?* — Existing.
- *When did Britain stop burning coal for electricity?* — Existing; '{n} days ago' must be computed at render.

Already visible + FAQPage. Add 'Why does Grid's zero-carbon record differ from NESO's?' once the basis note is decided (§4).

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/records#webpage",
   "url": "https://grid.vahaah.com/records",
   "name": "GB electricity records: wind, carbon, renewables | Grid",
   "description": "Britain's highest wind, highest renewable share and lowest carbon half-hours since Grid's records began, each shown next to NESO's official record.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/records#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/records#records"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/records#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Records",
     "item": "https://grid.vahaah.com/records"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/records#dataset",
   "name": "GB electricity records since Grid's records began",
   "description": "Highest and lowest half-hours in NESO's historic generation mix since 1 Jan 2009, shown beside NESO's official records.",
   "url": "https://grid.vahaah.com/records",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Wind generation",
     "unitText": "GW"
    },
    {
     "@type": "PropertyValue",
     "name": "Carbon intensity",
     "unitText": "gCO2/kWh"
    },
    {
     "@type": "PropertyValue",
     "name": "Renewable share",
     "unitText": "percent"
    },
    {
     "@type": "PropertyValue",
     "name": "Zero-carbon share",
     "unitText": "percent"
    }
   ],
   "temporalCoverage": "2009-01-01/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    }
   ]
  },
  {
   "@type": "ItemList",
   "@id": "https://grid.vahaah.com/records#records",
   "name": "GB electricity records since Grid's records began",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "url": "https://grid.vahaah.com/records#wind",
     "item": {
      "@type": "Observation",
      "name": "Highest wind since Grid's records began",
      "observationDate": "{wind_iso}",
      "value": {
       "@type": "QuantitativeValue",
       "value": "{wind_gw}",
       "unitText": "GW"
      },
      "comment": "NESO official record: {neso_wind_mw} MW, {neso_wind_date}"
     }
    },
    {
     "@type": "ListItem",
     "position": 2,
     "url": "https://grid.vahaah.com/records#carbon",
     "item": {
      "@type": "Observation",
      "name": "Lowest carbon intensity since Grid's records began",
      "observationDate": "{ci_iso}",
      "value": {
       "@type": "QuantitativeValue",
       "value": "{ci_g}",
       "unitText": "gCO2/kWh"
      }
     }
    },
    {
     "@type": "ListItem",
     "position": 3,
     "url": "https://grid.vahaah.com/records#renewable-share",
     "item": {
      "@type": "Observation",
      "name": "Highest renewable share since Grid's records began",
      "observationDate": "{ren_iso}",
      "value": {
       "@type": "QuantitativeValue",
       "value": "{ren_pct}",
       "unitText": "percent"
      }
     }
    },
    {
     "@type": "ListItem",
     "position": 4,
     "url": "https://grid.vahaah.com/records#zero-carbon",
     "item": {
      "@type": "Observation",
      "name": "Highest zero-carbon share since Grid's records began",
      "observationDate": "{zc_iso}",
      "value": {
       "@type": "QuantitativeValue",
       "value": "{zc_pct}",
       "unitText": "percent"
      },
      "comment": "NESO official record (transmission network only): 98.8%, 22 Apr 2026, 15:30–16:00"
     }
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/records#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "What is the wind record based on?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing."
     }
    },
    {
     "@type": "Question",
     "name": "Why is there no solar record?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing; NESO official 15.4 GW, 23 Apr 2026, 12:30–13:00."
     }
    },
    {
     "@type": "Question",
     "name": "What was the lowest carbon half-hour since Grid's records began?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing."
     }
    },
    {
     "@type": "Question",
     "name": "When did Britain stop burning coal for electricity?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Existing; '{n} days ago' must be computed at render."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /today, /methodology#records, nav.  
**Links out:** /methodology#records, /today, NESO press release for each official record.

**AEO notes:** Each record card gets its own fragment id (#wind, #carbon, #renewable-share, #zero-carbon, #coal) so answers can cite one record. Change the H1 to 'GB electricity records since Grid's records began' only if it fits the design; the title already carries the claim.

### 3.7 `/map`

| Field | Current | New |
|---|---|---|
| Title | Flows across GB borders (23) | **Map of GB electricity and gas flows | Grid** (42) |
| Meta description | see REPORT.md | Map of Britain's electricity interconnectors and gas entry points with the latest published flows in MW and mcm/d, plus power stations and DNO areas. (149) |
| H1 (one only) | — | Flows across GB borders |

**H1 fix:** Two identical `<h1>` in server HTML (sidebar header rendered twice). Keep the one in the sidebar heading; demote the other to a `<p>` or `aria-hidden` visual label.

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> At {HH:MM} {BST|GMT} on {D Mon YYYY}, Britain was a net importer of {net_mw} MW of electricity across {n} interconnectors, and {net_mcm} mcm/d of gas was flowing into the GB system. Sources: Elexon BMRS; National Gas Transmission Data Portal.

New prose lead (the page has counts but no sentence). Show 'Barrow' and 'Bacton IPs' as '0.0 mcm/d' or 'No reading', not '— · 0.0'.

No FAQ; the map is a tool. Don't add FAQPage.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/map#webpage",
   "url": "https://grid.vahaah.com/map",
   "name": "Map of GB electricity and gas flows | Grid",
   "description": "Map of Britain's electricity interconnectors and gas entry points with the latest published flows in MW and mcm/d, plus power stations and DNO areas.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/map#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/map#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/map#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Map",
     "item": "https://grid.vahaah.com/map"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/map#dataset",
   "name": "GB interconnector and gas entry-point flows",
   "description": "Latest published flow on each GB electricity interconnector (MW) and NTS gas entry or exit point (mcm/d).",
   "url": "https://grid.vahaah.com/map",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Interconnector flow",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Gas entry and exit flow",
     "unitText": "million m3/day"
    }
   ],
   "temporalCoverage": "{ISO_8601_LATEST}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    },
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    },
    {
     "@type": "Dataset",
     "name": "GeoNames",
     "url": "https://www.geonames.org/",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "Place coordinates from GeoNames, CC BY 4.0."
    },
    {
     "@type": "Dataset",
     "name": "OS Open Zoomstack",
     "creditText": "Contains OS data © Crown copyright and database right 2026"
    },
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/map/layers"
    }
   ]
  }
 ]
}
```

**Links in:** /, /assets, /gas, /tools, asset detail 'View on map'.  
**Links out:** /assets, /gas, /today#imports, /electricity/northern-ireland (Moyle), /data-sources.

**AEO notes:** Render the flows table as a real `<table>` with a caption (it's there as a list) so crawlers can read per-link MW. Fix the electricity lag banner (defect 6).

### 3.8 `/assets`

| Field | Current | New |
|---|---|---|
| Title | GB stations, interconnectors and gas terminals (46) | **GB power stations: capacity, technology, region | Grid** (54) |
| Meta description | see REPORT.md | Search 3,340 operational power stations, interconnectors and gas terminals in Great Britain by technology, region and capacity, from DESNZ REPD and DUKES. (154) |
| H1 (one only) | — | Power stations and assets in Great Britain |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid lists {n_assets} operational assets in Great Britain from the DESNZ Renewable Energy Planning Database ({repd_edition}) and DUKES 5.11 ({dukes_edition}), each counted once. Source: DESNZ, Open Government Licence v3.0.

Template the count ({n_assets}); the description's '3,340' must come from the same value at build time.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/assets#webpage",
   "url": "https://grid.vahaah.com/assets",
   "name": "GB power stations: capacity, technology, region | Grid",
   "description": "Search 3,340 operational power stations, interconnectors and gas terminals in Great Britain by technology, region and capacity, from DESNZ REPD and DUKES.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/assets#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/assets#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/assets#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Assets",
     "item": "https://grid.vahaah.com/assets"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/assets#dataset",
   "name": "GB operational power stations, interconnectors and gas terminals",
   "description": "Operational stations from DESNZ REPD and DUKES 5.11, interconnectors and gas terminals, with capacity, technology, region and source.",
   "url": "https://grid.vahaah.com/assets",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Capacity",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Technology",
     "unitText": "category"
    },
    {
     "@type": "PropertyValue",
     "name": "Region",
     "unitText": "category"
    }
   ],
   "temporalCoverage": "{REPD_EDITION_DATE}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "DESNZ Renewable Energy Planning Database",
     "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    },
    {
     "@type": "Dataset",
     "name": "DESNZ Digest of UK Energy Statistics (DUKES)",
     "url": "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    },
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    },
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    }
   ]
  }
 ]
}
```

**Links in:** /, /map, /system/storage, asset detail pages.  
**Links out:** each asset detail, /map, /projects, /pipeline, /data-sources.

**AEO notes:** Pagination: page 2+ should be crawlable `<a href="/assets?page=2">` with canonical to itself (not to /assets) only if those pages have unique content; otherwise noindex,follow on ?page≥2. Filters (?technology=…) canonicalise to /assets.

### 3.9 `/assets/{id}/{slug}`

Template page; example audited: `/assets/ast_0003670fbf90f564/cuckoo-grove-farm`.

| Field | Current | New |
|---|---|---|
| Title | Cuckoo Grove Farm: Solar PV | Grid (34) | **{Name}: {capacity} MW {technology}, {region} | Grid** — e.g. Cuckoo Grove Farm: 6.1 MW solar farm, South Wales | Grid (56) |
| Meta description | see REPORT.md | {Name} is a {capacity} MW {technology} site in {region}, operated by {operator}. Status, location, capacity basis and source records from DESNZ REPD. — e.g. Cuckoo Grove Farm is a 6.1 MW solar PV site in South Wales, operated by Foresight. Status, location, capacity basis and source records from DESNZ REPD. (151) |
| H1 (one only) | — | {Name} |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> {Name} is an {status} {capacity} MW {technology} site in {region}, operated by {operator} according to {source} ({edition}). Source: DESNZ REPD, Open Government Licence v3.0.

Replace 'Details below come from the sources listed for each field.' with this sentence. Title rule: if >60 chars, drop the region first, then truncate the name with '…'.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/assets/{id}/{slug}#webpage",
   "url": "https://grid.vahaah.com/assets/{id}/{slug}",
   "name": "{Name}: {capacity} MW {technology}, {region} | Grid",
   "description": "{Name} is a {capacity} MW {technology} site in {region}, operated by {operator}. Status, location, capacity basis and source records from DESNZ REPD.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/assets/{id}/{slug}#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/assets/{id}/{slug}#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Assets",
     "item": "https://grid.vahaah.com/assets"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "{Name}",
     "item": "https://grid.vahaah.com{path}"
    }
   ]
  },
  {
   "@type": "Place",
   "@id": "https://grid.vahaah.com/assets/{id}/{slug}#place",
   "name": "{Name}",
   "additionalType": "https://en.wikipedia.org/wiki/Power_station",
   "geo": {
    "@type": "GeoCoordinates",
    "latitude": "{lat}",
    "longitude": "{lon}"
   },
   "address": {
    "@type": "PostalAddress",
    "addressRegion": "{region}",
    "addressCountry": "GB"
   },
   "additionalProperty": [
    {
     "@type": "PropertyValue",
     "name": "Capacity",
     "value": "{capacity}",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Technology",
     "value": "{technology}"
    },
    {
     "@type": "PropertyValue",
     "name": "Status",
     "value": "{status}"
    },
    {
     "@type": "PropertyValue",
     "name": "REPD reference",
     "value": "{repd_ref}"
    }
   ],
   "isBasedOn": {
    "@type": "Dataset",
    "name": "DESNZ Renewable Energy Planning Database",
    "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
    "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
   }
  }
 ]
}
```

**Links in:** /assets, /map, /projects/{related}.  
**Links out:** /assets, /map?asset={id}, related project page, /data-sources#repd.

**AEO notes:** 16k+ thin pages are a crawl-budget risk. Keep them indexable only if they carry the sentence above and at least capacity + location + status; noindex assets with no capacity and no location.

### 3.10 `/projects`

| Field | Current | New |
|---|---|---|
| Title | Energy projects in Britain | Grid (33) | **GB energy projects: planning and construction status | Grid** (59) |
| Meta description | see REPORT.md | Track 16,085 GB energy projects through planning, construction and grid connection, from DESNZ REPD and the NESO TEC register, with each source dated. (150) |
| H1 (one only) | — | What is being built, and how far has it got? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid tracks {n_projects} energy projects in Great Britain. {op_mw} MW of rated power is operating, from DESNZ REPD ({repd_edition}) and the NESO TEC register ({tec_date}). Sources: DESNZ (OGL v3.0); Supported by National Energy SO Open Data.

Format numbers with separators and sensible units: '57,440 MW' or '57.4 GW', not '57440.4 MW'. The 'Connection capacity 689908.6 MW' headline double-counts by NESO's own note; demote it below the fold or label it 'TEC register total, may include duplicates' in the headline itself.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/projects#webpage",
   "url": "https://grid.vahaah.com/projects",
   "name": "GB energy projects: planning and construction status | Grid",
   "description": "Track 16,085 GB energy projects through planning, construction and grid connection, from DESNZ REPD and the NESO TEC register, with each source dated.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/projects#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/projects#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/projects#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Projects",
     "item": "https://grid.vahaah.com/projects"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/projects#dataset",
   "name": "GB energy projects: planning, construction and connection status",
   "description": "Projects from DESNZ REPD and the NESO TEC register, with planning, construction and connection status kept separate.",
   "url": "https://grid.vahaah.com/projects",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Rated power",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Connection capacity",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Planning status",
     "unitText": "category"
    },
    {
     "@type": "PropertyValue",
     "name": "Construction status",
     "unitText": "category"
    }
   ],
   "temporalCoverage": "{REPD_EDITION_DATE}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "DESNZ Renewable Energy Planning Database",
     "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    },
    {
     "@type": "Dataset",
     "name": "NESO Transmission Entry Capacity register",
     "url": "https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register",
     "creditText": "Supported by National Energy SO Open Data"
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/projects"
    }
   ]
  }
 ]
}
```

**Links in:** /, /pipeline, /changes, /tools, /assets/*.  
**Links out:** /pipeline, /changes, each project page, /map, /api#projects.

**AEO notes:** Title is 58 chars; fine. Same pagination/filter canonical rules as /assets.

### 3.11 `/projects/{id}/{slug}`

Template page; example audited: `/projects/epj_000824bd5aa1f616/perham-down-meadow-solar-farm-and-battery-storag`.

| Field | Current | New |
|---|---|---|
| Title | Perham Down - Meadow Solar Farm & Battery Storage | Grid (56) | **{Name}: {stage} | Grid** — e.g. Perham Down Meadow Solar Farm: consented | Grid (47) |
| Meta description | see REPORT.md | {Name}, a {capacity} MW {technology} project in {region}: planning {planning_status} on {date}, construction {construction_status}. Source: DESNZ REPD. — e.g. Perham Down - Meadow Solar Farm & Battery Storage: a 49.9 MW solar PV project in South East England. Planning granted 18 Nov 2022; not yet built. (145) |
| H1 (one only) | — | Where is {Name} up to? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> {Name} is a {capacity} MW {technology} project in {region}. Planning was {planning_status} on {date}; construction is {construction_status}, according to DESNZ REPD ({edition}). Source: DESNZ REPD, Open Government Licence v3.0.

Replace 'Each status below comes from a named source and date.' with this sentence. 'Connection: Unknown, Unknown, Unknown' should read 'No connection record published'.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/projects/{id}/{slug}#webpage",
   "url": "https://grid.vahaah.com/projects/{id}/{slug}",
   "name": "{Name}: {stage} | Grid",
   "description": "{Name}, a {capacity} MW {technology} project in {region}: planning {planning_status} on {date}, construction {construction_status}. Source: DESNZ REPD.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/projects/{id}/{slug}#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/projects/{id}/{slug}#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Projects",
     "item": "https://grid.vahaah.com/projects"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "{Name}",
     "item": "https://grid.vahaah.com{path}"
    }
   ]
  },
  {
   "@type": "Thing",
   "@id": "https://grid.vahaah.com/projects/{id}/{slug}#project",
   "name": "{Name}",
   "description": "{capacity} MW {technology} project in {region}",
   "additionalProperty": [
    {
     "@type": "PropertyValue",
     "name": "Planning status",
     "value": "{planning_status}",
     "validFrom": "{planning_date}"
    },
    {
     "@type": "PropertyValue",
     "name": "Construction status",
     "value": "{construction_status}"
    },
    {
     "@type": "PropertyValue",
     "name": "Rated power",
     "value": "{capacity}",
     "unitText": "MW"
    }
   ],
   "isBasedOn": {
    "@type": "Dataset",
    "name": "DESNZ Renewable Energy Planning Database",
    "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
    "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
   }
  }
 ]
}
```

**Links in:** /projects, /changes, /pipeline, asset pages.  
**Links out:** /projects, /pipeline, related asset, /changes?entity={id}.

**AEO notes:** Same thin-page rule as asset pages.

### 3.12 `/pipeline`

| Field | Current | New |
|---|---|---|
| Title | GB renewable and storage project pipeline | Grid (48) | **GB renewable and storage pipeline by stage | Grid** (49) |
| Meta description | see REPORT.md | How many renewable and storage projects are under construction, consented or in planning in Great Britain, by technology and nation. From DESNZ REPD. (149) |
| H1 (one only) | — | What's in GB's pipeline of new energy projects? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> As of DESNZ REPD {edition} (published {D Mon YYYY}), {n} renewable and storage projects totalling {gw} GW were in Great Britain's pipeline: {uc_gw} GW under construction, {cons_gw} GW consented and {plan_gw} GW in planning. Source: DESNZ REPD, Open Government Licence v3.0.

New lead sentence. Reconcile with the home 'Pipeline' card first (see §4: home says 283.9 GW / 10,126 projects, /pipeline says 267.4 GW / 7,668).

**Visible FAQ:**

- *How many battery projects are in the pipeline?* — {n_batt} projects, {gw_batt} GW, REPD {edition}.
- *How long do projects spend in planning?* — Median {d} days in planning, from the 'Median time' table.
- *What happened to projects submitted 2015–2020?* — {pct_op}% are operating, {pct_ref}% refused, …
- *Does consent mean a project will be built?* — No; link the 2015–2020 outcome table.

Add a visible Questions block (content already on the page, just phrase it as Q&A), then FAQPage.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/pipeline#webpage",
   "url": "https://grid.vahaah.com/pipeline",
   "name": "GB renewable and storage pipeline by stage | Grid",
   "description": "How many renewable and storage projects are under construction, consented or in planning in Great Britain, by technology and nation. From DESNZ REPD.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/pipeline#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/pipeline#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/pipeline#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Pipeline",
     "item": "https://grid.vahaah.com/pipeline"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/pipeline#dataset",
   "name": "GB renewable and storage project pipeline",
   "description": "Renewable and storage projects in England, Scotland and Wales under construction, consented or in planning, by technology and nation.",
   "url": "https://grid.vahaah.com/pipeline",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Rated capacity",
     "unitText": "GW"
    },
    {
     "@type": "PropertyValue",
     "name": "Project count",
     "unitText": "count"
    },
    {
     "@type": "PropertyValue",
     "name": "Median time in stage",
     "unitText": "days"
    }
   ],
   "temporalCoverage": "{REPD_EDITION_DATE}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "DESNZ Renewable Energy Planning Database",
     "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/projects?display_stage=pipeline"
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/pipeline#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "How many battery projects are in the pipeline?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "{n_batt} projects, {gw_batt} GW, REPD {edition}."
     }
    },
    {
     "@type": "Question",
     "name": "How long do projects spend in planning?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Median {d} days in planning, from the 'Median time' table."
     }
    },
    {
     "@type": "Question",
     "name": "What happened to projects submitted 2015–2020?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "{pct_op}% are operating, {pct_ref}% refused, …"
     }
    },
    {
     "@type": "Question",
     "name": "Does consent mean a project will be built?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "No; link the 2015–2020 outcome table."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /, /projects, /system/storage.  
**Links out:** /projects?stage=…, /system/storage, /map, /api#projects, CSV download.

**AEO notes:** The 2015–2020 outcome stat ('34% operating') is the most shareable number here; give it its own `<h2 id="outcomes">`.

### 3.13 `/system/constraints`

| Field | Current | New |
|---|---|---|
| Title | Grid constraints and their cost | Grid (38) | **GB grid constraint costs and volumes | Grid** (43) |
| Meta description | see REPORT.md | What NESO spent managing transmission constraints in Great Britain, by day and category (thermal, voltage, inertia), in £ and MWh, from NESO open data. (151) |
| H1 (one only) | — | What stops electricity reaching demand, and what was done about it? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> On {D Mon YYYY}, the latest settlement date NESO has published, constraint actions cost £{cost} for {mwh} MWh; {top_cat} was {top_pct}% of the cost. NESO publishes this with a lag of about {lag} days. Source: Supported by National Energy SO Open Data.

New lead with an explicit lag statement; on 23 Oct the latest date shown was 11 Oct (12 days). Confirm NESO's actual publication lag before stating {lag}.

No FAQ yet; add later ('How much do grid constraints cost?') with a financial-year total.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/system/constraints#webpage",
   "url": "https://grid.vahaah.com/system/constraints",
   "name": "GB grid constraint costs and volumes | Grid",
   "description": "What NESO spent managing transmission constraints in Great Britain, by day and category (thermal, voltage, inertia), in £ and MWh, from NESO open data.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/system/constraints#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/system/constraints#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/system/constraints#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "System",
     "item": "https://grid.vahaah.com/system/constraints"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Constraints",
     "item": "https://grid.vahaah.com/system/constraints"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/system/constraints#dataset",
   "name": "GB transmission constraint costs and volumes",
   "description": "Published daily cost (£) and volume (MWh) of NESO actions to manage transmission constraints, by category.",
   "url": "https://grid.vahaah.com/system/constraints",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Constraint cost",
     "unitText": "GBP"
    },
    {
     "@type": "PropertyValue",
     "name": "Constraint volume",
     "unitText": "MWh"
    }
   ],
   "temporalCoverage": "2026-04-01/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/constraints"
    }
   ]
  }
 ]
}
```

**Links in:** /, /system/*, /map.  
**Links out:** /system/storage, /map, /api#constraints, /data-health#constraints.

**AEO notes:** Add a financial-year-to-date total sentence; it is the number people quote.

### 3.14 `/system/storage`

| Field | Current | New |
|---|---|---|
| Title | Electricity storage in Britain | Grid (37) | **GB electricity storage: batteries and pumped hydro | Grid** (57) |
| Meta description | see REPORT.md | How much battery and pumped-hydro storage Great Britain has, what is operating and what pumped storage is doing, from DESNZ REPD, DUKES and Elexon. (147) |
| H1 (one only) | — | How much electricity storage is there, and what is it doing? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Great Britain has {mw} MW of operating electricity storage in the registers: {batt_mw} MW of batteries and {ps_mw} MW of pumped storage (DESNZ REPD {edition}, DUKES). At {HH:MM} {BST|GMT} pumped storage was {discharging|charging} {ps_now} MW (Elexon BMRS).

New lead. Format '7846.3 MW' as '7,846 MW'. Storage-charging series was stale on 23 Oct (defect 3); omit the second sentence when stale.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/system/storage#webpage",
   "url": "https://grid.vahaah.com/system/storage",
   "name": "GB electricity storage: batteries and pumped hydro | Grid",
   "description": "How much battery and pumped-hydro storage Great Britain has, what is operating and what pumped storage is doing, from DESNZ REPD, DUKES and Elexon.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/system/storage#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/system/storage#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/system/storage#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "System",
     "item": "https://grid.vahaah.com/system/storage"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Storage",
     "item": "https://grid.vahaah.com/system/storage"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/system/storage#dataset",
   "name": "GB electricity storage capacity and pumped-storage operation",
   "description": "Operating battery and pumped-storage capacity from REPD and DUKES, and half-hourly pumped-storage output from Elexon FUELINST.",
   "url": "https://grid.vahaah.com/system/storage",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Rated capacity",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Pumped storage output",
     "unitText": "MW"
    }
   ],
   "temporalCoverage": "{REPD_EDITION_DATE}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "DESNZ Renewable Energy Planning Database",
     "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    },
    {
     "@type": "Dataset",
     "name": "DESNZ Digest of UK Energy Statistics (DUKES)",
     "url": "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    },
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    }
   ]
  }
 ]
}
```

**Links in:** /, /pipeline, /projects.  
**Links out:** /pipeline?technology=battery, /assets?technology=pumped-storage, /today, /data-sources.

**AEO notes:** Notably the only page that answers 'how much battery storage does the UK have'. Say 'Great Britain' not 'UK' in the sentence (NI excluded).

### 3.15 `/system/whole-energy`

| Field | Current | New |
|---|---|---|
| Title | How Britain's energy fits together | Grid (41) | **UK energy balance 2025: gas, power, oil and heat | Grid** (55) |
| Meta description | see REPORT.md | How the UK used energy in 2025: natural gas, electricity, oil, heat and transport in TWh, from DESNZ DUKES 2026 table 1.1. Annual figures, not today's. (151) |
| H1 (one only) | — | How do electricity, gas, oil, heat and transport fit together? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> In 2025, natural gas was {gas_pct}% of the UK's primary energy supply ({gas_twh} TWh), and electricity was {elec_pct}% of final consumption ({elec_twh} TWh). Source: DESNZ DUKES 2026 table 1.1 and Energy flow chart 2025, Open Government Licence v3.0.

New lead. Values are annual, so they can be literal once checked (copy shows 671.4 TWh / 35% and 275.5 TWh / 18%; I have not checked them against DUKES).

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/system/whole-energy#webpage",
   "url": "https://grid.vahaah.com/system/whole-energy",
   "name": "UK energy balance 2025: gas, power, oil and heat | Grid",
   "description": "How the UK used energy in 2025: natural gas, electricity, oil, heat and transport in TWh, from DESNZ DUKES 2026 table 1.1. Annual figures, not today's.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/system/whole-energy#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/system/whole-energy#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/system/whole-energy#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "System",
     "item": "https://grid.vahaah.com/system/whole-energy"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Whole energy",
     "item": "https://grid.vahaah.com/system/whole-energy"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/system/whole-energy#dataset",
   "name": "UK energy balance 2025",
   "description": "Annual UK energy balance in TWh by fuel and flow, from DUKES 2026 table 1.1.",
   "url": "https://grid.vahaah.com/system/whole-energy",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Energy",
     "unitText": "TWh"
    }
   ],
   "temporalCoverage": "2025",
   "spatialCoverage": {
    "@type": "Place",
    "name": "United Kingdom"
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "DESNZ Digest of UK Energy Statistics (DUKES)",
     "url": "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    }
   ]
  }
 ]
}
```

**Links in:** /gas, /today, /methodology.  
**Links out:** /gas, /today, /prices/gas, DESNZ DUKES page.

**AEO notes:** Scope is UK (DUKES), unlike the rest of Grid (GB). Keep 'UK' here and say so once.

### 3.16 `/electricity/northern-ireland`

| Field | Current | New |
|---|---|---|
| Title | Northern Ireland electricity (outside GB) | Grid (48) | **Northern Ireland electricity: demand, wind, mix | Grid** (54) |
| Meta description | see REPORT.md | Northern Ireland and all-island electricity: demand, generation, wind, solar, Moyle flows and fuel mix from SONI and EirGrid, kept apart from GB figures. (153) |
| H1 (one only) | — | What's powering Northern Ireland? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> At {HH:MM} {BST|GMT} on {D Mon YYYY}, Northern Ireland's demand was {demand} MW and wind supplied {wind} MW; Moyle carried {moyle} MW {to|from} GB. Source: SONI via EirGrid Group (EirGrid Group Open Data Licence). Not included in Grid's GB totals.

Fix first: the tables show rows for 22:00–23:45 BST (future) with dashes (defect 2), NI data stale since 10:15 (defect 1), '1102MW' needs '1,102 MW', and the fuel mix shows unitless '6578.39'. Don't ship the summary until the latest reading's time is real.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/electricity/northern-ireland#webpage",
   "url": "https://grid.vahaah.com/electricity/northern-ireland",
   "name": "Northern Ireland electricity: demand, wind, mix | Grid",
   "description": "Northern Ireland and all-island electricity: demand, generation, wind, solar, Moyle flows and fuel mix from SONI and EirGrid, kept apart from GB figures.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/electricity/northern-ireland#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/electricity/northern-ireland#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/electricity/northern-ireland#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "System",
     "item": "https://grid.vahaah.com/electricity/northern-ireland"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Northern Ireland",
     "item": "https://grid.vahaah.com/electricity/northern-ireland"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/electricity/northern-ireland#dataset",
   "name": "Northern Ireland and all-island electricity",
   "description": "Quarter-hourly Northern Ireland and all-island demand, generation, wind, solar, interconnector flows and fuel mix from SONI and EirGrid.",
   "url": "https://grid.vahaah.com/electricity/northern-ireland",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Demand",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Generation",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Wind",
     "unitText": "MW"
    },
    {
     "@type": "PropertyValue",
     "name": "Moyle flow",
     "unitText": "MW"
    }
   ],
   "temporalCoverage": "{ISO_8601_LATEST}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Northern Ireland"
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "EirGrid Group Smart Grid Dashboard (SONI, SEMO)",
     "url": "https://www.smartgriddashboard.com/",
     "creditText": "Data EirGrid Group Open Data Licence."
    }
   ]
  }
 ]
}
```

**Links in:** /, /map (Moyle), /today (imports).  
**Links out:** / (GB), /map, /data-health#ni, /data-sources#eirgrid.

**AEO notes:** spatialCoverage is Northern Ireland, not GB. If the data stays stale, add `<meta name="robots" content="noindex">` until it is fixed, rather than letting crawlers cache future-dated empty rows.

### 3.17 `/directory`

| Field | Current | New |
|---|---|---|
| Title | Energy organisations and codes | Grid (37) | **GB electricity market organisations and codes | Grid** (52) |
| Meta description | see REPORT.md | Find who is behind a GB electricity market name or code: organisations, MPIDs and their roles with dates, from Elexon Industry Standing Data. (141) |
| H1 (one only) | — | Who is behind this name or code? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Search {n_orgs} organisations in Elexon Industry Standing Data by name to see their Market Participant IDs and roles on any date. Source: Elexon ISD Data Store.

Template {n_orgs} only if Grid can count it without redistributing ISD; otherwise drop the count.

**Visible FAQ:**

- *What is an MPID?* — Market Participant ID, identifies an organisation in electricity settlement. It is not a meter number (MPAN).
- *Can I download the data?* — No; Elexon has not identified ISD as open data.

The MPID/MPAN explanation is already visible; phrase it as Q&A and add FAQPage.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/directory#webpage",
   "url": "https://grid.vahaah.com/directory",
   "name": "GB electricity market organisations and codes | Grid",
   "description": "Find who is behind a GB electricity market name or code: organisations, MPIDs and their roles with dates, from Elexon Industry Standing Data.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/directory#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/directory#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Directory",
     "item": "https://grid.vahaah.com/directory"
    }
   ]
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/directory#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "What is an MPID?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Market Participant ID, identifies an organisation in electricity settlement. It is not a meter number (MPAN)."
     }
    },
    {
     "@type": "Question",
     "name": "Can I download the data?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "No; Elexon has not identified ISD as open data."
     }
    }
   ]
  }
 ]
}
```

**Links in:** /tools, /directory/identifiers.  
**Links out:** /directory/identifiers, /tools, Elexon ISD.

**AEO notes:** Fix the HTTP 400 on load (defect 4). No Dataset/DataDownload (no redistribution licence).

### 3.18 `/directory/identifiers`

| Field | Current | New |
|---|---|---|
| Title | Look up an MPID or industry code | Grid (39) | **MPID, BM Unit ID and GSP group lookup | Grid** (44) |
| Meta description | see REPORT.md | Which organisation held an MPID, BM Unit ID or GSP group code on a given date in the GB electricity market. Free lookup of Elexon standing data. (144) |
| H1 (one only) | — | Which organisation does this code belong to, and when? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Enter an MPID, BM Unit ID or GSP group code and a date to see which organisation held it then, from Elexon Industry Standing Data. Source: Elexon ISD Data Store.

Static sentence. Fix the scheme `<select>` not changing results, and the 400 on load.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/directory/identifiers#webpage",
   "url": "https://grid.vahaah.com/directory/identifiers",
   "name": "MPID, BM Unit ID and GSP group lookup | Grid",
   "description": "Which organisation held an MPID, BM Unit ID or GSP group code on a given date in the GB electricity market. Free lookup of Elexon standing data.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/directory/identifiers#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/directory/identifiers#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Directory",
     "item": "https://grid.vahaah.com/directory"
    },
    {
     "@type": "ListItem",
     "position": 3,
     "name": "Codes",
     "item": "https://grid.vahaah.com/directory/identifiers"
    }
   ]
  }
 ]
}
```

**Links in:** /directory, /tools, /api#identifiers.  
**Links out:** /directory, /api#identifiers.

**AEO notes:** Code-shaped queries ('who owns MPID XXXX') are long-tail; the API docs page is the better AEO target.

### 3.19 `/tools`

| Field | Current | New |
|---|---|---|
| Title | Energy tools and official services | Grid (41) | **GB energy tools and official services | Grid** (44) |
| Meta description | see REPORT.md | Where to go for GB energy tasks: understand a bill, find your network operator, report a power cut or gas leak, check a grid connection or look up a code. (154) |
| H1 (one only) | — | Where do I go to do this? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid lists {n} official energy services in Great Britain by task, each verified on {D Mon YYYY}; gas emergencies: call 0800 111 999.

New lead. The emergency number is the most-needed fact on the page; keep it in the first sentence.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/tools#webpage",
   "url": "https://grid.vahaah.com/tools",
   "name": "GB energy tools and official services | Grid",
   "description": "Where to go for GB energy tasks: understand a bill, find your network operator, report a power cut or gas leak, check a grid connection or look up a code.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/tools#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/tools#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Tools",
     "item": "https://grid.vahaah.com/tools"
    }
   ]
  },
  {
   "@type": "ItemList",
   "@id": "https://grid.vahaah.com/tools#list",
   "name": "Official energy services by task",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Energy price cap unit rates and standing charges (Ofgem)",
     "url": "https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "…one ListItem per card, in page order"
    }
   ]
  }
 ]
}
```

**Links in:** /, footer.  
**Links out:** /explained/price-cap, /map, /projects, /directory, /api, the external services.

**AEO notes:** Mark external links rel="noopener" only (not nofollow); these are trusted citations.

### 3.20 `/changes`

| Field | Current | New |
|---|---|---|
| Title | What changed in Britain's energy system | Grid (46) | **Changes in GB energy project registers | Grid** (45) |
| Meta description | see REPORT.md | Status changes found in published GB energy data, such as projects moving into construction or operation, each with its source snapshot and date. (145) |
| H1 (one only) | — | What has changed, and how do we know? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Since {D Mon YYYY}, Grid has found {n} changes in published data, most recently {project} moving from {from} to {to} in the NESO TEC register ({D Mon YYYY}). Source: Supported by National Energy SO Open Data.

Flag: every item says 'Compared …13:58:33.755Z with …13:58:33.755Z' (the same snapshot twice) and a project going 'Not started → Built' in one step. Either the comparison base is wrong or the copy is; fix before indexing.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "CollectionPage",
   "@id": "https://grid.vahaah.com/changes#webpage",
   "url": "https://grid.vahaah.com/changes",
   "name": "Changes in GB energy project registers | Grid",
   "description": "Status changes found in published GB energy data, such as projects moving into construction or operation, each with its source snapshot and date.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/changes#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/changes#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/changes#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Changes",
     "item": "https://grid.vahaah.com/changes"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/changes#dataset",
   "name": "Changes found in published GB energy data",
   "description": "Status changes detected between snapshots of the NESO TEC register and DESNZ REPD, each with its evidence.",
   "url": "https://grid.vahaah.com/changes",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Construction status",
     "unitText": "category"
    },
    {
     "@type": "PropertyValue",
     "name": "Operational status",
     "unitText": "category"
    }
   ],
   "temporalCoverage": "{FIRST_CHANGE_DATE}/..",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "NESO Transmission Entry Capacity register",
     "url": "https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register",
     "creditText": "Supported by National Energy SO Open Data"
    },
    {
     "@type": "Dataset",
     "name": "DESNZ Renewable Energy Planning Database",
     "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
     "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
     "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/changes"
    }
   ]
  }
 ]
}
```

**Links in:** /projects, project pages.  
**Links out:** each project page, /projects, /api#changes.

**AEO notes:** Use human dates in copy ('15 Oct 2026, 14:35 BST'), ISO only in `<time datetime>`.

### 3.21 `/methodology`

| Field | Current | New |
|---|---|---|
| Title | How Grid's numbers are made: sources and method (47) | **Methodology: sources, checks and records | Grid** (47) |
| Meta description | see REPORT.md | How Grid compiles GB electricity and gas figures: every source, licence, refresh cadence, definition and data check, and how records are compared. (146) |
| H1 (one only) | — | How Grid's numbers are made |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid compiles half-hourly Great Britain electricity figures from Elexon BMRS, NESO, the Carbon Intensity API and Sheffield Solar PV_Live, and gas and oil prices from National Gas, EIA and the World Bank. Electricity and physical gas refresh hourly; prices every 6 hours. Coverage starts 18 Mar 2025.

Exists (lightly reworded). Keep cadence consistent with /terms, which says 'half-hourly or slower cadence'; change /terms to 'published half-hourly or less often, and fetched by Grid hourly'.

**Visible FAQ:**

- *How often does Grid update?* — Hourly for GB electricity and physical gas; every 6 hours for commodity prices.
- *Where do the records come from?* — NESO historic generation mix from 2009.
- *Is the data free to reuse?* — Grid's derived data: CC BY 4.0; upstream licences apply (see /data-sources).

Already visible + FAQPage. Add the licence question if missing.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/methodology#webpage",
   "url": "https://grid.vahaah.com/methodology",
   "name": "Methodology: sources, checks and records | Grid",
   "description": "How Grid compiles GB electricity and gas figures: every source, licence, refresh cadence, definition and data check, and how records are compared.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/methodology#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/methodology#article"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/methodology#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Methodology",
     "item": "https://grid.vahaah.com/methodology"
    }
   ]
  },
  {
   "@type": "TechArticle",
   "@id": "https://grid.vahaah.com/methodology#article",
   "headline": "How Grid's numbers are made",
   "description": "How Grid compiles GB electricity and gas figures: every source, licence, refresh cadence, definition and data check, and how records are compared.",
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "dateModified": "{LAST_EDIT_ISO}",
   "inLanguage": "en-GB",
   "about": {
    "@id": "https://grid.vahaah.com/#dataset"
   },
   "proficiencyLevel": "Beginner"
  },
  {
   "@type": "FAQPage",
   "@id": "https://grid.vahaah.com/methodology#faq",
   "mainEntity": [
    {
     "@type": "Question",
     "name": "How often does Grid update?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Hourly for GB electricity and physical gas; every 6 hours for commodity prices."
     }
    },
    {
     "@type": "Question",
     "name": "Where do the records come from?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "NESO historic generation mix from 2009."
     }
    },
    {
     "@type": "Question",
     "name": "Is the data free to reuse?",
     "acceptedAnswer": {
      "@type": "Answer",
      "text": "Grid's derived data: CC BY 4.0; upstream licences apply (see /data-sources)."
     }
    }
   ]
  }
 ]
}
```

**Links in:** every page footer, /records, /today, /api.  
**Links out:** /data-sources, /data-health, /records, /api.

**AEO notes:** Add `id` anchors: #sources, #definitions, #data-checks, #records, #questions.

### 3.22 `/data-health`

| Field | Current | New |
|---|---|---|
| Title | Data health — Grid (18) | **Data health: freshness of every series | Grid** (45) |
| Meta description | see REPORT.md | When each source last published and when Grid fetched it, for every GB electricity, gas and price series, checked against its expected cadence. (143) |
| H1 (one only) | — | Data health |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> At {HH:MM} {BST|GMT} on {D Mon YYYY}, {n_ok} of {n_total} series were current and {n_stale} were stale. Source: each series' publisher; times are publication and retrieval.

New lead. Fix the 'Not yet available · Published — · Retrieved —' rows for completed gas days (defect 5).

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/data-health#webpage",
   "url": "https://grid.vahaah.com/data-health",
   "name": "Data health: freshness of every series | Grid",
   "description": "When each source last published and when Grid fetched it, for every GB electricity, gas and price series, checked against its expected cadence.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/data-health#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/data-health#dataset"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/data-health#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Data health",
     "item": "https://grid.vahaah.com/data-health"
    }
   ]
  },
  {
   "@type": "Dataset",
   "@id": "https://grid.vahaah.com/data-health#dataset",
   "name": "Grid data freshness by series",
   "description": "Source publication time and Grid retrieval time for each GB electricity, gas and price series.",
   "url": "https://grid.vahaah.com/data-health",
   "variableMeasured": [
    {
     "@type": "PropertyValue",
     "name": "Published time",
     "unitText": "ISO 8601"
    },
    {
     "@type": "PropertyValue",
     "name": "Retrieved time",
     "unitText": "ISO 8601"
    }
   ],
   "temporalCoverage": "{ISO_8601_LATEST}",
   "spatialCoverage": {
    "@type": "Place",
    "name": "Great Britain",
    "geo": {
     "@type": "GeoShape",
     "box": "49.8 -8.7 60.9 1.8"
    }
   },
   "license": "https://creativecommons.org/licenses/by/4.0/",
   "creditText": "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
   "creator": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "isBasedOn": [
    {
     "@type": "Dataset",
     "name": "Elexon BMRS / Insights",
     "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
     "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
    },
    {
     "@type": "Dataset",
     "name": "NESO Data Portal",
     "url": "https://www.neso.energy/data-portal",
     "creditText": "Supported by National Energy SO Open Data"
    },
    {
     "@type": "Dataset",
     "name": "NESO Carbon Intensity API",
     "url": "https://carbonintensity.org.uk/",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF."
    },
    {
     "@type": "Dataset",
     "name": "Sheffield Solar PV_Live",
     "url": "https://www.solar.sheffield.ac.uk/pvlive/",
     "creditText": "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO."
    },
    {
     "@type": "Dataset",
     "name": "National Gas Transmission Data Portal",
     "url": "https://data.nationalgas.com",
     "creditText": "Data sourced from the National Gas Transmission Data Portal."
    },
    {
     "@type": "Dataset",
     "name": "U.S. Energy Information Administration",
     "url": "https://www.eia.gov/",
     "creditText": "Source: U.S. Energy Information Administration."
    },
    {
     "@type": "Dataset",
     "name": "World Bank Commodity Price Data (The Pink Sheet)",
     "url": "https://www.worldbank.org/en/research/commodity-markets",
     "license": "https://creativecommons.org/licenses/by/4.0/",
     "creditText": "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0."
    }
   ],
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/data-health"
    }
   ]
  }
 ]
}
```

**Links in:** footer, /methodology, /gas, NI.  
**Links out:** /methodology, /data-sources, /api#data-health.

**AEO notes:** og:image is the generic /og; give it its own card. Low search value; index it (it builds trust for AI answers) but don't push it in llms.txt beyond one line.

### 3.23 `/data-sources`

| Field | Current | New |
|---|---|---|
| Title | Data sources — Grid (19) | **Data sources and licences | Grid** (32) |
| Meta description | see REPORT.md | Every source Grid republishes, with its licence and required attribution: Elexon BMRS, NESO, Carbon Intensity API, PV_Live, National Gas, EIA and more. (151) |
| H1 (one only) | — | Data sources |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid republishes data from {n} public sources, each under its own licence; Grid's derived data is CC BY 4.0, with the upstream attribution shown beside each figure.

Add the CC BY 4.0 statement for derived data (not on the page today). PV_Live licence line: see decision D3.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/data-sources#webpage",
   "url": "https://grid.vahaah.com/data-sources",
   "name": "Data sources and licences | Grid",
   "description": "Every source Grid republishes, with its licence and required attribution: Elexon BMRS, NESO, Carbon Intensity API, PV_Live, National Gas, EIA and more.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/data-sources#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/data-sources#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Data sources",
     "item": "https://grid.vahaah.com/data-sources"
    }
   ]
  },
  {
   "@type": "ItemList",
   "@id": "https://grid.vahaah.com/data-sources#list",
   "name": "Grid data sources",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "item": {
      "@type": "Dataset",
      "name": "Elexon BMRS / Insights",
      "url": "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
      "creditText": "Contains BMRS data © Elexon Limited copyright and database right 2026."
     }
    },
    {
     "@type": "ListItem",
     "position": 2,
     "item": {
      "@type": "Dataset",
      "name": "NESO Data Portal",
      "url": "https://www.neso.energy/data-portal",
      "creditText": "Supported by National Energy SO Open Data"
     }
    },
    {
     "@type": "ListItem",
     "position": 3,
     "item": {
      "@type": "Dataset",
      "name": "NESO Carbon Intensity API",
      "url": "https://carbonintensity.org.uk/",
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "creditText": "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF."
     }
    },
    {
     "@type": "ListItem",
     "position": 4,
     "item": {
      "@type": "Dataset",
      "name": "Sheffield Solar PV_Live",
      "url": "https://www.solar.sheffield.ac.uk/pvlive/",
      "creditText": "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO."
     }
    },
    {
     "@type": "ListItem",
     "position": 5,
     "item": {
      "@type": "Dataset",
      "name": "National Gas Transmission Data Portal",
      "url": "https://data.nationalgas.com",
      "creditText": "Data sourced from the National Gas Transmission Data Portal."
     }
    },
    {
     "@type": "ListItem",
     "position": 6,
     "item": {
      "@type": "Dataset",
      "name": "U.S. Energy Information Administration",
      "url": "https://www.eia.gov/",
      "creditText": "Source: U.S. Energy Information Administration."
     }
    },
    {
     "@type": "ListItem",
     "position": 7,
     "item": {
      "@type": "Dataset",
      "name": "World Bank Commodity Price Data (The Pink Sheet)",
      "url": "https://www.worldbank.org/en/research/commodity-markets",
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "creditText": "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0."
     }
    },
    {
     "@type": "ListItem",
     "position": 8,
     "item": {
      "@type": "Dataset",
      "name": "DESNZ Renewable Energy Planning Database",
      "url": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
      "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
     }
    },
    {
     "@type": "ListItem",
     "position": 9,
     "item": {
      "@type": "Dataset",
      "name": "DESNZ Digest of UK Energy Statistics (DUKES)",
      "url": "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes",
      "license": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      "creditText": "Contains public sector information licensed under the Open Government Licence v3.0."
     }
    },
    {
     "@type": "ListItem",
     "position": 10,
     "item": {
      "@type": "Dataset",
      "name": "EirGrid Group Smart Grid Dashboard (SONI, SEMO)",
      "url": "https://www.smartgriddashboard.com/",
      "creditText": "Data EirGrid Group Open Data Licence."
     }
    },
    {
     "@type": "ListItem",
     "position": 11,
     "item": {
      "@type": "Dataset",
      "name": "GeoNames",
      "url": "https://www.geonames.org/",
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "creditText": "Place coordinates from GeoNames, CC BY 4.0."
     }
    },
    {
     "@type": "ListItem",
     "position": 12,
     "item": {
      "@type": "Dataset",
      "name": "OS Open Zoomstack",
      "creditText": "Contains OS data © Crown copyright and database right 2026"
     }
    }
   ]
  }
 ]
}
```

**Links in:** footer, /methodology, /api.  
**Links out:** each upstream source, /methodology, /terms.

**AEO notes:** Give each source an anchor (#elexon, #neso, #carbon-intensity, #pv-live, #national-gas …) and link figure credits to them.

### 3.24 `/api`

| Field | Current | New |
|---|---|---|
| Title | Grid API: public energy data in JSON | Grid (43) | **Free GB electricity and gas data API (JSON) | Grid** (50) |
| Meta description | see REPORT.md | Free JSON API for GB electricity and gas data: no key, 60 requests a minute. Gas flows, projects, constraints, code lookups, changes and data health. (149) |
| H1 (one only) | — | What data can I get from Grid, and how? |

**Answer-first summary (first `<p>` in `<main>`, server-rendered):**

> Grid's API returns the figures on the dashboard as JSON, free and without an account, at up to 60 requests a minute. Electricity and physical gas refresh hourly; prices every 6 hours.

Exists. List /api/snapshots (cited in llms.txt) in the endpoint list; it is missing from the page.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/api#webpage",
   "url": "https://grid.vahaah.com/api",
   "name": "Free GB electricity and gas data API (JSON) | Grid",
   "description": "Free JSON API for GB electricity and gas data: no key, 60 requests a minute. Gas flows, projects, constraints, code lookups, changes and data health.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/api#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "mainEntity": {
    "@id": "https://grid.vahaah.com/api#api"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/api#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "API",
     "item": "https://grid.vahaah.com/api"
    }
   ]
  },
  {
   "@type": "WebAPI",
   "@id": "https://grid.vahaah.com/api#api",
   "name": "Grid API",
   "description": "Free JSON API for GB electricity and gas data. No key; 60 requests a minute.",
   "url": "https://grid.vahaah.com/api",
   "documentation": "https://grid.vahaah.com/api",
   "provider": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "isAccessibleForFree": true,
   "termsOfService": "https://grid.vahaah.com/terms",
   "license": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
   "@type": "TechArticle",
   "@id": "https://grid.vahaah.com/api#article",
   "headline": "What data can I get from Grid, and how?",
   "author": {
    "@id": "https://vahaah.com/#person"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "dateModified": "{LAST_EDIT_ISO}",
   "inLanguage": "en-GB",
   "about": {
    "@id": "https://grid.vahaah.com/api#api"
   }
  },
  {
   "@id": "https://grid.vahaah.com/#dataset",
   "distribution": [
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/snapshots?range=24h"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/gas/overview"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/projects"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/constraints"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/changes"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/data-health"
    },
    {
     "@type": "DataDownload",
     "encodingFormat": "application/json",
     "contentUrl": "https://grid.vahaah.com/api/v1/map/layers"
    }
   ]
  }
 ]
}
```

**Links in:** footer, /methodology, /data-sources, llms.txt.  
**Links out:** /methodology, /data-sources, /data-health, /terms.

**AEO notes:** Give every endpoint an anchor (#gas-overview, #projects …). robots.txt disallows /api/ (good for JSON), which does not affect /api itself.

### 3.25 `/privacy`

| Field | Current | New |
|---|---|---|
| Title | Privacy — Grid (14) | **Privacy | Grid** (14) |
| Meta description | see REPORT.md | What Grid collects: Vercel request logs, a one-minute API rate limiter and cookieless Plausible analytics. No accounts or cookies. Controller: Comonad Ltd. (155) |
| H1 (one only) | — | Privacy |

Static. No change to copy.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/privacy#webpage",
   "url": "https://grid.vahaah.com/privacy",
   "name": "Privacy | Grid",
   "description": "What Grid collects: Vercel request logs, a one-minute API rate limiter and cookieless Plausible analytics. No accounts or cookies. Controller: Comonad Ltd.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/privacy#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/privacy#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Privacy",
     "item": "https://grid.vahaah.com/privacy"
    }
   ]
  }
 ]
}
```

**Links in:** footer.  
**Links out:** /terms.

**AEO notes:** None.

### 3.26 `/terms`

| Field | Current | New |
|---|---|---|
| Title | Terms — Grid (12) | **Terms of use | Grid** (19) |
| Meta description | see REPORT.md | Grid is free and informational: figures may be late or wrong, there is no warranty and no financial advice. Code is MIT-licensed; data keeps its licences. (154) |
| H1 (one only) | — | Terms |

Change 'ingested on a half-hourly or slower cadence' to 'published half-hourly or less often and fetched by Grid hourly'.

No FAQ.

**JSON-LD** (one `<script type="application/ld+json">` per page; `{…}` are values filled at render):

```json
{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebPage",
   "@id": "https://grid.vahaah.com/terms#webpage",
   "url": "https://grid.vahaah.com/terms",
   "name": "Terms of use | Grid",
   "description": "Grid is free and informational: figures may be late or wrong, there is no warranty and no financial advice. Code is MIT-licensed; data keeps its licences.",
   "isPartOf": {
    "@id": "https://grid.vahaah.com/#website"
   },
   "inLanguage": "en-GB",
   "dateModified": "{ISO_8601_LAST_INGEST_UTC}",
   "breadcrumb": {
    "@id": "https://grid.vahaah.com/terms#breadcrumb"
   },
   "publisher": {
    "@id": "https://grid.vahaah.com/#app"
   },
   "author": {
    "@id": "https://vahaah.com/#person"
   }
  },
  {
   "@type": "BreadcrumbList",
   "@id": "https://grid.vahaah.com/terms#breadcrumb",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Grid",
     "item": "https://grid.vahaah.com/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Terms",
     "item": "https://grid.vahaah.com/terms"
    }
   ]
  }
 ]
}
```

**Links in:** footer.  
**Links out:** /privacy, /data-sources.

**AEO notes:** None.

## 4. Claims and records that are wrong, inconsistent or unverified

| # | Page | Claim (as on the site) | Finding | Action |
|---|---|---|---|---|
| C1 | /records | "Highest zero-carbon share since Grid's records began 90.2%, Thu 29 May 2025, 12:30 BST" next to "NESO official record: 98.8%, 22 Apr 2026, 15:30" | **Disagrees with NESO.** NESO's 98.8% (22 Apr 2026, 15:30–16:00) is transmission-network only ([NESO press release, 24 Apr 2026](https://www.neso.energy/britains-electricity-system-breaks-zero-carbon-record-gas-reaches-historic-low-and-solar-hits-historic-high)). Grid's series includes embedded generation, so the bases differ. A Grid "record" dated 11 months before a higher NESO record also invites confusion. | Hide the card under the same 2% rule as solar, or add a basis line: "Grid's share includes embedded wind and solar; NESO's record covers the transmission network only." (D1) |
| C2 | /records | Solar card hidden; "NESO's official record of 15.4 GW between 12:30 and 13:00 on 23 Apr 2026" | NESO's figure is correct ([press release](https://www.neso.energy/britains-electricity-system-breaks-zero-carbon-record-gas-reaches-historic-low-and-solar-hits-historic-high)). Grid's own peak was 16.3 GW on 10 Oct. A competitor (trydan.uk) still publishes 16.3 GW, so the doubled-row problem may affect others too. | Keep it hidden. Re-test once half-hourly history is reachable (see §1, P0-5). |
| C3 | /records | Wind 23.9 GW, 25 Mar 2026, 13:30 GMT; NESO 23,880 MW | **Matches** NESO ("23.9 GW … 25 March"). The GMT label is right, because BST began on 29 Mar 2026. | None. |
| C4 | /records | Lowest carbon 19 gCO₂/kWh, 15 Apr 2024, labelled "NESO historic mix", not an official record | Not an official NESO record, so it's correctly labelled. NESO's April 2026 summary gives a monthly low of 20 g, which is consistent. | None. Keep the "NESO historic mix" label. Don't call it "NESO official". |
| C5 | /records | "By 2026 … carbon intensity has fallen to 141 g" and "Wind has moved from 1% to 31%" | I couldn't verify these. 141 g looks high for a 2026 year-to-date average: NESO gives 93 g for April 2026, and /today shows a 7-day average of 103 g. It may be the NESO historic series with residual coal and doubled rows. | Recompute from clean half-hours, and label 2026 as "year to date". |
| C6 | / vs /pipeline | Home "Pipeline 283.9 GW, 10,126 projects; under construction 28.6 GW, 486" vs /pipeline "7,668 projects, 267.4 GW; under construction 27.9 GW, 452" | **The same source gives two different totals.** /pipeline excludes revised records and those with no application required; home apparently doesn't. | Use one definition. Home should read /pipeline's numbers and link to it. |
| C7 | /changes | "Compared …tec-register:2026-10-13T13:58:33.755Z with …2026-10-13T13:58:33.755Z" on every item; "Not started to Built" in one step | The base and target snapshot are the same, so the evidence string is wrong, or the diff is against an empty base, which turns every row into a "change". | Fix before indexing. Until then, set `noindex` on /changes. |
| C8 | /electricity/northern-ireland | Rows for "Fri 23 Oct 2026, 22:00–23:45 BST" at 13:00; NI stale since 10:15 | Future timestamps; the table contradicts the headline (audit defects 1 and 2). | P0 fix. Use `noindex` while it's broken. |
| C9 | / | Hero "At 11:00 BST…" with badge "Data as of 11:50 BST" and "11:00–11:30 settlement period · Stale" at 13:00 | The freshness story is inconsistent, and the figures were 2 hours behind. | One timestamp source for the hero, badge, og:image alt and llms.txt. |
| C10 | /today vs / | /today FAQ "wind was 46% (13.8 GW)"; home "13.9 GW (46%)" for the same half-hour | Rounding or a different series (with or without embedded generation). | Use the same value and series. |
| C11 | /terms vs /methodology | Terms say "ingested on a half-hourly or slower cadence"; methodology says "Ingest runs hourly" | Inconsistent cadence. **Cadence verified:** the copy says hourly everywhere else, the data-health "Retrieved" times are on the hour (13:00, 13:05), and there's no "every 5 minutes" claim anywhere. | Terms: "published half-hourly or less often and fetched by Grid hourly". |
| C12 | /explained/price-cap | £1,723 (1 Oct–31 Dec 2026, announced 26 Aug), £1,663, TDCV 2,500/9,500 kWh, £1,862 on the old TDCV, next cap 25 Nov 2026 | **Verified** against Ofgem ([unit rates page](https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges), [26 Aug press release](https://www.ofgem.gov.uk/press-release/energy-price-cap-will-rise-4-october-2026)). I didn't check the Jan–Mar 2026 (£1,758) and Apr–Jun 2026 (£1,641) rows this pass. | Check those two rows against Ofgem's levels page. |
| C13 | /explained/price-cap | "Secondary sources put the window for the January 2027 cap at 19 Aug to 17 Nov 2026" | Not from Ofgem, and the sources aren't named. | Name the source or drop the dates. |
| C14 | /data-sources, /methodology | PV_Live "Licence: Open access. UKERC records that PV Live data may be freely used for any purpose." | The brief says CC BY 4.0. UKERC's catalogue says "Open Access … freely used for any purpose", and [Sheffield's T&C page](https://api.solar.sheffield.ac.uk/tandc) doesn't state CC BY 4.0 in what I could read. Only secondary sites say CC BY 4.0. | D3: confirm with Sheffield Solar before writing "CC BY 4.0". |
| C15 | /gas | "It is not a direct live measure of household heating" | Contains the banned word, even though it's negated. | "It is not a direct measure of household heating." |
| C16 | /projects | "Connection capacity 689908.6 MW" as a headline | NESO itself says the aggregate may duplicate entries, so the headline overstates. | Demote it, or put the caveat in the label. |
| C17 | /records | "753 days" since coal ended | Correct for 23 Oct 2026 (30 Sep 2024 + 753 days). | Make sure it's computed at render, not at build. |
| C18 | /system/whole-energy | 2025: natural gas 671.4 TWh (35% of primary supply); final electricity 275.5 TWh | Not checked against DUKES 2026 table 1.1 this pass. | Spot-check before using it in the summary sentence. |
| C19 | /tools | Gas emergency number 0800 111 999; SSEN 105 | Standard UK numbers, consistent with the linked operator pages. Not re-fetched. | None. |
| C20 | /privacy | "Plausible … does not leave the EU" | Plausible's own claim, not verified here. | None for SEO. |

Not built on: Dutch TTF. The "EU natural gas" card is the World Bank monthly Europe series, and neither the copy nor the JSON-LD may call it TTF.

## 5. Internal-link matrix

Rows are the source page and columns the target. ● means the link exists in body copy (not just nav or footer); ○ means add it. Nav and footer, present on every page, already link Today, Gas, Map, Assets, System, Directory and tools, Changes, API, Records, Gas price, Price cap, Methodology, Data health, Tools, Privacy, Terms and Data sources. That covers crawl discovery, so the matrix is about **contextual** links with descriptive anchors.

| From ↓ / To → | / | /today | /records | /prices/gas | /explained/price-cap | /gas | /map | /pipeline | /projects | /system/storage | /methodology | /api |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | – | ○ "today so far" | ○ records card | ○ "Gas & oil" heading | ○ price block | ○ | ● "Open map" | ● "Pipeline" | | ○ storage row | ● | |
| /today | ● date link | – | ○ | ○ gas share | ○ | ○ | ○ imports | | | | ● | |
| /records | ● "Back to Grid" | ○ | – | | | | | | | | ○ #records | |
| /prices/gas | | ● | | – | ● | ○ | | | | | ● | |
| /explained/price-cap | | ● | | ● "UK gas price" | – | ○ | | | | | | |
| /gas | | ○ | | ○ | ○ | – | ○ terminals | | | | | ○ #gas |
| /map | | ○ | | | | ○ | – | | ○ | | | |
| /pipeline | | | | | | | ○ | – | ○ | ○ batteries | | ○ |
| /projects | | | | | | | ○ | ○ | – | | | ○ |
| /system/storage | | ○ | | | | | | ○ | | – | | |
| /methodology | | ○ | ○ | | | | | | | | – | ○ |
| /api | | | | | | | | | | | ● | – |
| asset and project detail | | | | | | | ● "View on map" | ○ | ● "All projects" | | | |

Anchor-text rule: say what the reader gets ("UK gas price today", "GB electricity records"), never "click here" and never "live". From vahaah.com, link "Grid, Britain's electricity today" → `/` and "Grid API" → `/api`.

## 6. Priority order

**P0 (this week)**
1. One `<h1>` on `/` and on `/map` (§3.1, §3.7).
2. NI page: fix the future-dated rows and stale ingest. Set `noindex` until it's fixed (C8).
3. One freshness timestamp across the home hero, badge, og:image alt and llms.txt (C9, C10).
4. `/changes` snapshot comparison bug. Set `noindex` until it's fixed (C7).
5. Zero-carbon record: hide it or add the basis note (C1, D1).
6. Restore a half-hourly history endpoint and re-run the sum and bounds check before any new record or "highest/lowest" claim (§1).
7. Title suffix convention on all 26 pages and `<html lang="en-GB">` (§2.1, §2.8).

**P1 (next 2 weeks; before 25 Nov for the first three)**
1. JSON-LD @graph on every page as specified in §3. Start with /today, /prices/gas, /explained/price-cap and /gas, which are the winter queries.
2. Prepare the price-cap swap for 25 Nov: new lead, title and dateModified within an hour of Ofgem publishing.
3. llms.txt replacement (§2.6), and remove `/llms.txt` from the sitemap.
4. Sitemap index with `<lastmod>` (§2.5).
5. Answer-first summary sentences on /gas, /map, /pipeline, /system/*, /data-health, /tools, /changes, and on asset and project detail pages.
6. `og:locale`, `twitter:image:alt`, and a sentence-style `og:image:alt` (§2.7); a dedicated og card for /data-health.
7. Reconcile the home pipeline numbers with /pipeline (C6). Fix number formatting ("7,846 MW", "1,102 MW") and the unitless NI fuel mix.
8. Copy fixes C11, C13, C15 and C16.

**P2 (November onwards)**
1. Visible FAQs plus FAQPage on /gas, /pipeline and /directory.
2. Fragment anchors for records, endpoints and sources.
3. Thin-page rule for the 19k detail pages, applied in the sitemap and `noindex`.
4. Dated /today archive URLs, and the `/week/…` report only after the sum check passes.
5. Fix the HTTP 400 on load for /directory pages and the "— · 0.0" map labels.
6. Monthly 15-question AI-citation test (the 10 Oct list), plus a re-run on 26 Nov.

## 7. Acceptance checks

1. **Google Rich Results Test** (https://search.google.com/test/rich-results) on `/`, `/today`, `/records`, `/explained/price-cap`, `/prices/gas`, `/gas`, `/api` and one asset and one project page. Pass means 0 errors. Dataset and Breadcrumb are detected; FAQ may show as "detected" without being rich-result eligible. **Google limits FAQ rich results to authoritative government and health sites, so FAQPage here is for machine understanding and AI answers, not for SERP snippets.** Use FAQPage only where the same Q&A is visible on the page.
2. **Schema.org validator** (https://validator.schema.org): 0 errors on all 26 pages. Every `@id` resolves within the graph, or is one of the three shared IDs.
3. **Crawl as GPTBot and a browser** (curl `-A` with each user agent, as in `reviews/crawl/crawl.py`). On each page: exactly one `<h1>`, one canonical without a query string, `<html lang="en-GB">`, title ≤60 ending in ` | Grid`, a description of 120–155 characters, the summary sentence with numbers in raw HTML, and byte-identical content for both user agents apart from timestamps.
4. **Banned words:** `grep -iE '\b(live|real-time|realtime|open[- ]source)\b'` over all raw HTML and llms.txt returns nothing, excluding "Liverpool", "PV_Live", "PV Live" and "deliver". Also grep for the banned names in the brief and for "TTF".
5. **Records:** every record card shows "since Grid's records began", has a NESO figure beside it, and is within 2% of NESO on the same basis or hidden.
6. **Sitemap:** every URL returns 200, has `<lastmod>`, no file exceeds 50,000 URLs, and llms.txt is not listed.
7. **Search Console:** after deploy, request indexing for /, /today, /prices/gas and /explained/price-cap. Check the Dataset and Breadcrumb enhancement reports a week later.
8. **AI citation test:** the 15 questions from the 10 Oct §7.6, asked in ChatGPT search, Perplexity and Google AI Mode. Record which URL is cited. Baseline on 10 Oct was 0/15.

## 8. Decisions for Alex

- **D1 Zero-carbon record:** hide Grid's 90.2% until it reconciles with NESO's 98.8% (recommended), or show it with a basis note?
- **D2 JSON crawling:** keep `/api/` disallowed but allow `/api/snapshots` so AI tools can fetch the citable JSON (recommended), or keep all JSON uncrawled?
- **D3 PV_Live licence:** your brief says CC BY 4.0, but Grid's page says "Open access" (UKERC), and I couldn't find CC BY 4.0 on Sheffield Solar's own terms. Keep "Open access" with the credit line until Sheffield confirms (recommended), or write CC BY 4.0 now?
- **D4 noindex while broken:** OK to `noindex` /electricity/northern-ireland and /changes until C7 and C8 are fixed?
- **D5 twitter:site:** is there an X handle for Grid or for you to put in `twitter:site` and `twitter:creator`? If not, leave them out.
- **D6 Detail pages:** index all 19k asset and project pages, or only those with capacity, location and status (recommended)?
