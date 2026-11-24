export type ModelContextCandidate = {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
  waitForToolsUntil?: (operation: Promise<unknown>) => Promise<unknown>;
};

/**
 * True only when this document can register tools.
 * `navigator.modelContext` is not part of the current draft and is ignored.
 */
export function modelContextFor(doc: { modelContext?: unknown }): ModelContextCandidate | null {
  const value = doc.modelContext;
  if (!value || typeof value !== "object") {
    return null;
  }
  const registerTool = (value as { registerTool?: unknown }).registerTool;
  if (typeof registerTool !== "function") {
    return null;
  }
  return value as ModelContextCandidate;
}
