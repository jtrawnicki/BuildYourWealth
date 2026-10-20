import { expect, test } from "@playwright/test";

test("strona główna wyświetla nazwę aplikacji po polsku", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "BuildYourWealth" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});
