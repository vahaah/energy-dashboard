import { describe, expect, it } from "vitest";
import { healthReadingHtml } from "@/components/data-health-markup";
import { buildReading } from "@/lib/data-health";

const NOW = new Date("2026-10-14T11:00:00.000Z");

describe("health reading markup", () => {
  it("keeps the clocks and escapes a label", () => {
    const reading = buildReading({
      metricId: "elec.gb.demand.itsdo",
      value: 28000,
      publishedAt: "2026-10-14T08:00:00.000Z",
      retrievedAt: "2026-10-14T11:00:00.000Z",
      now: NOW,
    });
    reading.label = `Demand <script>`;
    const html = healthReadingHtml(reading);
    expect(html).toContain("Demand &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('data-clock="published"');
    expect(html).toContain('data-state="stale"');
    expect(html).toContain("Not updated");
    expect(html).toContain("28,000");
  });
});
