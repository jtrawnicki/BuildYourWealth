import { expect, test } from "./fixtures";

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
  // Na telefonie widać skróconą nazwę, więc zakładki rozpoznajemy po dostępnej
  // nazwie (aria-label), nie po widocznym tekście.
  await expect(nav.getByRole("link")).toHaveCount(TABS.length);
  for (const name of TABS) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(nav.locator('[aria-current="page"]')).toHaveAccessibleName(
    "Ten miesiąc",
  );
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

      // Zakładki szukamy w nawigacji i dokładną nazwą: „Zobacz majątek" w pasku
      // majątku zawiera „Majątek" i rozjechałby dopasowanie podłańcuchem.
      const nav = page.getByRole("navigation", { name: "Menu główne" });
      for (const name of TABS) {
        const link = nav.getByRole("link", { name, exact: true });
        await expect(link).toBeInViewport({ ratio: 1 });
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(
        page.getByRole("button", { name: /^Włącz motyw/ }),
      ).toBeInViewport({ ratio: 1 });
    });
  });
}
