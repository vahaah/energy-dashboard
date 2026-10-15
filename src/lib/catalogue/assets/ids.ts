import { createHash } from "node:crypto";

export function stableId(prefix: "ast" | "prj" | "cap" | "mat", key: string): string {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `${prefix}_${hex}`;
}
