# Contributing

Grid is the live dashboard at [grid.vahaah.com](https://grid.vahaah.com), published by Comonad Ltd.

## Setup

```bash
git clone https://github.com/vahaah/energy-dashboard.git
cd energy-dashboard
npm install
cp .env.example .env.local
npm run dev
```

Node.js 22.12 or newer. Environment variables are named in `.env.example`. You can read the site without Tinybird; cron ingest and live pipes need the tokens.

## Checks

```bash
npm run lint
npm run typecheck
npm run publish-check
npm test
npm run test:layout
```

`npm test` is Vitest. `npm run test:layout` is Playwright (Chromium) at 1280, 1024, 768 and 375, in light and dark. Layout CI shards that suite. The map project runs on its own, one worker.

## What to keep intact

- `/` stays `force-static` with `revalidate` 300. It does not import MapLibre.
- Do not add a database. Catalogue data lives in `data/catalogue/` and is checked by `npm run publish-check`.
- Do not add a Tinybird query on a request path that does not already have one. The scheduled success path stays within the daily cap.
- Data attributions stay verbatim. National Gas is `Data sourced from the National Gas Transmission Data Portal.` REPD, DUKES and other OGL sources keep `Contains public sector information licensed under the Open Government Licence v3.0.` The full list is on `/data-sources` and in `src/lib/attribution.ts`.
- Missing measurements are `null`, never `0`.
- British English in the interface and the docs.

## Secrets

Do not commit `.env`, `.env.local`, tokens, or credential files. `.gitignore` already excludes them. If a secret lands in a commit, rotate it and tell [alex@comonad.co.uk](mailto:alex@comonad.co.uk). Do not rewrite published history unless you were asked to.

## Pull requests

Open a PR against `main`. Describe what changed and how you checked it. Vercel deploys `main`.

Questions and vulnerability reports go to [alex@comonad.co.uk](mailto:alex@comonad.co.uk). Security reports should not be filed as public issues. See [SECURITY.md](./SECURITY.md).
