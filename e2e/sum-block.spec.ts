import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1024", width: 1024, height: 900 },
  { name: "768", width: 768, height: 900 },
  { name: "375", width: 375, height: 812 },
] as const;

const THEMES = ["light", "dark"] as const;

const SHOT_DIR = "test-results/layout";

type Line = {
  text: string;
  lines: number;
  chars: number;
  title: string | null;
};

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

function spread(values: number[]): number {
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(...values) - Math.min(...values);
}

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`sum block ${theme} ${viewport.name} shares baselines and does not overflow`, async ({ page }) => {
      await prepare(page, theme, viewport.width, viewport.height);
      await page.goto("/", { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator("#section-generation");
      await expect(card).toBeVisible();
      await expect(card.getByRole("heading", { name: "Latest half-hour" })).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await card.evaluate((element) => {
        const header = document.querySelector("header");
        const offset = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
        const top = element.getBoundingClientRect().top + window.scrollY - offset - 12;
        window.scrollTo(0, Math.max(0, top));
      });
      await card.screenshot({ path: `${SHOT_DIR}/sum-block-${theme}-${viewport.name}.png` });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);

      if (viewport.width >= 1024) {
        const measured = await page.locator('dl[data-equation="horizontal"]').evaluate((dl) => {
          function baseline(element: Element): number {
            const probe = document.createElement("span");
            probe.style.display = "inline-block";
            probe.style.height = "0";
            probe.style.width = "0";
            probe.style.overflow = "hidden";
            probe.style.verticalAlign = "baseline";
            element.appendChild(probe);
            const y = probe.getBoundingClientRect().bottom;
            probe.remove();
            return y;
          }

          function lines(element: Element): number {
            const style = getComputedStyle(element);
            const lineHeight = Number.parseFloat(style.lineHeight);
            if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
              return 0;
            }
            return element.getBoundingClientRect().height / lineHeight;
          }

          const labels = [...dl.querySelectorAll("dt")].map((element) => element.getBoundingClientRect().bottom);
          const figures = [...dl.querySelectorAll("[data-figure]")].map((element) => baseline(element));
          const operators = [...dl.querySelectorAll(":scope > [data-operator]")].map((element) => baseline(element));
          const widths = [...dl.querySelectorAll(":scope > [data-stat]")].map(
            (element) => element.getBoundingClientRect().width
          );
          const captions = [...dl.querySelectorAll("[data-caption]")].map((element) => ({
            text: element.textContent?.trim() ?? "",
            lines: lines(element),
            chars: (element.textContent ?? "").trim().length,
            title: element.getAttribute("title"),
          }));
          const demand = dl.querySelector('[data-stat="demand"] dt');
          const demandWeight = demand instanceof HTMLElement ? getComputedStyle(demand).fontWeight : "";
          const figureSize =
            dl.querySelector("[data-figure]") instanceof HTMLElement
              ? getComputedStyle(dl.querySelector("[data-figure]") as HTMLElement).fontSize
              : "";
          const operatorSize =
            dl.querySelector("[data-operator]") instanceof HTMLElement
              ? getComputedStyle(dl.querySelector("[data-operator]") as HTMLElement).fontSize
              : "";
          return { labels, figures, operators, widths, captions, demandWeight, figureSize, operatorSize };
        });

        expect(measured.labels.length).toBeGreaterThanOrEqual(4);
        expect(spread(measured.labels)).toBeLessThanOrEqual(1);
        expect(spread([...measured.figures, ...measured.operators])).toBeLessThanOrEqual(1);
        expect(spread(measured.widths)).toBeLessThanOrEqual(1);
        expect(measured.demandWeight).toBe("600");
        expect(measured.figureSize).toBe(measured.operatorSize);
        expect(measured.figureSize).toBe(viewport.width >= 1280 ? "48px" : "36px");
        for (const caption of measured.captions as Line[]) {
          expect(caption.lines).toBeLessThanOrEqual(2.05);
          expect(caption.chars).toBeLessThanOrEqual(32);
          expect(caption.title).toBe(caption.text);
        }
        expect(measured.captions.some((caption: Line) => caption.text === "Includes embedded wind and solar")).toBe(
          true
        );

        const balanced = await page.locator('dl[data-equation="horizontal"]').getAttribute("data-balanced");
        if (balanced === "true") {
          const equation = await page.locator('dl[data-equation="horizontal"]').evaluate((dl) => {
            const values = [...dl.querySelectorAll("[data-value]")].map((element) => element.textContent?.trim() ?? "");
            const operators = [...dl.querySelectorAll(":scope > [data-operator]")].map(
              (element) => element.textContent?.trim() ?? ""
            );
            return { values, operators };
          });
          expect(equation.operators).toHaveLength(equation.values.length - 1);
          let signed = Number(equation.values[0]);
          expect(Number.isFinite(signed)).toBe(true);
          for (let index = 0; index < equation.operators.length; index += 1) {
            const next = Number(equation.values[index + 1]);
            const operator = equation.operators[index];
            expect(Number.isFinite(next)).toBe(true);
            if (operator === "+") {
              signed += next;
            } else if (operator === "−") {
              signed -= next;
            } else if (operator === "=") {
              expect(signed).toBeCloseTo(next, 5);
            } else {
              throw new Error(`unexpected operator ${operator}`);
            }
          }
        }
        return;
      }

      const ledger = await page.locator('[data-equation="ledger"]').evaluate((root) => {
        function baseline(element: Element): number {
          const probe = document.createElement("span");
          probe.style.display = "inline-block";
          probe.style.height = "0";
          probe.style.width = "0";
          probe.style.overflow = "hidden";
          probe.style.verticalAlign = "baseline";
          element.appendChild(probe);
          const y = probe.getBoundingClientRect().bottom;
          probe.remove();
          return y;
        }

        const ids = [...root.querySelectorAll("[data-row]")].map((element) => element.getAttribute("data-row") ?? "");
        const unique = [...new Set(ids)];
        const rows = unique.map((id) => {
          const labelCell = root.querySelector(`[data-row="${id}"][data-label]`);
          const label = labelCell?.querySelector("[data-label-text]") ?? null;
          const figure = root.querySelector(`[data-row="${id}"][data-figure]`);
          const operator = root.querySelector(`[data-row="${id}"][data-operator]`);
          if (
            !(labelCell instanceof HTMLElement) ||
            !(label instanceof HTMLElement) ||
            !(figure instanceof HTMLElement) ||
            !(operator instanceof HTMLElement)
          ) {
            return null;
          }
          return {
            id,
            label: baseline(label),
            figure: baseline(figure),
            operator: baseline(operator),
            figureSize: getComputedStyle(figure).fontSize,
            operatorSize: getComputedStyle(operator).fontSize,
            labelWeight: getComputedStyle(label).fontWeight,
            minHeight: getComputedStyle(labelCell).minHeight,
            rowHeight: labelCell.getBoundingClientRect().height,
          };
        });
        const captions = [...root.querySelectorAll("[data-caption]")].map((element) => ({
          text: element.textContent?.trim() ?? "",
          display: getComputedStyle(element).display,
          lines:
            element.getBoundingClientRect().height /
            Number.parseFloat(getComputedStyle(element).lineHeight || "0"),
          title: element.getAttribute("title"),
        }));
        return { rows, captions };
      });

      const rows = ledger.rows.filter((row) => row != null);
      expect(rows.length).toBeGreaterThanOrEqual(4);
      for (const row of rows) {
        if (!row) {
          continue;
        }
        expect(Math.abs(row.label - row.figure)).toBeLessThanOrEqual(1);
        if (row.id !== "generation") {
          expect(Math.abs(row.operator - row.figure)).toBeLessThanOrEqual(1);
          expect(row.operatorSize).toBe(row.figureSize);
        }
        if (viewport.width < 768) {
          expect(row.minHeight).toBe("44px");
          expect(row.rowHeight).toBeGreaterThanOrEqual(44);
          expect(row.figureSize).toBe(row.id === "demand" ? "28px" : "24px");
        } else {
          expect(row.figureSize).toBe(row.id === "demand" ? "32px" : "28px");
        }
        if (row.id === "demand") {
          expect(row.labelWeight).toBe("600");
        }
      }

      for (const caption of ledger.captions) {
        expect(caption.title).toBe(caption.text);
        expect(caption.text.length).toBeLessThanOrEqual(32);
        if (viewport.width < 768) {
          expect(caption.display).toBe("none");
        } else {
          expect(caption.display).not.toBe("none");
          expect(caption.lines).toBeLessThanOrEqual(1.05);
        }
      }
    });
  }
}
