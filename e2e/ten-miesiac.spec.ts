import { type Locator, type Page } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { months } from "@/db/schema";
import { now } from "@/domain/clock";
import { MESSAGES } from "@/domain/input";
import { formatMonthTitle } from "@/domain/month-name";
import { currentMonth, previousMonth } from "@/domain/time";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { expect, test } from "./fixtures";

// Kwoty na ekranie mają twarde spacje (SPEC 8); w oczekiwaniach piszemy zwykłe.
const text = (value: string) => value.replace(/ /g, " ");

const current = currentMonth(now());
const previous = previousMonth(current);

const currentRegion = (page: Page) =>
  page.getByRole("region", { name: formatMonthTitle(current) });
const previousRegion = (page: Page) =>
  page.getByRole("region", { name: "Poprzedni miesiąc" });
const item = (region: Locator, name: string) =>
  region.getByRole("listitem", { name, exact: true });

async function submit(button: Locator) {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

async function addIncome(
  region: Locator,
  fields: { name: string; amount: string },
) {
  await region.getByLabel("Nazwa").fill(fields.name);
  await region.getByLabel("Kwota netto (PLN)").fill(fields.amount);
  await submit(region.getByRole("button", { name: "Dodaj przychód" }));
}

test("bez sesji strona główna przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("pusty stan i utworzenie bieżącego miesiąca pierwszym przychodem (SPEC 5.4, scen. 1)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(currentRegion(page)).toContainText("Wpisz przychód z");

  await addIncome(currentRegion(page), { name: "Pensja", amount: "8 500" });
  await expect(currentRegion(page).getByRole("status")).toHaveText(
    "Dodano przychód.",
  );
  await expect(item(currentRegion(page), "Pensja")).toContainText(
    text("8 500,00 zł"),
  );
  await expect(currentRegion(page)).toContainText(text("8 500,00 zł"));

  await addIncome(currentRegion(page), { name: "Premia", amount: "1 300" });
  await expect(currentRegion(page)).toContainText("Przychód łącznie");
  await expect(currentRegion(page)).toContainText(text("9 800,00 zł"));
});

test("edycja, usunięcie i skasowanie miesiąca po ostatniej pozycji (SPEC 7, P7)", async ({
  page,
  seed,
  authUserId,
}) => {
  await seed.addMonth({
    month: current,
    savingsPct: 2000,
    incomes: [
      { name: "Pensja", amount: 850000 },
      { name: "Premia", amount: 130000 },
    ],
  });

  await page.goto("/");
  const region = currentRegion(page);
  await expect(region).toContainText(text("9 800,00 zł"));

  // Edycja kwoty pozycji.
  const pensja = item(region, "Pensja");
  await pensja.getByRole("button", { name: "Edytuj Pensja" }).click();
  await pensja.getByLabel("Kwota netto (PLN)").fill("9 000,00");
  await submit(pensja.getByRole("button", { name: "Zapisz zmiany" }));
  await expect(item(region, "Pensja")).toContainText(text("9 000,00 zł"));
  await expect(region).toContainText(text("10 300,00 zł"));

  // Usunięcie jednej pozycji: miesiąc zostaje.
  const premia = item(region, "Premia");
  await premia.getByRole("button", { name: "Usuń Premia" }).click();
  await submit(premia.getByRole("button", { name: "Tak, usuń" }));
  await expect(item(region, "Premia")).toBeHidden();
  await expect(region).toContainText(text("9 000,00 zł"));

  // Usunięcie ostatniej pozycji: miesiąc znika, wraca pusty stan.
  const last = item(region, "Pensja");
  await last.getByRole("button", { name: "Usuń Pensja" }).click();
  await submit(last.getByRole("button", { name: "Tak, usuń" }));
  await expect(currentRegion(page)).toContainText("Wpisz przychód z");
  await expect(currentRegion(page)).not.toContainText("Przychód łącznie");

  const remaining = await getDb()
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.userId, authUserId), eq(months.month, current)));
  expect(remaining).toHaveLength(0);

  // Ponowny przychód tworzy miesiąc z planem obowiązującym w tej chwili.
  await addIncome(currentRegion(page), { name: "Pensja", amount: "500" });
  await expect(item(currentRegion(page), "Pensja")).toBeVisible();
});

