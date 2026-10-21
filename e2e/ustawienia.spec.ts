import { type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings, sources } from "@/db/schema";
import { MESSAGES } from "@/domain/input";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { expect, test } from "./fixtures";

const LIGHT_BG = "rgb(247, 247, 250)";
const DARK_BG = "rgb(15, 17, 23)";

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const rateField = (page: Page) => page.getByLabel("Kurs EUR→PLN");
// Next ma własny ogłaszacz tras z rolą `alert`, więc szukamy w sekcji kursu.
const rateSection = (page: Page) =>
  page.getByRole("region", { name: "Kurs euro" });

async function saveRate(page: Page, value: string) {
  await rateField(page).fill(value);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Zapisz kurs" }).click(),
  ]);
}

async function storedRate(userId: number) {
  const [row] = await getDb()
    .select({ eurRate: settings.eurRate })
    .from(settings)
    .where(eq(settings.userId, userId));
  return row.eurRate;
}

test("bez sesji Ustawienia przekierowują na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/ustawienia");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("zakładka Ustawienia jest aktywna", async ({ page }) => {
  await page.goto("/ustawienia");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ustawienia" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Menu główne" })
      .locator('[aria-current="page"]'),
  ).toHaveText("Ustawienia");
});

test.describe("kurs EUR", () => {
  test("błędny kurs jest odrzucony, poprawny zapisany (SPEC 7.1)", async ({
    page,
    authUserId,
  }) => {
    await page.goto("/ustawienia");
    await expect(rateField(page)).toHaveValue("");

    await saveRate(page, "4,28501");
    await expect(page.getByText(MESSAGES.eurRate)).toBeVisible();
    await expect(rateField(page)).toHaveValue("4,28501");
    await expect(rateField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await storedRate(authUserId)).toBeNull();

    await saveRate(page, "4.3");
    await expect(page.getByRole("status")).toHaveText("Zapisano kurs.");
    await expect(page.getByText(MESSAGES.eurRate)).toBeHidden();
    expect(await storedRate(authUserId)).toBe(43000);

    await page.reload();
    await expect(rateField(page)).toHaveValue("4,3000");
  });

  test("zmiana kursu nie zmienia wartości źródła w EUR", async ({
    page,
    seed,
  }) => {
    const id = await seed.addSource({
      name: "Konto EUR",
      kind: "savings",
      currency: "EUR",
      value: 100000,
    });
    await page.goto("/ustawienia");
    await saveRate(page, "4,2850");
    await expect(page.getByRole("status")).toHaveText("Zapisano kurs.");
    await saveRate(page, "4,5000");
    await expect(page.getByRole("status")).toHaveText("Zapisano kurs.");

    const [row] = await getDb()
      .select({ value: sources.value })
      .from(sources)
      .where(eq(sources.id, id));
    expect(row.value).toBe(100000);
  });

  test("przy błędzie zapisu widać komunikat, a wpis zostaje (SPEC 7)", async ({
    page,
    authUserId,
  }) => {
    // Wymuszony błąd bazy: wyzwalacz odrzuca każdą zmianę ustawień. Gdyby
    // został po przerwanym teście, usuwa go `resetDatabase`.
    const db = getDb();
    await db.execute(sql`
      create or replace function e2e_fail_write() returns trigger
      language plpgsql as $$ begin raise exception 'wymuszony błąd zapisu'; end $$`);
    await db.execute(sql`
      create or replace trigger e2e_fail_settings before insert or update on settings
      for each row execute function e2e_fail_write()`);
    try {
      await page.goto("/ustawienia");
      await saveRate(page, "4,2850");
      await expect(rateSection(page).getByRole("alert")).toHaveText(
        SAVE_ERROR_MESSAGE,
      );
      await expect(rateField(page)).toHaveValue("4,2850");
      expect(await storedRate(authUserId)).toBeNull();
    } finally {
      await db.execute(sql`drop trigger e2e_fail_settings on settings`);
    }

    // Po ustąpieniu błędu ponowny zapis tej samej wartości się udaje.
    await page.getByRole("button", { name: "Zapisz kurs" }).click();
    await expect(page.getByRole("status")).toHaveText("Zapisano kurs.");
    await expect(rateSection(page).getByRole("alert")).toBeHidden();
    expect(await storedRate(authUserId)).toBe(42850);
  });
});

test.describe("motyw przy systemowym jasnym", () => {
  test.use({ colorScheme: "light" });

  test("ciemny zostaje po przeładowaniu, „Systemowy” wraca do systemu", async ({
    page,
    context,
  }) => {
    await page.goto("/ustawienia");
    await expect(page.getByRole("radio", { name: "Systemowy" })).toBeChecked();

    await page.getByText("Ciemny", { exact: true }).click();
    expect(await bodyBackground(page)).toBe(DARK_BG);
    await page.reload();
    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expect(page.getByRole("radio", { name: "Ciemny" })).toBeChecked();

    await page.getByText("Systemowy", { exact: true }).click();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "theme")).toBeUndefined();
    await page.reload();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expect(page.getByRole("radio", { name: "Systemowy" })).toBeChecked();
  });

  test("przycisk w nagłówku zmienia też zaznaczenie w Ustawieniach", async ({
    page,
  }) => {
    await page.goto("/ustawienia");
    await page.getByRole("button", { name: "Włącz motyw ciemny" }).click();
    await expect(page.getByRole("radio", { name: "Ciemny" })).toBeChecked();
    await page.getByRole("button", { name: "Włącz motyw jasny" }).click();
    await expect(page.getByRole("radio", { name: "Jasny" })).toBeChecked();
  });
});

test.describe("motyw przy systemowym ciemnym", () => {
  test.use({ colorScheme: "dark" });

  test("powrót z jasnego do „Systemowy” daje ciemny", async ({ page }) => {
    await page.goto("/ustawienia");
    await page.getByText("Jasny", { exact: true }).click();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await page.getByText("Systemowy", { exact: true }).click();
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`360 px, motyw ${colorScheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme });

    test("Ustawienia bez przewijania w poziomie", async ({ page }) => {
      await page.goto("/ustawienia");
      await expect(
        page.getByRole("button", { name: "Wyloguj się" }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      for (const name of ["Jasny", "Ciemny", "Systemowy"]) {
        const option = page.getByText(name, { exact: true });
        expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
