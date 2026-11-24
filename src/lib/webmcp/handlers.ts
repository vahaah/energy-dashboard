import type { AssetIndexRow } from "@/lib/assets/types";
import {
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  OGL_V3_ATTRIBUTION,
  OGL_V3_LICENCE_URL,
} from "@/lib/attribution";
import {
  OFGEM_JAN_2027_ANNOUNCEMENT_DATE,
  OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
  OFGEM_PRICE_CAP_HUB_URL,
  PRICE_CAP_OBSERVATION_WINDOW,
  priceCapAnswerFirst,
  PUBLISHED_PRICE_CAPS,
  CURRENT_PRICE_CAP,
} from "@/lib/price-cap";
import type { ProjectSearchRow } from "@/lib/search/project-index";
import { balancingFromApi, balancingFromCard, balancingSources } from "@/lib/webmcp/balancing-summary";
import type { EmbeddedWebMcp } from "@/lib/webmcp/embed";
import { dataHealthFromApi } from "@/lib/webmcp/health";
import { assetIdFromPath, pageDataset } from "@/lib/webmcp/pages";
import {
  greenestFromLookAhead,
  isDashboardPayload,
  liveReadingFromPayload,
  type GridLiveReading,
} from "@/lib/webmcp/reading";
import { historicalDateNotice, NOT_YET_AVAILABLE, toolResult, type SourceCredit } from "@/lib/webmcp/result";
import { parseSearchQuery, searchGrid } from "@/lib/webmcp/search";
import { BALANCING_PATH, DATA_HEALTH_PATH, LIVE_DASHBOARD_PATH, LOOK_AHEAD_PATH } from "@/lib/webmcp/urls";

export type WebMcpDeps = {
  now: () => Date;
  readEmbedded: () => EmbeddedWebMcp | null;
  fetchJson: (url: string, signal: AbortSignal) => Promise<unknown>;
  loadAssets: (signal: AbortSignal) => Promise<AssetIndexRow[]>;
  loadProjects: (signal: AbortSignal) => Promise<ProjectSearchRow[]>;
  page: () => { title: string; url: string; path: string };
};

const BALANCING_NOTICE =
  "Electricity traded with neighbouring countries is a separate estimate and is not part of this balancing cost.";

const SEARCH_SOURCES: SourceCredit[] = [
  {
    name: "DESNZ REPD and DUKES",
    attribution: OGL_V3_ATTRIBUTION,
    url: OGL_V3_LICENCE_URL,
  },
  {
    name: "NESO TEC register",
    attribution: NESO_OPEN_DATA_ATTRIBUTION,
    url: NESO_OPEN_DATA_LICENCE_URL,
  },
];

function yearOf(iso: string): number {
  const year = Number(iso.slice(0, 4));
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getUTCFullYear();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
  }
}

