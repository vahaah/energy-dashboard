export type FlowQuery = {
  sel: string | null;
  asset: string | null;
  layers: string;
};

export function layerTokens(layers: string): string[] {
  return layers.split(",").filter((part) => part.length > 0);
}

export function layerOn(layers: string, token: string): boolean {
  return layerTokens(layers).includes(token);
}

export function withLayer(layers: string, token: string): string {
  const tokens = layerTokens(layers);
  if (!tokens.includes(token)) {
    tokens.push(token);
  }
  return tokens.join(",");
}

/**
 * Asset pages open `/map?sel=<id>`. Interconnectors also set `layers=ic`.
 * An empty layers string keeps the Flows default (interconnectors on).
 */
export function flowSelectionFromQuery(query: FlowQuery): {
  selectedId: string | null;
  interconnectors: boolean;
} {
  return {
    selectedId: query.sel ?? query.asset ?? null,
    interconnectors: query.layers.length === 0 || layerOn(query.layers, "ic"),
  };
}
