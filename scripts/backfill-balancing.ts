import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { financialYearId, financialYearsThrough } from "@/lib/balancing/aggregate";
import { balancingResourceName } from "@/lib/balancing/aggregate";
import { buildHomeCard, buildRelease, financialYearTotals } from "@/lib/balancing/build";
import {
  ckanInstant,
  fetchBoundedRetry,
  loadCostDays,
  loadFuelRows,
  loadNesoResources,
  loadPriceRows,
  loadTariffs,
  NESO_COSTS_PACKAGE,
  NESO_MIN_GAP_MS,
  NESO_TARIFF_PACKAGE,
  selectCsvResource,
  tradeWindows,
} from "@/lib/balancing/fetch";
import { parseCostRecords, parseTariffRecords, parseTradeDays, priceIndex, type NesoCostRecord, type NesoTariffRecord, type FuelHourRow, type PriceRow } from "@/lib/balancing/parse";
import type { BalancingDay, BalancingTariff, TradeDay } from "@/lib/balancing/types";
import { getLondonDate } from "@/lib/london-time";

const ROOT = resolve(import.meta.dirname, "..");
const CHECKPOINT = resolve(ROOT, "data/catalogue/raw/balancing/checkpoint.json");
const FIXTURE = resolve(ROOT, "tests/fixtures/balancing/release.json");
const HOME_CARD = resolve(ROOT, "src/lib/balancing/home-card.json");
const SUMMARY = resolve(ROOT, "data/catalogue/raw/balancing/summary.json");

type Checkpoint = {
  days: BalancingDay[];
  tariffs: BalancingTariff[];
  tradeDays: TradeDay[];
  costsIssuedAt: string | null;
  tariffsIssuedAt: string | null;
  nextTradeFrom: string | null;
  unknownFuels: string[];
};

const FIRST_YEAR = 2017;
const FIRST_DAY = "2017-04-01";

async function readCheckpoint(): Promise<Checkpoint | null> {
  try {
    const text = await readFile(CHECKPOINT, "utf8");
    return JSON.parse(text) as Checkpoint;
  } catch {
    return null;
  }
}

async function writeCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(CHECKPOINT), { recursive: true });
  await writeFile(CHECKPOINT, JSON.stringify(checkpoint));
}

function laterInstant(current: string | null, next: string | null): string | null {
  if (!next) {
    return current;
  }
  if (!current || next > current) {
    return next;
  }
  return current;
}

async function writeOutputs(checkpoint: Checkpoint, today: string): Promise<void> {
  const release = buildRelease({
    now: new Date(),
    days: checkpoint.days,
    tariffs: checkpoint.tariffs,
    tradeDays: checkpoint.tradeDays,
    costsIssuedAt: checkpoint.costsIssuedAt,
    tariffsIssuedAt: checkpoint.tariffsIssuedAt,
    tradeRetrievedAt: new Date().toISOString(),
  });
  const card = buildHomeCard(release, today);
  const totals = financialYearTotals(release);
  await mkdir(dirname(FIXTURE), { recursive: true });
  await writeFile(FIXTURE, `${JSON.stringify(release)}\n`);
  await writeFile(HOME_CARD, `${JSON.stringify(card, null, 2)}\n`);
  await mkdir(dirname(SUMMARY), { recursive: true });
  await writeFile(
    SUMMARY,
    JSON.stringify(
      {
        today,
        days: release.days.length,
        trade_days: release.trade_days.length,
        unknown_fuels: checkpoint.unknownFuels,
        totals,
        card,
      },
      null,
      2,
    ),
  );
  for (const row of totals) {
    console.log(`[balancing] FY ${row.label} days ${row.days} total_pence ${row.pence} constraints_pence ${row.constraints_pence}`);
  }
  console.log(`[balancing] wrote fixture and home card. unknown fuels ${checkpoint.unknownFuels.join(",") || "none"}`);
}

async function loadOffline(today: string): Promise<Checkpoint> {
  const raw = resolve(ROOT, "data/catalogue/raw/balancing");
  const checkpoint: Checkpoint = {
    days: [],
    tariffs: [],
    tradeDays: [],
    costsIssuedAt: null,
    tariffsIssuedAt: null,
    nextTradeFrom: null,
    unknownFuels: [],
  };
  for (const year of financialYearsThrough(FIRST_YEAR, today)) {
    const text = await readFile(resolve(raw, `costs-${year}.json`), "utf8");
    const parsed = JSON.parse(text) as { records: NesoCostRecord[]; last_modified?: string };
    const inYear = parseCostRecords(parsed.records).filter((day) => financialYearId(day.date) === year && day.date <= today);
    checkpoint.days.push(...inYear);
    checkpoint.costsIssuedAt = laterInstant(checkpoint.costsIssuedAt, parsed.last_modified ? ckanInstant(parsed.last_modified) : null);
    console.log(`[balancing] offline ${year} days ${inYear.length}`);
  }
  const tariffText = await readFile(resolve(raw, "tariffs.json"), "utf8");
  const tariffParsed = JSON.parse(tariffText) as { records: NesoTariffRecord[]; last_modified?: string };
  checkpoint.tariffs = parseTariffRecords(tariffParsed.records).tariffs;
  checkpoint.tariffsIssuedAt = tariffParsed.last_modified ? ckanInstant(tariffParsed.last_modified) : null;
  const names = (await readdir(resolve(raw, "trade"))).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    const text = await readFile(resolve(raw, "trade", name), "utf8");
    const parsed = JSON.parse(text) as { fuel: FuelHourRow[]; prices: PriceRow[] };
    const trade = parseTradeDays(parsed.fuel, priceIndex(parsed.prices));
    checkpoint.tradeDays.push(...trade.days.filter((day) => day.date <= today));
    for (const fuelCode of trade.unknownFuels) {
      if (!checkpoint.unknownFuels.includes(fuelCode)) {
        checkpoint.unknownFuels.push(fuelCode);
      }
    }
  }
  console.log(`[balancing] offline trade files ${names.length} days ${checkpoint.tradeDays.length}`);
  return checkpoint;
}

