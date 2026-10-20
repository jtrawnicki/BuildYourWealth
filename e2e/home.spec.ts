import { expect, test } from "./fixtures";

test("strona główna po zalogowaniu działa po polsku", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ten miesiąc" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});
