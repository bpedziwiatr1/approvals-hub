import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("filter, select and read the details of an Approval", async ({ page }) => {
  await page.goto("/?scenario=default&lang=en");
  await page.getByRole("searchbox", { name: "Search by title" }).fill("travel");
  const grid = page.getByRole("grid");
  await expect(grid.getByText("Contoso travel request 2002")).toBeVisible();
  await expect(grid.getByText("Contoso purchase order 1001")).toHaveCount(0);
  await grid.getByText("Contoso travel request 2002").click();
  await expect(page.getByRole("complementary", { name: "Approval details" }).getByRole("heading", { name: "Contoso travel request 2002" })).toBeVisible();
});

test("works with the keyboard alone", async ({ page }) => {
  await page.goto("/?scenario=default&lang=en");
  await expect(page.getByRole("grid")).toBeVisible();
  const row = page.getByRole("row", { name: /purchase order 1001/ });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Contoso purchase order 1001" })).toBeVisible();
});

test("renders in the dark theme", async ({ page }) => {
  await page.goto("/?scenario=default&lang=en&theme=dark");
  const main = page.getByRole("main");
  await expect(page.getByRole("grid")).toBeVisible();
  const background = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = background.match(/\d+/g)!.map(Number);
  expect(r + g + b).toBeLessThan(200);
});

test("switches between English and Polish", async ({ page }) => {
  await page.goto("/?scenario=default&lang=pl");
  await expect(page.getByRole("heading", { name: "Centrum zatwierdzeń" })).toBeVisible();
  await page.goto("/?scenario=default&lang=en");
  await expect(page.getByRole("heading", { name: "Approvals Hub" })).toBeVisible();
});

test("opens the details as a drawer on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/?scenario=default&lang=en");
  await page.getByText("Contoso purchase order 1001").click();
  const drawer = page.getByRole("dialog", { name: "Approval details" });
  await expect(drawer.getByRole("heading", { name: "Contoso purchase order 1001" })).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
});

test.describe("states", () => {
  test("empty", async ({ page }) => {
    await page.goto("/?scenario=empty&lang=en");
    await expect(page.getByText("No approvals found")).toBeVisible();
  });
  test("no permission", async ({ page }) => {
    await page.goto("/?scenario=noPermission&lang=en");
    await expect(page.getByRole("alert")).toContainText("You do not have permission");
  });
  test("server error, then retry recovers", async ({ page }) => {
    await page.goto("/?scenario=serverError&lang=en");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("grid").getByText("Contoso purchase order 1001")).toBeVisible();
  });
  test("slow shows loading first", async ({ page }) => {
    await page.goto("/?scenario=slow&lang=en");
    await expect(page.getByText("Loading approvals")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
  });
});

for (const theme of ["light", "dark"]) {
  test(`main view has no axe violations (${theme})`, async ({ page }) => {
    await page.goto(`/?scenario=multiStep&lang=en&theme=${theme}`);
    await page.getByText("Contoso budget approval").click();
    await expect(page.getByRole("heading", { level: 2, name: "Contoso budget approval" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}
