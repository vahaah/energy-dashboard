import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";
import { StorageBoard } from "@/components/storage/storage-board";
import { loadStorageInventory } from "@/lib/storage/load";
import { buildStorageDocument } from "@/lib/storage/page-model";

describe("storage board", () => {
  it("renders a grouped rated-capacity total without parsing commas as NaN", () => {
    const document = buildStorageDocument(loadStorageInventory(), { available: false }, 2026);
    expect(document.rated?.totalLabel).toMatch(/,/);
    const html = renderToStaticMarkup(
      <NuqsTestingAdapter>
        <StorageBoard document={document} />
      </NuqsTestingAdapter>,
    );
    expect(html).toContain("GW");
    expect(html).toContain("MW monitored");
    expect(html).toContain(`Show all ${document.rows.length} stations`);
    expect(html).not.toContain("<details open");
  });
});
