import { expect, test } from "@playwright/test";

test("northern ireland scope switch keeps SONI and SEMO apart", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/electricity/northern-ireland");
  await expect(page).toHaveTitle("Northern Ireland electricity: demand, wind, mix | Grid");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What's powering Northern Ireland?");
  await expect(page.getByText("Outside GB. This page covers Northern Ireland and the all-island Single Electricity Market (Northern Ireland and Ireland). Grid's GB figures never include Northern Ireland.")).toBeVisible();
  await expect(page.getByText(/Latest data from SONI is from /)).toBeVisible();
  await expect(page.getByText("Supported by EirGrid Group Data")).toBeVisible();
  await expect(page.getByRole("link", { name: "EirGrid Group Open Data Licence" })).toHaveAttribute(
    "href",
    "https://www.smartgriddashboard.com/all/open-data-license/",
  );
  await expect(page.getByText("Source: SEMO.").first()).toBeHidden();
  await page.getByRole("tab", { name: "All-island" }).click();
  await expect(page.getByText("€87.42")).toBeVisible();
  await expect(page.getByText("Source: SEMO.").first()).toBeVisible();
  await expect(page.getByText("£")).toHaveCount(0);
  await page.getByRole("tab", { name: "Northern Ireland" }).click();
  await expect(page.getByRole("heading", { name: "NI system demand" })).toBeVisible();
  await expect(page.getByText("Source: SONI.").first()).toBeVisible();
});
