import { expect, test } from "@playwright/test";

test("lists Approvals from the default scenario", async ({ page }) => {
  await page.goto("/?scenario=default&lang=en");
  await expect(page.getByRole("heading", { name: "Approvals Hub" })).toBeVisible();
  await expect(page.getByText("Contoso purchase order 1001")).toBeVisible();
});

for (const client of ["mock", "fakeXrm"]) {
  test(`filters, selects and opens the Regarding Record (${client})`, async ({ page }) => {
    await page.goto(`/?scenario=default&lang=en${client === "fakeXrm" ? "&client=fakeXrm" : ""}`);
    await page.getByRole("searchbox").fill("purchase");
    await page.getByRole("grid").getByText("Contoso purchase order 1001").click();
    await page.getByRole("button", { name: "Open record" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __openedRecords: () => unknown }).__openedRecords()))
      .toEqual([{ entityName: "account", entityId: "00000000-0000-0000-0000-0000000000a1" }]);
  });
}

test("disables Open record with an explanation in the noRegarding scenario", async ({ page }) => {
  await page.goto("/?scenario=noRegarding&lang=en");
  await page.getByRole("grid").getByText("Contoso approval without a record").click();
  const button = page.getByRole("button", { name: "Open record" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await button.hover();
  await expect(page.getByRole("tooltip")).toHaveText("No record could be identified for this approval");
});
