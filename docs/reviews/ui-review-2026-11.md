# Interface review, 24 November 2026

Reviewed against the Vercel Web Interface Guidelines snapshot shipped in `.agents/skills/web-design-guidelines/references/command.md` (upstream `vercel-labs/web-interface-guidelines` `434b7f91364665f2f733b310ec54809bf8f37937`), with a second pass from `.agents/skills/vercel-react-best-practices`. The UI SDK skill is installed as review tooling. Grid’s dialog, menu and combobox already follow that keyboard model, so this change does not add `@ui-sdk/react`. Adopting the beta components would also pull the WebMCP helpers, which this pull request does not touch.

Install commands, checked against the source repos on 24 November 2026:

- `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines` from [agent-skills README](https://github.com/vercel-labs/agent-skills) and [skills CLI](https://github.com/vercel-labs/skills). Non-interactive flags added here: `-a cursor -y`.
- `react-best-practices` is published as `vercel-react-best-practices` on that repo’s current tree (`skills/react-best-practices`). Installed with `npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices -a cursor -y`.
- `npx skills@latest add vercel-labs/ui --skill ui-sdk` from [ui-sdk.dev/docs](https://ui-sdk.dev/docs) and the [UI SDK README](https://github.com/vercel-labs/ui). Same non-interactive flags.

The skills CLI documents project scope as `./.agents/skills/`, “Committed with your project, shared with team”, plus `skills-lock.json`. Those files are in this change.

House style kept on purpose, and not listed as defects: sentence-case headings (the guidelines ask for Chicago Title Case), straight quotes in JSX, and “and” in full sentences. British English stays.

Tinybird impact of the fixes: **+0**. No new pipe. Directory lookups and map station reads retry at most twice and do not touch Tinybird. A dated dashboard read and every prices read time out after 8 seconds and are not retried, so a failure cannot multiply a Tinybird read. An undated dashboard read retries only the Redis peek.

## P0 — fixed

```text
src/components/seo-page.tsx:41 - skip link rendered only when skipHref was passed, and no page passed it
src/components/legal-page.tsx:26 - no skip link before the header
src/app/records/page.tsx:89 - no skip link before the header
```

The skip link now lives on `SiteTopBar`, so every page that uses the header gets one. The homepage still jumps to `#section-overview`. The map still jumps to `#flow-list`. Other pages jump to `#content`.

## P1 — fixed

```text
src/components/jump-to.tsx:9 - sticky top-16 sits under the two-row mobile header
src/components/dashboard.tsx:388 - scroll-mt-28 is shorter than the mobile header plus the jump bar
src/components/asset-search-dialog.tsx:149 - dialog does not inert the page, lock scroll, or contain overscroll
src/components/asset-search-dialog.tsx:219 - combobox has no name, autocomplete, or spellcheck
src/components/asset-search-dialog.tsx:282 - result count is not announced
src/components/site-header.tsx:41 - date input has no name or autocomplete
src/components/site-header.tsx:51 - Share / Copied is not a live region
src/components/share-button.tsx:28 - Share / Copied / Shared is not a live region
src/components/cite-button.tsx:17 - aria-label stays "Copy citation" after the visible label changes
src/components/copy-link-button.tsx:9 - Copied is not a live region
src/components/directory/code-search.tsx:40 - lookup fetch has no timeout or retry
src/components/directory/code-search.tsx:89 - code field has no name or spellcheck, and errors are not focused
src/components/directory/code-search.tsx:111 - example chips are 32px on a phone
src/components/directory/code-search.tsx:118 - pending label is "Searching" with no live region
src/components/directory/name-search.tsx:34 - same lookup fetch, name field, chips, and error focus
src/lib/dashboard-client.ts:13 - period fetch has no timeout
src/lib/dashboard-client.ts:23 - prices fetch has no timeout
src/components/flows-map.tsx:471 - station fetch has no timeout
src/components/flows-map.tsx:704 - credits summary is a © with no 44px target
src/components/flows-map.tsx:765 - the always-open mobile sheet uses role=dialog
src/components/flows-map.tsx:777 - Expand is shorter than 44px
src/components/flows-map.tsx:792 - About dialog does not move focus, trap Tab, or contain overscroll
src/components/flows-map.tsx:585 - view radios and layer checkboxes are under 44px and unnamed
src/components/gas/gas-board.tsx:65 - gas-day select is 32px tall on a phone
src/components/gas/gas-board.tsx:277 - basis buttons are 32px tall on a phone
src/components/gas/gas-board.tsx:344 - caption reads "million m³/day. as of …"
src/components/gas/gas-board.tsx:355 - Show table is 32px tall
src/components/whole-energy/sector-switch.tsx:44 - sector buttons are 32px tall on a phone
src/components/changes/changes-board.tsx:103 - filter chips are 32px tall on a phone
src/components/jump-to.tsx:21 - section select is 32px tall on a phone
src/components/power-cuts/view.tsx:251 - outward postcode has no name, autocomplete, or spellcheck, and the filters are 40px
src/components/projects/projects-board.tsx:264 - search has no name, autocomplete, or spellcheck
src/components/projects/projects-board.tsx:275 - "Loading projects" is not a live region and has no ellipsis
src/components/pipeline/pipeline-table.tsx:251 - same loading sentence
src/components/asset-directory.tsx:227 - search has no name, autocomplete, or spellcheck
src/components/map-explorer.tsx:140 - layer checkboxes are 16px with no name, and the filter search is unnamed
src/components/storage/storage-board.tsx:265 - type and status selects have no name
```

Phone controls that were already `min-h-11` below `sm` and `min-h-8` from `sm` were left on that pattern. The fixes above are the controls that stayed under 44px on a phone.

## P2 — later

```text
src/app/layout.tsx:46 - no theme-color meta for the browser chrome
src/app/globals.css:171 - no touch-action: manipulation, and no overscroll-behavior on html
src/components/homepage-briefing.tsx:42 - h1 has no text-wrap: pretty
src/components/seo-page.tsx:42 - page h1 has no text-wrap: pretty
src/components/dashboard.tsx:387 - empty-state action is 32px tall
src/components/site-public-nav.tsx:30 - footer links are 32px tall
src/components/site-legal-nav.tsx:19 - footer links are 32px tall
src/components/gas/gas-board.tsx:47 - coverage chips use py-0.5
src/components/whole-energy/sector-switch.tsx:24 - selected sector is useState, not the URL
src/components/changes/changes-board.tsx:25 - change-type filter is useState, not the URL
src/components/projects/projects-board.tsx:65 - stage, technology, and nation filters are useState, not the URL
src/components/storage/storage-board.tsx:245 - type and status filters are useState, not the URL
src/components/power-cuts/view.tsx:100 - outward code, operator, and kind are useState, not the URL
src/components/charts/carbon-intensity-chart.tsx:125 - chart has no text alternative beyond the tooltip; the card’s current figure is in the surrounding copy
src/components/charts/responsive-chart-frame.tsx:20 - same pattern on the other Recharts frames
```

Long registers are already paged. `content-visibility` and virtualisation are not required for the current page sizes.

## Checked, no change

Focus rings use `:focus-visible` in `globals.css`, and `outline-none` only sits next to a `focus-visible:ring`. `color-scheme` is set for light and dark. Chart animation is off. Map chevrons already stop under `prefers-reduced-motion`. The homepage stays `force-static` with `revalidate` 300 and does not import MapLibre. Zoom is not disabled. There is no paste blocking.