test("utworzenie poprzedniego miesiąca wpisaniem przychodu (scen. 18)", async ({
  page,
  authUserId,
}) => {
  await page.goto("/");
  await expect(previousRegion(page)).toContainText(formatMonthTitle(previous));

  await addIncome(previousRegion(page), {
    name: "Pensja",
    amount: "5 000",
  });
  // Po utworzeniu poprzedni miesiąc nie jest już pusty: sekcja tworzenia znika.
  await expect(previousRegion(page)).toBeHidden();

  const created = await getDb()
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.userId, authUserId), eq(months.month, previous)));
  expect(created).toHaveLength(1);
});

test("rozliczony miesiąc jest tylko do odczytu (SPEC 5.4)", async ({
  page,
  seed,
}) => {
  await seed.addMonth({
    month: current,
    settled: true,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 850000 }],
  });
  await page.goto("/");
  const region = currentRegion(page);
  await expect(region).toContainText("Miesiąc rozliczony");
  await expect(
    region.getByRole("button", { name: "Edytuj Pensja" }),
  ).toHaveCount(0);
  await expect(region.getByRole("button", { name: "Usuń Pensja" })).toHaveCount(
    0,
  );
  await expect(
    region.getByRole("button", { name: "Dodaj przychód" }),
  ).toHaveCount(0);
});

test("błędne pola dają komunikaty z SPEC 7.1, a wpis zostaje", async ({
  page,
}) => {
  await page.goto("/");
  const region = currentRegion(page);
  await addIncome(region, { name: "  ", amount: "8,500" });
  await expect(region.getByText(MESSAGES.name)).toBeVisible();
  await expect(region.getByText(MESSAGES.amount)).toBeVisible();
  await expect(region.getByLabel("Kwota netto (PLN)")).toHaveValue("8,500");

  await region.getByLabel("Nazwa").fill("Zwrot");
  await region.getByLabel("Kwota netto (PLN)").fill("0");
  await submit(region.getByRole("button", { name: "Dodaj przychód" }));
  await expect(region.getByText(MESSAGES.incomePositive)).toBeVisible();
});

test("przy błędzie zapisu widać komunikat, a wpis zostaje (SPEC 7)", async ({
  page,
}) => {
  const db = getDb();
  await db.execute(sql`
    create or replace function e2e_fail_write() returns trigger
    language plpgsql as $$ begin raise exception 'wymuszony błąd zapisu'; end $$`);
  await db.execute(sql`
    create or replace trigger e2e_fail_incomes before insert on incomes
    for each row execute function e2e_fail_write()`);
  try {
    await page.goto("/");
    const region = currentRegion(page);
    await addIncome(region, { name: "Pensja", amount: "8 500" });
    await expect(region.getByRole("alert")).toHaveText(SAVE_ERROR_MESSAGE);
    await expect(region.getByLabel("Nazwa")).toHaveValue("Pensja");
    await expect(region.getByLabel("Kwota netto (PLN)")).toHaveValue("8 500");
  } finally {
    await db.execute(sql`drop trigger e2e_fail_incomes on incomes`);
  }

  await submit(
    currentRegion(page).getByRole("button", { name: "Dodaj przychód" }),
  );
  await expect(currentRegion(page).getByRole("status")).toHaveText(
    "Dodano przychód.",
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`360 px, motyw ${colorScheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme });

    test("Ten miesiąc bez przewijania w poziomie", async ({ page, seed }) => {
      await seed.addMonth({
        month: current,
        savingsPct: 2000,
        incomes: [
          {
            name: "Wynagrodzenie z bardzo długą nazwą pozycji",
            amount: 850000,
          },
        ],
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Edytuj" }).first().click();
      await expect(
        page.getByRole("button", { name: "Zapisz zmiany" }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  });
}
