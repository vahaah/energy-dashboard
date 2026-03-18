# Tinybird Setup

## 1. Create a Tinybird account

Sign up at [tinybird.co](https://www.tinybird.co) (free tier: 10GB, 1000 req/day).

## 2. Install the Tinybird CLI

```bash
pip install tinybird-cli
tb auth  # paste your admin token
```

## 3. Push data sources and pipes

From the `tinybird/` directory:

```bash
cd tinybird
tb push datasources/energy_snapshots.datasource
tb push datasources/commodity_prices.datasource
tb push pipes/latest_snapshot.pipe
tb push pipes/snapshots_range.pipe
tb push pipes/latest_prices.pipe
tb push pipes/prices_range.pipe
```

Or push everything at once:

```bash
tb push --force
```

## 4. Create tokens

In the Tinybird UI, create two tokens:

- **Admin token** (read + write) — used by the cron job to ingest data. Set as `TINYBIRD_TOKEN`.
- **Read-only token** — scoped to the pipe endpoints only. Set as `TINYBIRD_READ_TOKEN`.

## 5. Test

```bash
# Ingest a test row
curl -X POST "https://api.eu-central-1.aws.tinybird.co/v0/events?name=energy_snapshots&format=ndjson" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"timestamp":"2026-03-18 00:00:00","carbon_intensity":100,"carbon_forecast":95,"carbon_index":"moderate","demand_mw":28000,"price_gbp_mwh":50,"gen_gas_pct":18,"gen_coal_pct":0,"gen_nuclear_pct":15,"gen_wind_pct":34,"gen_solar_pct":0,"gen_hydro_pct":1,"gen_biomass_pct":10,"gen_imports_pct":22,"gen_other_pct":0,"gen_gas_mw":4800,"gen_coal_mw":0,"gen_nuclear_mw":4000,"gen_wind_mw":9000,"gen_solar_mw":0,"gen_hydro_mw":200,"gen_biomass_mw":2700,"gen_other_mw":0}'

# Query latest
curl "https://api.eu-central-1.aws.tinybird.co/v0/pipes/latest_snapshot.json" \
  -H "Authorization: Bearer YOUR_READ_TOKEN"
```

## Data Sources

### `energy_snapshots`
One row per hour. UK grid data combining Carbon Intensity API + Elexon BMRS.
- Engine: `ReplacingMergeTree` (dedup on same hour)
- Sorting key: `timestamp`

### `commodity_prices`
One row per commodity per day. Oil & gas from US EIA.
- Engine: `ReplacingMergeTree` (dedup on same date+commodity)
- Sorting key: `date, commodity`

## Pipes (API Endpoints)

| Pipe | Description | Params |
|------|-------------|--------|
| `latest_snapshot` | Most recent grid snapshot | — |
| `snapshots_range` | Snapshots in time range | `start`, `end`, `granularity` (hour/day/week) |
| `latest_prices` | Latest price per commodity | — |
| `prices_range` | Price history in date range | `start`, `end`, `commodity` (optional) |
