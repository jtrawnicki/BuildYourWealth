import { expect, test } from "./fixtures";

const TABS = [
  "Ten miesiąc",
  "Majątek",
  "Plan podziału",
  "Historia",
  "Prognoza",
  "Ustawienia",
];

test("nawigacja ma sześć zakładek, aktywna jest oznaczona", async ({
  page,
}) => {
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

    test("sześć zakładek bez przycisku motywu i bez przewijania w poziomie (scen. 46)", async ({
      page,
    }) => {
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
        // Skrócona nazwa mieści się bez ucinania (SPEC 8.1, scen. 46).
        const short = link.locator("span").last();
        const fits = await short.evaluate(
          (el) => el.scrollWidth <= el.clientWidth,
        );
        expect(fits).toBe(true);
      }
      // Przycisk motywu jest ukryty w dolnej belce (SPEC P30); motyw zmienia się
      // w Ustawieniach.
      await expect(
        page.getByRole("button", { name: /^Włącz motyw/ }),
      ).toBeHidden();
    });
  });
}
