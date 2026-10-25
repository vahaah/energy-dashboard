import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartLegend } from "@/components/charts/chart-legend";
import { Absent } from "@/components/ui/absent";
import { Freshness } from "@/components/ui/freshness";
import { Quantity } from "@/components/ui/quantity";
import { TABLE_SCROLL_CUE, TableScroll } from "@/components/ui/table-scroll";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { THIN_SPACE } from "@/lib/format/quantity";
import { chartAxisTick } from "@/lib/chart-theme";

describe("cross-site formatting", () => {
  it("renders the unit smaller, in gray-900, with a thin space", () => {
    const html = renderToStaticMarkup(<Quantity value="57.4" unit="GW" />);
    expect(html).toContain("57.4");
    expect(html).toContain(`${THIN_SPACE}GW`);
    expect(html).toContain("text-gray-900");
    expect(html).toContain("unit-label");
    expect(html).not.toContain("text-[0.6em]");
    expect(html).not.toContain("text-gray-700");
    const customers = renderToStaticMarkup(<Quantity value="16,329" unit="customers" />);
    expect(customers).toContain("unit-customers");
    expect(customers).toContain("customers");
  });

  it("never renders a bare dash", () => {
    const html = renderToStaticMarkup(<Absent reason="Not yet published" />);
    expect(html).toContain(ABSENT_FIGURE);
    expect(html).toContain('aria-label="Not yet published"');
    expect(html).toContain('data-absent="true"');
  });

  it("marks stale data with Not updated, an amber rule, and the London time", () => {
    const html = renderToStaticMarkup(
      <Freshness state="stale" asOf="Fri 23 Oct 2026, 11:30 BST" detail="Elexon has not published a newer settlement period." />,
    );
    expect(html).toContain("Not updated");
    expect(html).toContain("border-amber-700");
    expect(html).toContain("as of Fri 23 Oct 2026, 11:30 BST");
    expect(html).not.toContain(">Stale<");
  });

  it("gives a scrolling table a cue and does not grow the page", () => {
    const html = renderToStaticMarkup(
      <TableScroll>
        <table>
          <tbody>
            <tr>
              <td>Name</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>,
    );
    expect(html).toContain(TABLE_SCROLL_CUE);
    expect(html).toContain("sm:hidden");
    expect(html).not.toContain("sr-only");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("max-w-full");
  });

  it("names every chart series in text and uses gray-900 ticks", () => {
    const html = renderToStaticMarkup(
      <ChartLegend
        items={[
          { id: "coal", label: "Coal", color: "#57534e" },
          { id: "wind", label: "Wind", color: "#0ea5e9", dash: "6 4" },
          { id: "inertia", label: "Inertia", color: "#b45309", dash: "2 3" },
        ]}
      />,
    );
    expect(html).toContain("Coal");
    expect(html).toContain("Wind");
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('stroke-dasharray="2 3"');
    expect(chartAxisTick.fill).toBe("var(--gray-900)");
    expect(chartAxisTick.fontSize).toBeGreaterThanOrEqual(11);
  });
});
