import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const PAGES = [
  "/",
  "/today",
  "/prices/gas",
  "/explained/price-cap",
  "/methodology",
  "/api",
  "/privacy",
  "/terms",
  "/data-sources",
  "/records",
] as const;

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
] as const;

const THEMES = ["dark", "light"] as const;

type LayoutIssue = {
  kind: string;
  text: string;
  detail: string;
};

function slug(path: string): string {
  if (path === "/") {
    return "home";
  }
  return path.replace(/^\//, "").replace(/\//g, "-");
}

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

async function auditLayout(page: Page): Promise<LayoutIssue[]> {
  return page.evaluate(() => {
    const issues: LayoutIssue[] = [];
    const tol = 1;
    const padProbe = document.createElement("div");
    padProbe.style.position = "absolute";
    padProbe.style.visibility = "hidden";
    padProbe.style.paddingLeft = "var(--card-pad)";
    document.body.appendChild(padProbe);
    const cardPad = parseFloat(getComputedStyle(padProbe).paddingLeft);
    padProbe.remove();
    const slotSelector =
      '[data-slot="card-pad"], [data-slot="card-body"], [data-slot="card-header"], [data-slot="card-footer"]';

    function clips(value: string): boolean {
      return value === "hidden" || value === "clip";
    }

    function isScrollport(style: CSSStyleDeclaration): boolean {
      const overflows = new Set(["auto", "scroll"]);
      return overflows.has(style.overflowX) || overflows.has(style.overflowY);
    }

    function visible(el: Element): boolean {
      if (!(el instanceof HTMLElement)) {
        return false;
      }
      if (el.closest(".sr-only")) {
        return false;
      }
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0.5 && rect.height > 0.5;
    }

    function describe(el: Element): string {
      const id = el.id ? `#${el.id}` : "";
      const slot = el.getAttribute("data-slot");
      const cls =
        el instanceof HTMLElement && el.className
          ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")}`
          : "";
      return `${el.tagName.toLowerCase()}${id}${slot ? `[data-slot=${slot}]` : ""}${cls}`;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const parent = node.parentElement;
      if (text && parent && visible(parent)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) {
            continue;
          }
          let ancestor: HTMLElement | null = parent;
          let scrolledX = false;
          let scrolledY = false;
          while (ancestor) {
            const style = getComputedStyle(ancestor);
            if (style.overflowX === "auto" || style.overflowX === "scroll") {
              scrolledX = true;
            }
            if (style.overflowY === "auto" || style.overflowY === "scroll") {
              scrolledY = true;
            }
            const clipsX = clips(style.overflowX) && !scrolledX;
            const clipsY = clips(style.overflowY) && !scrolledY;
            if ((clipsX || clipsY) && style.textOverflow !== "ellipsis") {
              const box = ancestor.getBoundingClientRect();
              const left = box.left + parseFloat(style.borderLeftWidth);
              const right = box.right - parseFloat(style.borderRightWidth);
              const top = box.top + parseFloat(style.borderTopWidth);
              const bottom = box.bottom - parseFloat(style.borderBottomWidth);
              const overflowX = clipsX && (rect.left < left - tol || rect.right > right + tol);
              const overflowY = clipsY && (rect.top < top - tol || rect.bottom > bottom + tol);
              if (overflowX || overflowY) {
                issues.push({
                  kind: "clip",
                  text: text.slice(0, 90),
                  detail: `${describe(ancestor)} x=${overflowX} y=${overflowY}`,
                });
                break;
              }
            }
            ancestor = ancestor.parentElement;
          }
        }
      }
      node = walker.nextNode();
    }

    for (const card of document.querySelectorAll('[data-slot="card"]')) {
      if (!visible(card)) {
        continue;
      }
      const cardRect = card.getBoundingClientRect();
      const cardStyle = getComputedStyle(card);
      const innerLeft = cardRect.left + parseFloat(cardStyle.borderLeftWidth) + cardPad;
      const innerRight = cardRect.right - parseFloat(cardStyle.borderRightWidth) - cardPad;
      const innerBottom = cardRect.bottom - parseFloat(cardStyle.borderBottomWidth);

      for (const slot of card.querySelectorAll(slotSelector)) {
        if (!visible(slot)) {
          continue;
        }
        const style = getComputedStyle(slot);
        const padL = parseFloat(style.paddingLeft);
        const padR = parseFloat(style.paddingRight);
        if (Math.abs(padL - cardPad) > 0.6 || Math.abs(padR - cardPad) > 0.6) {
          issues.push({
            kind: "slot-padding",
            text: slot.getAttribute("data-slot") ?? "slot",
            detail: `${describe(slot)} padL=${padL} padR=${padR} expected=${cardPad}`,
          });
        }
        if (slot.getAttribute("data-slot") === "card-body") {
          const padB = parseFloat(style.paddingBottom);
          if (Math.abs(padB - cardPad) > 0.6) {
            issues.push({
              kind: "body-padding",
              text: "card-body",
              detail: `${describe(slot)} padB=${padB} expected=${cardPad}`,
            });
          }
        }

        const content = {
          left: slot.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + padL,
          right:
            slot.getBoundingClientRect().right -
            parseFloat(style.borderRightWidth) -
            padR,
          top: slot.getBoundingClientRect().top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
          bottom:
            slot.getBoundingClientRect().bottom -
            parseFloat(style.borderBottomWidth) -
            parseFloat(style.paddingBottom),
        };

        for (const child of slot.querySelectorAll("*")) {
          if (!visible(child)) {
            continue;
          }
          let skipped = false;
          let cursor: HTMLElement | null = child.parentElement;
          while (cursor && cursor !== slot) {
            if (isScrollport(getComputedStyle(cursor))) {
              skipped = true;
              break;
            }
            cursor = cursor.parentElement;
          }
          if (skipped) {
            continue;
          }
          const rect = child.getBoundingClientRect();
          const outside =
            rect.left < content.left - tol ||
            rect.right > content.right + tol ||
            rect.top < content.top - tol ||
            rect.bottom > content.bottom + tol;
          if (outside) {
            issues.push({
              kind: "outside-padding",
              text: (child.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
              detail: `${describe(child)} outside ${describe(slot)}`,
            });
            break;
          }
        }
      }

      const textWalker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      let textNode: Node | null = textWalker.nextNode();
      while (textNode) {
        const text = textNode.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const parent = textNode.parentElement;
        if (text && parent && visible(parent) && !parent.closest(".sr-only")) {
          const inSlot = parent.closest(slotSelector);
          if (!inSlot || !card.contains(inSlot)) {
            issues.push({
              kind: "unpadded",
              text: text.slice(0, 90),
              detail: describe(parent),
            });
          }
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rect = range.getBoundingClientRect();
          if (rect.width > 1 && rect.height > 1) {
            if (rect.left < innerLeft - tol) {
              issues.push({
                kind: "pad-left",
                text: text.slice(0, 90),
                detail: `inset=${Math.round(rect.left - (innerLeft - cardPad))} expected>=${cardPad}`,
              });
            }
            if (rect.right > innerRight + tol) {
              let cursor: HTMLElement | null = parent;
              let inScroll = false;
              while (cursor && cursor !== card) {
                if (isScrollport(getComputedStyle(cursor))) {
                  inScroll = true;
                  break;
                }
                cursor = cursor.parentElement;
              }
              if (!inScroll) {
                issues.push({
                  kind: "pad-right",
                  text: text.slice(0, 90),
                  detail: `right overflow ${Math.round(rect.right - innerRight)}px`,
                });
              }
            }
            const insetB = innerBottom - rect.bottom;
            if (insetB < 8 - tol) {
              issues.push({
                kind: "pad-bottom",
                text: text.slice(0, 90),
                detail: `bottom inset ${Math.round(insetB)}px`,
              });
            }
          }
        }
        textNode = textWalker.nextNode();
      }
    }

    for (const figure of document.querySelectorAll("[data-figure]")) {
      if (!visible(figure)) {
        continue;
      }
      const value = figure.querySelector("[data-value]");
      const unit = figure.querySelector("[data-unit]");
      if (!value || !unit || !visible(value) || !visible(unit)) {
        continue;
      }
      const display = getComputedStyle(figure).display;
      const align = getComputedStyle(figure).alignItems;
      if ((display === "flex" || display === "inline-flex") && align !== "baseline") {
        issues.push({
          kind: "baseline",
          text: (figure.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
          detail: `${display} align-items=${align}`,
        });
      }
      const valueRect = value.getBoundingClientRect();
      const unitRect = unit.getBoundingClientRect();
      const overlap = Math.min(valueRect.bottom, unitRect.bottom) - Math.max(valueRect.top, unitRect.top);
      if (overlap <= 0) {
        issues.push({
          kind: "baseline",
          text: (figure.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
          detail: "value and unit are not on the same line",
        });
      }
    }

    const wind = [...document.querySelectorAll("p")].find((item) =>
      item.textContent?.includes("Wind is forecast")
    );
    if (wind && visible(wind)) {
      const block = wind.closest(slotSelector);
      const source = block
        ? [...block.querySelectorAll("p")].find((item) => item.textContent?.includes("WINDFOR"))
        : null;
      if (source && visible(source)) {
        const delta = Math.abs(wind.getBoundingClientRect().left - source.getBoundingClientRect().left);
        if (delta > 2) {
          issues.push({
            kind: "wind-align",
            text: "Wind is forecast",
            detail: `sentence left differs from source by ${Math.round(delta)}px`,
          });
        }
      }
    }

    const seen = new Set<string>();
    return issues.filter((issue) => {
      const key = `${issue.kind}|${issue.text}|${issue.detail}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  });
}

async function auditPopovers(page: Page): Promise<LayoutIssue[]> {
  const issues: LayoutIssue[] = [];
  const buttons = page.locator('button[aria-label^="What is"], button[aria-label^="What\'s"]');
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible())) {
      continue;
    }
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const tip = page.locator('[role="tooltip"]');
    try {
      await expect(tip).toBeVisible({ timeout: 2000 });
    } catch {
      issues.push({
        kind: "popover",
        text: (await button.getAttribute("aria-label")) ?? "tooltip",
        detail: "tooltip did not open",
      });
      await page.keyboard.press("Escape");
      continue;
    }
    const box = await tip.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      issues.push({
        kind: "popover",
        text: (await button.getAttribute("aria-label")) ?? "tooltip",
        detail: "tooltip has no box",
      });
    } else if (
      box.y < -1 ||
      box.x < -1 ||
      box.y + box.height > viewport.height + 1 ||
      box.x + box.width > viewport.width + 1
    ) {
      issues.push({
        kind: "popover",
        text: ((await tip.textContent()) ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
        detail: `box ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} viewport ${viewport.width}x${viewport.height}`,
      });
    }
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden({ timeout: 2000 });
  }
  return issues;
}

test.beforeAll(async () => {
  await mkdir("test-results/layout", { recursive: true });
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`${theme} ${viewport.width} ${path} keeps card text inside padding`, async ({ page }) => {
        await prepare(page, theme, viewport.width, viewport.height);
        await page.goto(path, { waitUntil: "networkidle" });
        await page.locator("main").first().waitFor({ state: "visible" });
        const file = `test-results/layout/${theme}-${viewport.width}-${slug(path)}.png`;
        await page.screenshot({ path: file, fullPage: true });
        const layoutIssues = await auditLayout(page);
        const popoverIssues = await auditPopovers(page);
        const issues = [...layoutIssues, ...popoverIssues];
        expect(issues, issues.map((issue) => `${issue.kind}: ${issue.text} (${issue.detail})`).join("\n")).toEqual(
          []
        );
      });
    }
  }
}
