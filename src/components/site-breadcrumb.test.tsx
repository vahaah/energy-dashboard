import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteBreadcrumb } from "@/components/site-breadcrumb";

describe("SiteBreadcrumb", () => {
  it("marks only the final item as the current page", () => {
    const html = renderToStaticMarkup(
      <SiteBreadcrumb items={[{ label: "Prices" }, { label: "Gas" }]} />
    );
    expect(html.match(/aria-current="page"/g)).toEqual(['aria-current="page"']);
    expect(html).toContain(">Prices<");
    expect(html).toContain(">Gas<");
    expect(html.indexOf(">Prices<")).toBeLessThan(html.indexOf('aria-current="page"'));
  });
});
