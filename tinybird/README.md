# Tinybird Setup

## 1. Create a Tinybird account

Sign up at [tinybird.co](https://www.tinybird.co) (free tier available).

## 2. Install the Tinybird CLI

```bash
pip install tinybird-cli
tb login
```

This opens a browser window to authenticate. Your credentials are saved in a `.tinyb` file.

## 3. Deploy data sources, pipes, and tokens

From the `tinybird/` directory:

```bash
cd tinybird
tb --cloud deploy
```

This deploys everything in one step:
- **Datasources**: `energy_snapshots`, `commodity_prices`
- **Pipes** (API endpoints): `latest_snapshot`, `snapshots_range`, `latest_prices`, `prices_range`
- **Tokens** (auto-generated from `TOKEN` directives in data files):
  - `dashboard_read` — read-only access to all pipe endpoints
  - `ingest_token` — append-only access to both datasources

> **Note:** Tinybird Forward requires resource-scoped tokens to be defined in `.pipe` and `.datasource` files. You cannot create them via `tb token create static` — they are created automatically during `tb --cloud deploy`.

## 4. Get your tokens

After deploying, list all tokens:

```bash
tb --cloud token ls
```

You'll see:
| Token | Purpose | Set as |
|-------|---------|--------|
| `Workspace admin token` | Full access (use for cron ingestion) | `TINYBIRD_TOKEN` |
| `dashboard_read` | Read-only for pipes (use for dashboard queries) | `TINYBIRD_READ_TOKEN` |
| `ingest_token` | Append-only for datasources (alternative to admin for writes) | — |

Copy the `dashboard_read` token value — that's your `TINYBIRD_READ_TOKEN`.

## 5. Set environment variables

```bash
cp .env.example .env.local
```

Fill in:
```
TINYBIRD_URL=https://api.eu-central-1.aws.tinybird.co  # or your region
TINYBIRD_TOKEN=p.eyJ...           # admin token (for cron ingestion)
TINYBIRD_READ_TOKEN=p.eyJ...      # dashboard_read token (for pipe queries)
```

## 6. Test

```bash
# Ingest a test row
curl -X POST "https://api.eu-central-1.aws.tinybird.co/v0/events?name=energy_snapshots&format=ndjson" \
  -H "Authorization: Bearer $TINYBIRD_TOKEN" \
  -d '{"timestamp":"2026-03-18 00:00:00","carbon_intensity":100,"carbon_forecast":95,"carbon_index":"moderate","demand_mw":28000,"price_gbp_mwh":50,"gen_gas_pct":18,"gen_coal_pct":0,"gen_nuclear_pct":15,"gen_wind_pct":34,"gen_solar_pct":0,"gen_hydro_pct":1,"gen_biomass_pct":10,"gen_imports_pct":22,"gen_other_pct":0,"gen_gas_mw":4800,"gen_coal_mw":0,"gen_nuclear_mw":4000,"gen_wind_mw":9000,"gen_solar_mw":0,"gen_hydro_mw":200,"gen_biomass_mw":2700,"gen_other_mw":0}'

# Query latest snapshot
curl "https://api.eu-central-1.aws.tinybird.co/v0/pipes/latest_snapshot.json" \
  -H "Authorization: Bearer $TINYBIRD_READ_TOKEN"
```

## Data Sources

### `energy_snapshots`
One row per hour. UK grid data combining Carbon Intensity API + Elexon BMRS.
- Engine: `ReplacingMergeTree` (dedup on same hour)
- Sorting key: `timestamp`
- Tokens: `ingest_token` (APPEND)

### `commodity_prices`
One row per commodity per day. Oil & gas from US EIA.
- Engine: `ReplacingMergeTree` (dedup on same date+commodity)
- Sorting key: `date, commodity`
- Tokens: `ingest_token` (APPEND)

## Pipes (API Endpoints)

All pipes have `TOKEN dashboard_read READ` for secure query access.

| Pipe | Description | Params |
|------|-------------|--------|
| `latest_snapshot` | Most recent grid snapshot | — |
| `snapshots_range` | Snapshots in time range | `start`, `end`, `granularity` (hour/day/week) |
| `latest_prices` | Latest price per commodity | — |
| `prices_range` | Price history in date range | `start`, `end`, `commodity` (optional) |