export function createWebMcpHandlers(deps: WebMcpDeps) {
  let cachedReading: GridLiveReading | null | undefined;

  async function loadReading(signal: AbortSignal): Promise<{ reading: GridLiveReading | null; embedded: EmbeddedWebMcp | null }> {
    throwIfAborted(signal);
    const embedded = deps.readEmbedded();
    if (embedded?.reading) {
      return { reading: embedded.reading, embedded };
    }
    if (cachedReading !== undefined) {
      return { reading: cachedReading, embedded };
    }
    try {
      const body = await deps.fetchJson(LIVE_DASHBOARD_PATH, signal);
      const reading = isDashboardPayload(body) ? liveReadingFromPayload(body, deps.now().toISOString()) : null;
      cachedReading = reading;
      return { reading, embedded };
    } catch (error) {
      throwIfAborted(signal);
      if (error instanceof Error && error.message === "WebMCP tools do not read a historical date.") {
        throw error;
      }
      return { reading: null, embedded };
    }
  }

  async function carbonReading(signal: AbortSignal): Promise<{ reading: GridLiveReading | null; greenest: GridLiveReading["greenest"] }> {
    const loaded = await loadReading(signal);
    if (loaded.reading?.greenest) {
      return { reading: loaded.reading, greenest: loaded.reading.greenest };
    }
    try {
      const body = await deps.fetchJson(LOOK_AHEAD_PATH, signal);
      const greenest = greenestFromLookAhead(body);
      if (greenest && loaded.reading) {
        return { reading: { ...loaded.reading, greenest }, greenest };
      }
      return { reading: loaded.reading, greenest };
    } catch {
      throwIfAborted(signal);
      return { reading: loaded.reading, greenest: null };
    }
  }

  return {
    async getLiveMix(_input: unknown, signal: AbortSignal) {
      const blocked = historicalDateNotice(_input);
      const retrievedAt = deps.now().toISOString();
      if (blocked) {
        return toolResult("get_live_mix", retrievedAt, [], null, blocked);
      }
      const { reading } = await loadReading(signal);
      const mix = reading && (reading.fuels.length > 0 || reading.demandMw != null || reading.generationMw != null) ? reading : null;
      return toolResult(
        "get_live_mix",
        retrievedAt,
        mix?.sources ?? [],
        mix,
        mix ? (mix.stale ? "This half-hour is older than Grid's usual refresh." : null) : NOT_YET_AVAILABLE,
      );
    },

    async getCarbonIntensity(_input: unknown, signal: AbortSignal) {
      const blocked = historicalDateNotice(_input);
      const retrievedAt = deps.now().toISOString();
      if (blocked) {
        return toolResult("get_carbon_intensity", retrievedAt, [], null, blocked);
      }
      const { reading, greenest } = await carbonReading(signal);
      const carbon = reading?.carbon ?? null;
      if (!carbon && !greenest) {
        return toolResult("get_carbon_intensity", retrievedAt, reading?.sources ?? [], null, NOT_YET_AVAILABLE);
      }
      const notice = !carbon
        ? "The half-hour carbon intensity is not in this reading. The raw 48-hour forecast is not returned."
        : greenest
          ? null
          : "The cleanest two-hour window is not in this reading. The raw 48-hour forecast is not returned.";
      return toolResult(
        "get_carbon_intensity",
        retrievedAt,
        reading?.sources ?? [],
        {
          carbon,
          greenest,
          settlementStart: reading?.settlementStart ?? null,
          settlementStartUtc: reading?.settlementStartUtc ?? greenest?.startUtc ?? null,
          pageSentence: reading?.pageSentence ?? null,
          stale: reading?.stale ?? false,
        },
        notice,
      );
    },

    async getWholesalePrice(_input: unknown, signal: AbortSignal) {
      const blocked = historicalDateNotice(_input);
      const retrievedAt = deps.now().toISOString();
      if (blocked) {
        return toolResult("get_wholesale_price", retrievedAt, [], null, blocked);
      }
      const { reading } = await loadReading(signal);
      const marketIndex = reading?.marketIndex ?? null;
      const imbalance = reading && reading.imbalance.gbpPerMwh != null ? reading.imbalance : null;
      if (!marketIndex && !imbalance) {
        return toolResult("get_wholesale_price", retrievedAt, reading?.sources ?? [], null, NOT_YET_AVAILABLE);
      }
      const missing = !marketIndex
        ? "The Market Index price is not in this reading. "
        : !imbalance
          ? "The imbalance price is not in this reading. "
          : "";
      return toolResult(
        "get_wholesale_price",
        retrievedAt,
        reading?.sources ?? [],
        {
          marketIndex,
          imbalance,
          settlementStart: reading?.settlementStart ?? null,
          settlementStartUtc: reading?.settlementStartUtc ?? null,
        },
        `${missing}Market Index (APXMIDP) is the short-term wholesale price. The system price is the imbalance price. They are different series.`,
      );
    },

    getPriceCap(_input: unknown) {
      const retrievedAt = deps.now().toISOString();
      const blocked = historicalDateNotice(_input);
      if (blocked) {
        return toolResult("get_price_cap", retrievedAt, [], null, blocked);
      }
      return toolResult(
        "get_price_cap",
        retrievedAt,
        [{ name: "Ofgem", attribution: "Source: Ofgem.", url: CURRENT_PRICE_CAP.sourceUrl }],
        {
          current: CURRENT_PRICE_CAP,
          published: PUBLISHED_PRICE_CAPS,
          january2027: null,
          nextAnnouncementDate: OFGEM_JAN_2027_ANNOUNCEMENT_DATE,
          nextAnnouncementLabel: OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
          observationWindow: PRICE_CAP_OBSERVATION_WINDOW,
          hubUrl: OFGEM_PRICE_CAP_HUB_URL,
          sentence: priceCapAnswerFirst(),
        },
        "Grid does not show a January 2027 cap until Ofgem publishes that figure.",
      );
    },

    async searchGrid(input: unknown, signal: AbortSignal) {
      const retrievedAt = deps.now().toISOString();
      const blocked = historicalDateNotice(input);
      if (blocked) {
        return toolResult("search_grid", retrievedAt, SEARCH_SOURCES, null, blocked);
      }
      const parsed = parseSearchQuery(input);
      if ("notice" in parsed) {
        return toolResult("search_grid", retrievedAt, SEARCH_SOURCES, null, parsed.notice);
      }
      const query = parsed.query.trim();
      let assets: AssetIndexRow[] | null = null;
      let projects: ProjectSearchRow[] | null = null;
      const notices: string[] = [];
      if (query.length > 0) {
        const [assetResult, projectResult] = await Promise.all([
          deps.loadAssets(signal).then((rows) => ({ rows, failed: false as const })).catch(() => {
            throwIfAborted(signal);
            return { rows: null, failed: true as const };
          }),
          deps.loadProjects(signal).then((rows) => ({ rows, failed: false as const })).catch(() => {
            throwIfAborted(signal);
            return { rows: null, failed: true as const };
          }),
        ]);
        assets = assetResult.rows;
        projects = projectResult.rows;
        if (assetResult.failed) {
          notices.push("The asset register could not be loaded.");
        }
        if (projectResult.failed) {
          notices.push("The project register could not be loaded.");
        }
      }
      return toolResult(
        "search_grid",
        retrievedAt,
        SEARCH_SOURCES,
        { hits: searchGrid(query, assets, projects) },
        notices.length > 0 ? notices.join(" ") : "This search does not look up an MPAN, MPRN or meter serial.",
      );
    },

    async getPageDataset(_input: unknown, signal: AbortSignal) {
      throwIfAborted(signal);
      const retrievedAt = deps.now().toISOString();
      const blocked = historicalDateNotice(_input);
      if (blocked) {
        return toolResult("get_page_dataset", retrievedAt, [], null, blocked);
      }
      const embedded = deps.readEmbedded();
      const page = deps.page();
      const assetId = assetIdFromPath(page.path);
      let asset: { technology: string } | null = null;
      let notice: string | null = null;
      if (assetId) {
        try {
          const rows = await deps.loadAssets(signal);
          asset = rows.find((row) => row.id === assetId) ?? null;
          if (!asset) {
            notice = "This asset is not in the register Grid holds.";
          }
        } catch {
          throwIfAborted(signal);
          notice = "The asset register could not be loaded.";
        }
      }
      const dataset = pageDataset({
        title: page.title,
        url: page.url,
        path: page.path,
        retrievedAt,
        year: yearOf(retrievedAt),
        reading: embedded?.reading ?? null,
        embeddedPath: embedded?.path ?? null,
        asset,
      });
      return toolResult("get_page_dataset", retrievedAt, dataset.sources, dataset, notice);
    },

    async getBalancingSummary(_input: unknown, signal: AbortSignal) {
      const retrievedAt = deps.now().toISOString();
      const blocked = historicalDateNotice(_input);
      const sources = balancingSources(yearOf(retrievedAt));
      if (blocked) {
        return toolResult("get_balancing_summary", retrievedAt, sources, null, blocked);
      }
      const embedded = deps.readEmbedded();
      if (embedded?.balancing) {
        return toolResult(
          "get_balancing_summary",
          retrievedAt,
          sources,
          balancingFromCard(embedded.balancing),
          BALANCING_NOTICE,
        );
      }
      try {
        const body = await deps.fetchJson(BALANCING_PATH, signal);
        const summary = balancingFromApi(body);
        return toolResult(
          "get_balancing_summary",
          retrievedAt,
          sources,
          summary,
          summary ? BALANCING_NOTICE : NOT_YET_AVAILABLE,
        );
      } catch {
        throwIfAborted(signal);
        return toolResult("get_balancing_summary", retrievedAt, sources, null, NOT_YET_AVAILABLE);
      }
    },

    async getDataHealth(_input: unknown, signal: AbortSignal) {
      const retrievedAt = deps.now().toISOString();
      const blocked = historicalDateNotice(_input);
      if (blocked) {
        return toolResult("get_data_health", retrievedAt, [], null, blocked);
      }
      try {
        const body = await deps.fetchJson(DATA_HEALTH_PATH, signal);
        const summary = dataHealthFromApi(body);
        const sources = summary
          ? uniqueSources(summary.readings.map((row) => row.source))
          : [];
        const omitted = summary && summary.omitted > 0 ? ` ${summary.omitted} further readings were left out.` : "";
        return toolResult(
          "get_data_health",
          retrievedAt,
          sources,
          summary,
          summary ? `Readings are GB electricity and GB gas.${omitted}` : NOT_YET_AVAILABLE,
        );
      } catch {
        throwIfAborted(signal);
        return toolResult("get_data_health", retrievedAt, [], null, NOT_YET_AVAILABLE);
      }
    },
  };
}

function uniqueSources(names: string[]): SourceCredit[] {
  const seen = new Set<string>();
  const sources: SourceCredit[] = [];
  for (const name of names) {
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    sources.push({ name, attribution: name });
  }
  return sources;
}

export type WebMcpHandlers = ReturnType<typeof createWebMcpHandlers>;
