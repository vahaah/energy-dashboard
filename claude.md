# Agent notes

Grid is the live GB electricity and gas dashboard at https://grid.vahaah.com.

Read [README.md](./README.md), [CONTRIBUTING.md](./CONTRIBUTING.md), and [AGENTS.md](./AGENTS.md). The data model is in [ARCHITECTURE.md](./ARCHITECTURE.md).

`/` stays `force-static` with `revalidate` 300 and does not import MapLibre. There is no database. Missing measurements are `null`. Attributions in `src/lib/attribution.ts` stay verbatim.

`OIL_PRICE_API_KEY` and `FRED_API_KEY` are unused. Do not wire those feeds back up.
