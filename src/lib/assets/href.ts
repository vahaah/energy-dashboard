export function assetSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "asset";
}

export function assetPath(id: string, name: string): string {
  return `/assets/${id}/${assetSlug(name)}`;
}

export function assetHref(row: { id: string; name: string }): string {
  return assetPath(row.id, row.name);
}

export function mapSelectionHref(id: string, layers?: string): string {
  const params = new URLSearchParams();
  params.set("sel", id);
  if (layers) {
    params.set("layers", layers);
  }
  return `/map?${params.toString()}`;
}
