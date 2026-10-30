import { type Locator, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { SOURCE_MESSAGES } from "@/app/(app)/majatek/state";
import { getDb } from "@/db/client";
import { sources } from "@/db/schema";
import { now } from "@/domain/clock";
import { MESSAGES } from "@/domain/input";
import { formatMonthTitle } from "@/domain/month-name";
import { currentMonth, lastDayOfMonth, previousMonth } from "@/domain/time";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { seedRates } from "./db";
import { expect, test } from "./fixtures";

// Kwoty na ekranie mają twarde spacje (SPEC 8); w oczekiwaniach piszemy zwykłe.
const text = (value: string) => value.replace(/ /g, " ");

const summary = (page: Page) =>
  page.getByRole("region", { name: /Majątek łącznie/ });
const addSection = (page: Page) =>
  page.getByRole("region", { name: "Dodaj źródło" });
const item = (page: Page, name: string) =>
  page.getByRole("listitem", { name, exact: true });

async function submit(button: Locator) {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

async function addSource(
  page: Page,
  fields: {
    name: string;
    value: string;
    kind?: string;
    currency?: string;
    rate?: string;
  },
) {
  const form = addSection(page);
  await form.getByLabel("Nazwa").fill(fields.name);
  if (fields.kind) await form.getByText(fields.kind, { exact: true }).click();
  if (fields.currency) {
    await form.getByText(fields.currency, { exact: true }).click();
  }
  await form.getByLabel("Bieżąca wartość").fill(fields.value);
  if (fields.rate !== undefined) {
    await form.getByLabel("Zakładana stopa zwrotu (opcjonalnie)").fill(
      fields.rate,
    );
  }
  await submit(form.getByRole("button", { name: "Dodaj źródło" }));
}

async function editValue(page: Page, name: string, value: string) {
  const row = item(page, name);
  await row.getByRole("button", { name: `Edytuj ${name}` }).click();
  await row.getByLabel("Bieżąca wartość").fill(value);
  await submit(row.getByRole("button", { name: "Zapisz zmiany" }));
  await expect(row.getByRole("button", { name: "Zapisz zmiany" })).toBeHidden();
}

async function tryArchive(page: Page, name: string) {
  const row = item(page, name);
  await row.getByRole("button", { name: `Zarchiwizuj ${name}` }).click();
  await submit(row.getByRole("button", { name: "Tak, zarchiwizuj" }));
}

test("bez sesji Majątek przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/majatek");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("zakładka Majątek jest aktywna, pusty stan pokazuje 0,00 zł", async ({
  page,
}) => {
  await page.goto("/majatek");
  await expect(
    page.getByRole("heading", { level: 1, name: "Majątek" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Menu główne" })
      .locator('[aria-current="page"]'),
  ).toHaveAccessibleName("Majątek");
  await expect(summary(page)).toContainText(text("(0 źródeł)"));
  await expect(summary(page)).toContainText(text("0,00 zł"));
});

test("dodanie źródeł: sumy, wartość EUR z przeliczeniem i prośba o kurs (SPEC 5.2, 7)", async ({
  page,
  seed,
}) => {
  await page.goto("/majatek");
  await addSource(page, { name: "Poduszka", value: "8 000" });
  await expect(addSection(page).getByRole("status")).toHaveText(
    "Dodano źródło.",
  );
  await expect(addSection(page).getByLabel("Nazwa")).toHaveValue("");

  await addSource(page, {
    name: "Konto EUR",
    value: "1051,28",
    kind: "Inwestycja",
    currency: "EUR",
  });
  const eur = item(page, "Konto EUR");
  await expect(eur).toContainText(text("1 051,28 €"));
  await expect(eur.getByRole("link", { name: "Ustaw kurs EUR" })).toBeVisible();
  await expect(summary(page)).toContainText(
    "Ustaw kurs EUR, żeby zobaczyć sumę majątku.",
  );
  await expect(summary(page)).toContainText(text("8 000,00 zł"));
  await expect(summary(page)).toContainText("wymaga kursu EUR");
  expect(await seed.countSources()).toBe(2);

  // Scen. 6: 1 051,28 € po kursie 4,3000 to 4 520,50 zł.
  await seed.setFallbackEurRate(43000);
  await page.reload();
  await expect(eur).toContainText(text("≈ 4 520,50 zł"));
  await expect(summary(page)).toContainText(text("(2 źródła)"));
  await expect(summary(page)).toContainText(text("12 520,50 zł"));
  await expect(
    page.getByRole("region", { name: "Oszczędności" }),
  ).toContainText("Poduszka");
  await expect(page.getByRole("region", { name: "Inwestycje" })).toContainText(
    "Konto EUR",
  );
});

test("błędne pola dają komunikaty z SPEC 7.1, a wpis zostaje", async ({
  page,
  seed,
}) => {
  await page.goto("/majatek");
  await addSource(page, { name: "  ", value: "12,345" });
  const form = addSection(page);
  await expect(form.getByText(MESSAGES.name)).toBeVisible();
  await expect(form.getByText(MESSAGES.amount)).toBeVisible();
  await expect(form.getByLabel("Bieżąca wartość")).toHaveValue("12,345");
  await expect(form.getByLabel("Bieżąca wartość")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await form.getByLabel("Nazwa").fill("x".repeat(61));
  await form.getByLabel("Bieżąca wartość").fill("-1");
  await submit(form.getByRole("button", { name: "Dodaj źródło" }));
  await expect(form.getByText(MESSAGES.name)).toBeVisible();
  await expect(form.getByText(MESSAGES.amount)).toBeVisible();
  expect(await seed.countSources()).toBe(0);
});

test("zakładana stopa zwrotu: zapis, zakres i wyczyszczenie (scen. 43)", async ({
  page,
  seed,
}) => {
  await page.goto("/majatek");

  // „60” spoza zakresu jest odrzucone komunikatem z SPEC 7.1, a wpis zostaje.
  await addSource(page, { name: "Makler", value: "1 000", rate: "60" });
  const form = addSection(page);
  await expect(form.getByText(MESSAGES.expectedReturn)).toBeVisible();
  await expect(
    form.getByLabel("Zakładana stopa zwrotu (opcjonalnie)"),
  ).toHaveValue("60");
  expect(await seed.countSources()).toBe(0);

  // „6,5” zapisuje 6,50% i pokazuje stopę przy źródle.
  await form.getByLabel("Zakładana stopa zwrotu (opcjonalnie)").fill("6,5");
  await submit(form.getByRole("button", { name: "Dodaj źródło" }));
  const makler = item(page, "Makler");
  await expect(makler).toContainText(text("stopa 6,50%"));

  // „−10” jest przyjęte (ujemna stopa, SPEC P31).
  await addSource(page, { name: "Fundusz", value: "500", rate: "−10" });
  await expect(item(page, "Fundusz")).toContainText(text("stopa -10,00%"));

  // Wyczyszczenie pola usuwa stopę ze źródła.
  const row = item(page, "Makler");
  await row.getByRole("button", { name: "Edytuj Makler" }).click();
  await row.getByLabel("Zakładana stopa zwrotu (opcjonalnie)").fill("");
  await submit(row.getByRole("button", { name: "Zapisz zmiany" }));
  await expect(row.getByRole("button", { name: "Zapisz zmiany" })).toBeHidden();
  await expect(item(page, "Makler")).not.toContainText("stopa");
});

test("wypłata: zmniejszenie wartości źródła zmniejsza sumę majątku (scen. 9)", async ({
  page,
  seed,
}) => {
  await seed.addSource({ name: "Poduszka", kind: "savings", value: 1_000_000 });
  await seed.addSource({ name: "ETF", kind: "investments", value: 500_000 });
  await page.goto("/majatek");
  await expect(summary(page)).toContainText(text("15 000,00 zł"));

  await editValue(page, "Poduszka", "7 500,00");
  await expect(item(page, "Poduszka")).toContainText(text("7 500,00 zł"));
  await expect(summary(page)).toContainText(text("12 500,00 zł"));
});

test("edycja nazwy i notatki; typ i waluta połączonego źródła są zablokowane (SPEC 5.2)", async ({
  page,
  seed,
}) => {
  const linked = await seed.addSource({ name: "IKE", kind: "investments" });
  await seed.addGoal(linked);
  await seed.addSource({ name: "Lokata", kind: "savings" });
  await page.goto("/majatek");

  const ike = item(page, "IKE");
  await ike.getByRole("button", { name: "Edytuj IKE" }).click();
  await expect(ike).toContainText("Inwestycja · PLN");
  await expect(ike).toContainText(
    "Nie można ich zmienić, bo źródło jest połączone z celem",
  );
  await expect(ike.getByRole("radio")).toHaveCount(0);
  await ike.getByLabel("Nazwa").fill("IKE obligacje");
  await ike.getByLabel("Notatka lub instytucja (opcjonalnie)").fill("PKO");
  await submit(ike.getByRole("button", { name: "Zapisz zmiany" }));
  const renamed = item(page, "IKE obligacje");
  await expect(renamed).toContainText("PKO");

  // Źródło bez celu może zmienić typ i walutę.
  const deposit = item(page, "Lokata");
  await deposit.getByRole("button", { name: "Edytuj Lokata" }).click();
  await deposit.getByText("Inwestycja", { exact: true }).click();
  await deposit.getByText("EUR", { exact: true }).click();
  await submit(deposit.getByRole("button", { name: "Zapisz zmiany" }));
  await expect(
    page.getByRole("region", { name: "Inwestycje" }).getByText("Lokata"),
  ).toBeVisible();
  await expect(deposit).toContainText(text("0,00 €"));
});

test("archiwizacja: blokada przy wartości > 0 i przy celu, potem znika z sum (scen. 16)", async ({
  page,
  seed,
}) => {
  const id = await seed.addSource({
    name: "Rachunek",
    kind: "savings",
    value: 50_000,
  });
  const goal = await seed.addGoal(id);
  await seed.addSource({ name: "Poduszka", kind: "savings", value: 100_000 });
  await page.goto("/majatek");
  await expect(summary(page)).toContainText(text("(2 źródła)"));

  await tryArchive(page, "Rachunek");
  const row = item(page, "Rachunek");
  await expect(row.getByRole("alert")).toHaveText(SOURCE_MESSAGES.hasValue);
  await row.getByRole("button", { name: "Zamknij" }).click();

  await editValue(page, "Rachunek", "0");
  await tryArchive(page, "Rachunek");
  await expect(row.getByRole("alert")).toHaveText(SOURCE_MESSAGES.inUse);
  await row.getByRole("button", { name: "Zamknij" }).click();

  await seed.removeGoal(goal);
  await tryArchive(page, "Rachunek");
  await expect(row).toBeHidden();
  await expect(summary(page)).toContainText(text("(1 źródło)"));
  await expect(summary(page)).toContainText(text("1 000,00 zł"));

  const [stored] = await getDb()
    .select({ archivedAt: sources.archivedAt })
    .from(sources)
    .where(eq(sources.id, id));
  expect(stored.archivedAt).not.toBeNull();
  await page.reload();
  await expect(page.getByText("Rachunek")).toBeHidden();
});

test("anulowanie archiwizacji niczego nie zmienia", async ({ page, seed }) => {
  await seed.addSource({ name: "Pusta lokata", kind: "savings" });
  await page.goto("/majatek");
  const row = item(page, "Pusta lokata");
  await row.getByRole("button", { name: "Zarchiwizuj Pusta lokata" }).click();
  await row.getByRole("button", { name: "Anuluj" }).click();
  await page.reload();
  await expect(item(page, "Pusta lokata")).toBeVisible();
});

test("przy błędzie zapisu widać komunikat, a wpis zostaje (SPEC 7)", async ({
  page,
  seed,
}) => {
  const db = getDb();
  await db.execute(sql`
    create or replace function e2e_fail_write() returns trigger
    language plpgsql as $$ begin raise exception 'wymuszony błąd zapisu'; end $$`);
  await db.execute(sql`
    create or replace trigger e2e_fail_sources before insert or update on sources
    for each row execute function e2e_fail_write()`);
  try {
    await page.goto("/majatek");
    await addSource(page, { name: "Poduszka", value: "100" });
    await expect(addSection(page).getByRole("alert")).toHaveText(
      SAVE_ERROR_MESSAGE,
    );
    await expect(addSection(page).getByLabel("Nazwa")).toHaveValue("Poduszka");
    await expect(addSection(page).getByLabel("Bieżąca wartość")).toHaveValue(
      "100",
    );
    expect(await seed.countSources()).toBe(0);
  } finally {
    await db.execute(sql`drop trigger e2e_fail_sources on sources`);
  }

  await submit(addSection(page).getByRole("button", { name: "Dodaj źródło" }));
  await expect(addSection(page).getByRole("status")).toHaveText(
    "Dodano źródło.",
  );
  expect(await seed.countSources()).toBe(1);
});

const chartCard = (page: Page) =>
  page.getByRole("region", { name: "Wartość majątku" });

/** Chwila dnia `day` miesiąca `YYYY-MM` o 12:00 UTC (bezpiecznie w Europe/Warsaw). */
function dayOf(monthKey: string, day: number): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/**
 * Historia scenariusza 25 w poprzednim miesiącu: źródło PLN na 1 108 800
 * (10 500 + rozliczenie 588) i źródło EUR 1 000,00 €, z kursem 4,2500 na koniec
 * miesiąca — punkt wykresu „15 338,00 zł". Bieżący miesiąc daje drugi punkt.
 */
async function seedTwoMonthHistory(seed: {
  addSource: (i: {
    name: string;
    kind: "savings" | "investments";
    currency?: "PLN" | "EUR";
    value?: number;
  }) => Promise<number>;
  addSourceValue: (i: {
    sourceId: number;
    value: number;
    recordedAt: Date;
    currency?: "PLN" | "EUR";
    reason?: "initial" | "created" | "manual" | "settlement" | "archived";
  }) => Promise<void>;
  setFallbackEurRate: (r: number) => Promise<void>;
}): Promise<string> {
  const previous = previousMonth(currentMonth(now()));
  const pln = await seed.addSource({
    name: "Konto",
    kind: "savings",
    value: 1_108_800,
  });
  const eur = await seed.addSource({
    name: "Akcje EUR",
    kind: "investments",
    currency: "EUR",
    value: 100_000,
  });
  await seed.addSourceValue({
    sourceId: pln,
    value: 1_000_000,
    recordedAt: dayOf(previous, 1),
    reason: "initial",
  });
  await seed.addSourceValue({
    sourceId: pln,
    value: 1_108_800,
    recordedAt: dayOf(previous, 20),
    reason: "settlement",
  });
  await seed.addSourceValue({
    sourceId: eur,
    value: 100_000,
    currency: "EUR",
    recordedAt: dayOf(previous, 1),
    reason: "initial",
  });
  return previous;
}

test("miesiąc wdrożenia: zamiast wykresu tekst o przyszłym miesiącu (scen. 26)", async ({
  page,
  seed,
}) => {
  await seed.addSource({ name: "Poduszka", kind: "savings", value: 500_000 });
  await page.goto("/majatek");
  await expect(chartCard(page)).toContainText(
    "Wykres pojawi się w przyszłym miesiącu.",
  );
  await expect(chartCard(page).getByRole("table")).toHaveCount(0);
});

test("wykres z dwoma punktami: koniec miesiąca ze źródłem EUR (scen. 25, 26)", async ({
  page,
  seed,
}) => {
  const previous = await seedTwoMonthHistory(seed);
  await seedRates([{ effectiveDate: lastDayOfMonth(previous), rate: 42_500 }]);
  await seed.setFallbackEurRate(42_500);
  await page.goto("/majatek");

  const srTable = chartCard(page).getByRole("table");
  await expect(srTable).toBeVisible();
  // Tabela dla czytników ekranu: punkt poprzedniego miesiąca = 15 338,00 zł.
  const prevRow = srTable.getByRole("row", {
    name: formatMonthTitle(previous),
  });
  await expect(prevRow).toContainText(text("15 338,00 zł"));
  // Dwa punkty: poprzedni i bieżący miesiąc.
  await expect(
    srTable.getByRole("row", {
      name: formatMonthTitle(currentMonth(now())),
    }),
  ).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`360 px, motyw ${colorScheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme });

    test("wykres majątku bez przewijania w poziomie (scen. 12)", async ({
      page,
      seed,
    }) => {
      const previous = await seedTwoMonthHistory(seed);
      await seedRates([
        { effectiveDate: lastDayOfMonth(previous), rate: 42_500 },
      ]);
      await seed.setFallbackEurRate(42_500);
      await page.goto("/majatek");
      await expect(chartCard(page).getByRole("table")).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });

    test("Majątek bez przewijania w poziomie", async ({ page, seed }) => {
      await seed.addSource({
        name: "Konto oszczędnościowe w banku z długą nazwą",
        kind: "savings",
        value: 123_456_789,
      });
      await seed.addSource({
        name: "Konto EUR",
        kind: "investments",
        currency: "EUR",
        value: 100_000,
      });
      await page.goto("/majatek");
      await page.getByRole("button", { name: "Edytuj Konto EUR" }).click();
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
