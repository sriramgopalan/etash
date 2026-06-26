import { expect, test } from "@playwright/test";

test("admin overview redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/signin/);
});