async function main(): Promise<void> {
  const today = getLondonDate(new Date());
  if (process.argv.includes("--offline")) {
    await writeOutputs(await loadOffline(today), today);
    return;
  }
  const saved = await readCheckpoint();
  const checkpoint: Checkpoint = saved ?? {
    days: [],
    tariffs: [],
    tradeDays: [],
    costsIssuedAt: null,
    tariffsIssuedAt: null,
    nextTradeFrom: FIRST_DAY,
    unknownFuels: [],
  };

  if (checkpoint.days.length === 0) {
    console.log(`[balancing] costs from FY${FIRST_YEAR}/18 through ${today}`);
    const resources = await loadNesoResources(NESO_COSTS_PACKAGE, fetchBoundedRetry);
    const years = financialYearsThrough(FIRST_YEAR, today);
    for (const year of years) {
      const resource = selectCsvResource(resources, balancingResourceName(year));
      if (!resource) {
        throw new Error(`NESO resource missing for ${year}`);
      }
      await new Promise((resolve) => setTimeout(resolve, NESO_MIN_GAP_MS));
      const start = `${year.slice(0, 4)}-04-01`;
      const end = `${Number(year.slice(0, 4)) + 1}-03-31`;
      const to = end < today ? end : today;
      const fetched = await loadCostDays(resource.id, fetchBoundedRetry, start, to);
      const inYear = fetched.filter((day) => financialYearId(day.date) === year && day.date <= today);
      checkpoint.days.push(...inYear);
      checkpoint.costsIssuedAt = laterInstant(checkpoint.costsIssuedAt, ckanInstant(resource.last_modified ?? ""));
      console.log(`[balancing] ${year} days ${inYear.length}`);
      await writeCheckpoint(checkpoint);
    }
  } else {
    console.log(`[balancing] costs checkpoint ${checkpoint.days.length} days`);
  }

  if (checkpoint.tariffs.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, NESO_MIN_GAP_MS));
    const resources = await loadNesoResources(NESO_TARIFF_PACKAGE, fetchBoundedRetry);
    const resource = resources.find((item) => item.format.toUpperCase() === "CSV");
    if (!resource) {
      throw new Error("NESO BSUoS tariff resource is missing");
    }
    await new Promise((resolve) => setTimeout(resolve, NESO_MIN_GAP_MS));
    checkpoint.tariffs = await loadTariffs(resource.id, fetchBoundedRetry);
    checkpoint.tariffsIssuedAt = ckanInstant(resource.last_modified ?? "");
    console.log(`[balancing] tariffs ${checkpoint.tariffs.length}`);
    await writeCheckpoint(checkpoint);
  }

  const tradeFrom = checkpoint.nextTradeFrom;
  const windows = tradeFrom ? tradeWindows(tradeFrom, today) : [];
  console.log(`[balancing] trade windows ${windows.length} from ${tradeFrom ?? "done"}`);
  let done = 0;
  for (const window of windows) {
    const fuel = await loadFuelRows(window.from, window.to, fetchBoundedRetry);
    const prices = await loadPriceRows(window.fromIso, window.toIso, fetchBoundedRetry);
    const parsed = parseTradeDays(fuel, priceIndex(prices));
    const incoming = parsed.days.filter((day) => day.date >= window.from && day.date <= window.to);
    checkpoint.tradeDays.push(...incoming);
    for (const fuelCode of parsed.unknownFuels) {
      if (!checkpoint.unknownFuels.includes(fuelCode)) {
        checkpoint.unknownFuels.push(fuelCode);
      }
    }
    checkpoint.nextTradeFrom = window.to < today ? addDay(window.to) : null;
    done += 1;
    if (done % 20 === 0 || window.to === today) {
      await writeCheckpoint(checkpoint);
      console.log(`[balancing] trade through ${window.to} days ${checkpoint.tradeDays.length}`);
    }
  }

  await writeOutputs(checkpoint, today);
}

function addDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "balancing backfill failed";
  console.error(`[balancing] ${message}`);
  process.exit(1);
});
