import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, CardEmpty, CardError, CardLoading } from "@/components/ui/card";
import { SectionBlock } from "@/components/section-block";

describe("Card", () => {
  it("uses the shared surface, header slot, and muted footer", () => {
    const html = renderToStaticMarkup(
      <Card
        title="What does power cost?"
        tooltip="Market Index from Elexon."
        actions={<button type="button">Week</button>}
        footer="Elexon BMRS · 10:00 BST"
      >
        <p>chart</p>
      </Card>
    );

    expect(html).toContain('data-slot="card"');
    expect(html).toContain("surface-card");
    expect(html).toContain("What does power cost?");
    expect(html).toContain("About What does power cost?");
    expect(html).toContain('data-slot="card-actions"');
    expect(html).toContain("Week");
    expect(html).toContain('data-slot="card-footer"');
    expect(html).toContain("Elexon BMRS · 10:00 BST");
    expect(html).toContain("text-heading-16");
    expect(html).not.toContain("text-heading-24");
    expect(html).toContain("var(--card-pad)");
    expect(html).toContain('data-slot="card-body"');
  });

  it("renders compact stat titles for tile cards", () => {
    const html = renderToStaticMarkup(
      <Card title="Highest wind" size="stat" as="article">
        <p>23.9 GW</p>
      </Card>
    );

    expect(html).toContain('data-size="stat"');
    expect(html).toContain("text-label-13");
    expect(html).toContain("<article");
  });

  it("renders loading, empty, and error states without extra chrome", () => {
    const loading = renderToStaticMarkup(<CardLoading />);
    const empty = renderToStaticMarkup(<CardEmpty stamp="Data as of 10:00 BST" />);
    const error = renderToStaticMarkup(<CardError>Could not load prices.</CardError>);

    expect(loading).toContain('data-slot="card-loading"');
    expect(empty).toContain("Data is catching up. Last update 10:00 BST");
    expect(empty).not.toContain("rounded-xl");
    expect(empty).not.toContain("border");
    expect(error).toContain('role="alert"');
    expect(error).toContain("Could not load prices.");
  });

  it("maps SectionBlock headerRight into the card actions slot", () => {
    const html = renderToStaticMarkup(
      <SectionBlock title="Gas & oil" headerRight={<span>30d</span>}>
        <p>series</p>
      </SectionBlock>
    );

    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="card-actions"');
    expect(html).toContain("30d");
    expect(html).toContain("Gas &amp; oil");
  });
});
