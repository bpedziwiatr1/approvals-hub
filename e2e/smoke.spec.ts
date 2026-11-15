import { expect, test } from "@playwright/test";

test("lists Approvals from the default scenario", async ({ page }) => {
  await page.goto("/?scenario=default&lang=en");
  await expect(page.getByRole("heading", { name: "Approvals Hub" })).toBeVisible();
  await expect(page.getByText("Contoso purchase order 1001")).toBeVisible();
});
