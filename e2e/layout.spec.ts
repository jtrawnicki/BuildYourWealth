import { expect, test } from "@playwright/test";

const TABS = [
  "Ten miesiąc",
  "Majątek",
  "Plan podziału",
  "Historia",
  "Ustawienia",
];

test("nawigacja ma pięć zakładek, aktywna jest oznaczona", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Menu główne" });
  await expect(nav.getByRole("link")).toHaveText(TABS);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Ten miesiąc");
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`360 px, motyw ${colorScheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme });

    test("nawigacja używalna bez przewijania w poziomie", async ({ page }) => {
      await page.goto("/");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);

      for (const name of TABS) {
        const link = page.getByRole("link", { name });
        await expect(link).toBeInViewport({ ratio: 1 });
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(
        page.getByRole("button", { name: /^Włącz motyw/ }),
      ).toBeInViewport({ ratio: 1 });
    });
  });
}
