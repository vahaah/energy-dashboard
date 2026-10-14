import { fetchGbGasSapRange, sapCronWindow } from "@/lib/gb-gas-sap";
import type { SourceStatus } from "@/lib/http";
import {
  eiaApiKeyFromEnv,
  eiaCronWindow,
  fetchEiaRange,
  isRequiredPriceCronSource,
  rejectCrossWiredPriceRows,
  selectCronWorldBankRows,
  type PriceRow,
} from "@/lib/ingest/collect-prices";
import { stepStatus, type StepStatus } from "@/lib/step-status";
import { readWorkflowBody, writeWorkflowBody } from "@/lib/workflow-body";
import { fetchWorldBankMonthly, worldBankCronWindow } from "@/lib/world-bank-pink-sheet";
import { postTinybirdRows } from "@/workflows/steps/post";

type PriceBody = {
  source: string;
  ok: boolean;
  rows: PriceRow[];
  error?: string;
};

export async function fetchEiaStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const key = eiaApiKeyFromEnv(process.env.EIA_API_KEY);
  const window = eiaCronWindow(now);
  const body = await runOptionalSource(
    "eia",
    key,
    "EIA_API_KEY is not set (DEMO_KEY is not used)",
    (apiKey) => fetchEiaRange(apiKey, window.from, window.to)
  );
  const bytes = await writeWorkflowBody("prices", slot, "eia", body);
  return stepStatus(body.ok, body.rows.length, bytes);
}

export async function fetchPinkSheetStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const body = await runKeylessSource("worldbank", () =>
    fetchWorldBankMonthly(worldBankCronWindow(now))
  );
  const bytes = await writeWorkflowBody("prices", slot, "worldbank", body);
  return stepStatus(body.ok, body.rows.length, bytes);
}

export async function fetchSapStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const window = sapCronWindow(now);
  const body = await runKeylessSource("nationalgas", () =>
    fetchGbGasSapRange(window.from, window.to)
  );
  const bytes = await writeWorkflowBody("prices", slot, "nationalgas", body);
  return stepStatus(body.ok, body.rows.length, bytes);
}

export async function postPricesStep(slot: string, nowIso: string): Promise<StepStatus> {
  "use step";
  const now = new Date(nowIso);
  const eia = await readWorkflowBody<PriceBody>("prices", slot, "eia");
  const worldbank = await readWorkflowBody<PriceBody>("prices", slot, "worldbank");
  const sap = await readWorkflowBody<PriceBody>("prices", slot, "nationalgas");
  const rows = [
    ...rejectCrossWiredPriceRows(eia?.rows ?? []),
    ...selectCronWorldBankRows(worldbank?.rows ?? []),
    ...rejectCrossWiredPriceRows(sap?.rows ?? []),
  ];
  const sources: SourceStatus[] = [eia, worldbank, sap]
    .filter((source): source is PriceBody => source != null)
    .map((source) => ({
      source: source.source,
      ok: source.ok,
      rows: source.rows.length,
      error: source.error,
    }));
  const requiredFailed = [eia, worldbank].some((source) => requiredSourceFailed(source));
  console.info("[workflow] prices", { requiredFailed, sources });
  const posted = await postTinybirdRows("commodity_prices", rows, now);
  if (requiredFailed) {
    console.error("[workflow] prices required source failed", {
      sources: sources.map((source) => ({
        source: source.source,
        ok: source.ok,
        error: source.error,
      })),
    });
    return stepStatus(false, posted.rows, posted.bytes, posted.cachedAt);
  }
  return posted;
}

function requiredSourceFailed(body: PriceBody | null): boolean {
  if (body == null) {
    return true;
  }
  return !body.ok && isRequiredPriceCronSource(body.source);
}

(fetchEiaStep as { maxRetries?: number }).maxRetries = 1;
(fetchPinkSheetStep as { maxRetries?: number }).maxRetries = 1;
(fetchSapStep as { maxRetries?: number }).maxRetries = 1;
(postPricesStep as { maxRetries?: number }).maxRetries = 1;

async function runKeylessSource(
  source: string,
  fetchRows: () => Promise<PriceRow[]>
): Promise<PriceBody> {
  try {
    const rows = await fetchRows();
    return { source, ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[workflow] ${source} failed`, message);
    return { source, ok: false, rows: [], error: message };
  }
}

async function runOptionalSource(
  source: string,
  key: string | null,
  skippedMessage: string,
  fetchRows: (apiKey: string) => Promise<PriceRow[]>
): Promise<PriceBody> {
  if (!key) {
    return {
      source,
      ok: !isRequiredPriceCronSource(source),
      rows: [],
      error: skippedMessage,
    };
  }
  return runKeylessSource(source, () => fetchRows(key));
}
