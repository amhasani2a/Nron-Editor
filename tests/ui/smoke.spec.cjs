// مسیر فایل: tests/ui/smoke.spec.cjs
const { test, expect } = require("@playwright/test");

test("Nron Editor loads and initializes workspace", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await expect(page.locator("#visual-editor")).toBeVisible();
  await expect(page.locator(".brand-name")).toHaveText("Nron");
});
