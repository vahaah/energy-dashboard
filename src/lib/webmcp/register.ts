import { loadSearchIndex } from "@/lib/assets/search-index";
import { fetchBoundedJson } from "@/lib/http/bounded-json";
import { loadProjectSearchIndex } from "@/lib/search/project-index";
import { readEmbeddedWebMcp } from "@/lib/webmcp/embed";
import type { WebMcpDeps } from "@/lib/webmcp/handlers";
import { modelContextFor, type ModelContextCandidate } from "@/lib/webmcp/support";
import { gridTools } from "@/lib/webmcp/tools";
import { assertNoHistoricalDate } from "@/lib/webmcp/urls";

export function browserDeps(doc: Document = document): WebMcpDeps {
  return {
    now: () => new Date(),
    readEmbedded: () => readEmbeddedWebMcp(doc),
    fetchJson: (url, signal) => {
      assertNoHistoricalDate(url);
      return fetchBoundedJson(url, signal);
    },
    loadAssets: (signal) => loadSearchIndex(fetchWith(signal)),
    loadProjects: (signal) => loadProjectSearchIndex(fetchWith(signal)),
    page: () => ({
      title: doc.title,
      url: doc.defaultView?.location.href ?? "",
      path: doc.defaultView?.location.pathname ?? "/",
    }),
  };
}

function fetchWith(parent: AbortSignal): typeof fetch {
  return (input, init) => {
    const child = init?.signal;
    const signal = child ? AbortSignal.any([parent, child]) : parent;
    return fetch(input, { ...init, signal });
  };
}

/**
 * Registers Grid's read-only tools. Abort the signal to unregister them.
 * The UI SDK agent helper is not called, so its button-pressing tools stay off.
 */
export async function registerGridTools(
  context: ModelContextCandidate,
  signal: AbortSignal,
  deps: WebMcpDeps = browserDeps(),
): Promise<void> {
  if (signal.aborted) {
    return;
  }
  const tools = gridTools(deps, signal);
  await Promise.all(
    tools.map(async (tool) => {
      if (signal.aborted) {
        return;
      }
      try {
        await context.registerTool(tool, { signal });
      } catch {
        if (signal.aborted) {
          return;
        }
      }
    }),
  );
}

export function registerFromDocument(doc: Document, signal: AbortSignal): Promise<void> | null {
  const context = modelContextFor(doc);
  if (!context) {
    return null;
  }
  return registerGridTools(context, signal, browserDeps(doc));
}
