import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const LIGHT_BG = "rgb(247, 247, 250)";
const DARK_BG = "rgb(15, 17, 23)";

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function setThemeCookie(page: Page, baseURL: string, value: string) {
  await page.context().addCookies([{ name: "theme", value, url: baseURL }]);
}

test.describe("motyw systemowy ciemny", () => {
  test.use({ colorScheme: "dark" });

  test("bez ciasteczka widać ciemny, przycisk włącza jasny na stałe", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await bodyBackground(page)).toBe(DARK_BG);

    await page.getByRole("button", { name: "Włącz motyw jasny" }).click();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expect(
      page.getByRole("button", { name: "Włącz motyw ciemny" }),
    ).toBeVisible();

    await page.reload();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });
});

test.describe("motyw systemowy jasny", () => {
  test.use({ colorScheme: "light" });

  test("przycisk ustawia motyw przeciwny do widocznego", async ({ page }) => {
    await page.goto("/");
    expect(await bodyBackground(page)).toBe(LIGHT_BG);

    const toggle = page.getByRole("button", { name: /^Włącz motyw/ });
    await expect(toggle).toHaveAccessibleName("Włącz motyw ciemny");
    await toggle.click();
    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expect(toggle).toHaveAccessibleName("Włącz motyw jasny");

    await toggle.click();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expect(toggle).toHaveAccessibleName("Włącz motyw ciemny");
  });

  test("zapisany ciemny motyw wygrywa z systemowym", async ({
    page,
    baseURL,
  }) => {
    await setThemeCookie(page, baseURL!, "dark");
    await page.goto("/");
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test("brak mignięcia: motyw z ciasteczka jest gotowy przed hydracją", async ({
    page,
    baseURL,
  }) => {
    await setThemeCookie(page, baseURL!, "dark");
    // Bez skryptów aplikacji React się nie uruchamia: zostaje HTML, CSS
    // i skrypt w <head>, więc tak wygląda strona przed hydracją.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());

    const seen: string[] = [];
    page.on("console", (msg) => seen.push(msg.text()));
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const root = document.documentElement;
        const bg = getComputedStyle(document.body).backgroundColor;
        console.log(`${root.dataset.theme}|${bg}`);
      });
    });

    await page.goto("/");
    await expect.poll(() => seen).toContain(`dark|${DARK_BG}`);
  });
});

test.describe("dwie karty", () => {
  test.use({ colorScheme: "light" });

  test("przycisk kieruje się motywem widocznym w karcie, nie ciasteczkiem", async ({
    context,
  }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto("/");
    await b.goto("/");

    await a.getByRole("button", { name: "Włącz motyw ciemny" }).click();
    expect(await bodyBackground(a)).toBe(DARK_BG);

    // Karta B nadal jest jasna, choć ciasteczko mówi już „dark”.
    await b.getByRole("button", { name: "Włącz motyw ciemny" }).click();
    expect(await bodyBackground(b)).toBe(DARK_BG);
  });
});
