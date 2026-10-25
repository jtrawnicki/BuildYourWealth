import { type Locator, type Page, expect, test } from "@playwright/test";
import { formatMonthTitle } from "@/domain/month-name";
import { currentMonth } from "@/domain/time";
import { resetDatabase } from "../db";

// Projekt „demo" (APP_MODE=demo). Każdy test zaczyna od czystej bazy, żeby
// zresetować limity piaskownic (liczone z kont demo).

test.beforeEach(async () => {
  await resetDatabase();
});

async function enterDemo(page: Page): Promise<void> {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: "Wypróbuj wersję demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Ten miesiąc" }),
  ).toBeVisible();
}

async function submit(button: Locator): Promise<void> {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

test("wejście do demo otwiera Ten miesiąc z danymi, pigułką i banerem; inne ekrany też mają dane (scen. 19)", async ({
  page,
}) => {
  await enterDemo(page);

  await expect(page.getByText("Wersja demonstracyjna")).toBeVisible();
  await expect(page.getByText("czeka na rozliczenie")).toBeVisible();
  // Plan bieżącego miesiąca z celami z generatora.
  await expect(page.getByText("Poduszka bezpieczeństwa")).toBeVisible();

  await page.goto("/majatek");
  await expect(page.getByText("Konto oszczędnościowe")).toBeVisible();
  await expect(page.getByText("Konto IKE (EUR)")).toBeVisible();

  await page.goto("/plan");
  // Na ekranie Plan nazwa celu jest wartością pola edycji; cel ma aria-label.
  await expect(page.locator('[aria-label="Cel: ETF globalny"]')).toBeVisible();

  await page.goto("/historia");
  await expect(page.getByText("Rozliczony").first()).toBeVisible();
});

test("druga przeglądarka dostaje osobną piaskownicę: zmiany pierwszej są niewidoczne (scen. 19, 21)", async ({
  browser,
}) => {
  const current = currentMonth(new Date());
  const unique = "Przychód-izolacja-9731";

  const c1 = await browser.newContext();
  const p1 = await c1.newPage();
  await enterDemo(p1);
  const region = p1.getByRole("region", { name: formatMonthTitle(current) });
  await region.getByLabel("Nazwa").fill(unique);
  await region.getByLabel("Kwota netto (PLN)").fill("1 234");
  await submit(region.getByRole("button", { name: "Dodaj przychód" }));
  await expect(p1.getByText(unique)).toBeVisible();

  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await enterDemo(p2);
  // Osobna piaskownica — nie widać przychodu dodanego w pierwszej.
  await expect(p2.getByText(unique)).toHaveCount(0);

  await c1.close();
  await c2.close();
});

test("Wyloguj kończy piaskownicę: wraca na ekran startowy, a sesja nie działa (scen. 20)", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/ustawienia");
  await submit(page.getByRole("button", { name: "Wyloguj się" }));

  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(
    page.getByRole("button", { name: "Wypróbuj wersję demo" }),
  ).toBeVisible();

  // Sesja piaskownicy zakończona: chroniona strona wraca na ekran startowy.
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
});
