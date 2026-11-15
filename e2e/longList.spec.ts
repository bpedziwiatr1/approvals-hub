import { expect, test } from "@playwright/test";

for (const client of ["mock", "fakeXrm"]) {
  test(`scrolls a long list with virtualised rows and server paging (${client})`, async ({ page }) => {
    await page.goto(`/?scenario=longList&lang=en${client === "fakeXrm" ? "&client=fakeXrm" : ""}`);
    const grid = page.getByRole("grid");
    await expect(grid.getByText("Contoso long list approval 0001")).toBeVisible();
    expect(await grid.getByRole("row").count()).toBeLessThan(80);

    const region = page.getByRole("region", { name: "Approvals list" });
    // Scroll to the bottom until a later window is rendered; web-first retry instead of fixed waits.
    await expect(async () => {
      await region.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await expect(grid.getByText(/Contoso long list approval 0[3-9]\d\d/).first()).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await expect(grid.getByText("Contoso long list approval 0001")).toHaveCount(0);
    expect(await grid.getByRole("row").count()).toBeLessThan(80);
  });
}

test("runs the real xrmClient against the in-memory fake Xrm with ?client=fakeXrm", async ({ page }) => {
  await page.goto("/?client=fakeXrm&scenario=default&lang=en");
  await expect(page.getByText("Contoso purchase order 1001")).toBeVisible();
  await expect(page.getByRole("grid").getByText("Approved")).toBeVisible();
});
