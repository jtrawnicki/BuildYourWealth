import { type Locator, type Page } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { months } from "@/db/schema";
import { now } from "@/domain/clock";
import { MESSAGES } from "@/domain/input";
import { formatMonthTitle } from "@/domain/month-name";
import { currentMonth, previousMonth } from "@/domain/time";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { expect, test, type Seed } from "./fixtures";

// Kwoty na ekranie mają twarde spacje (SPEC 8); w oczekiwaniach piszemy zwykłe.
const text = (value: string) => value.replace(/ /g, " ");

const current = currentMonth(now());
const previous = previousMonth(current);
const twoAgo = previousMonth(previous);

const currentRegion = (page: Page) =>
  page.getByRole("region", { name: formatMonthTitle(current) });

// Karta bieżącego miesiąca z danymi jest domyślnie zwinięta (nagłówek + suma);
// rozwijamy ją, zanim wejdziemy w pozycje czy formularz. Pusty miesiąc jest już
// otwarty, więc helper klika tylko, gdy karta jest zwinięta.
async function openCurrent(page: Page) {
  const details = currentRegion(page).locator("details").first();
  await expect(details).toBeVisible();
  const isOpen = await details.evaluate(
    (el) => (el as HTMLDetailsElement).open,
  );
  if (!isOpen) {
    await currentRegion(page)
      .getByRole("heading", { name: formatMonthTitle(current) })
      .click();
    await expect(details).toHaveJSProperty("open", true);
  }
}
const previousRegion = (page: Page) =>
  page.getByRole("region", { name: "Poprzedni miesiąc" });
const planRegion = (page: Page) =>
  page.getByRole("region", { name: "Plan miesiąca" });
const wealthRegion = (page: Page) =>
  page.getByRole("region", { name: "Majątek", exact: true });
const card = (page: Page, title: string) =>
  page.getByRole("region", { name: title, exact: true });
const item = (region: Locator, name: string) =>
  region.getByRole("listitem", { name, exact: true });

/**
 * Plan ze scenariusza 1: Oszczędności 20% (Poduszka 50%, Wakacje 30%,
 * Rezerwa 20%), Inwestycje 15% (ETF 60%, Obligacje 25%, Akcje 15%). Zwraca
 * identyfikatory celów w kolejności dodania dla migawki miesiąca.
 */
async function seedScenarioOnePlan(seed: Seed): Promise<number[]> {
  const savings = await seed.addSource({
    name: "Konto oszczędnościowe",
    kind: "savings",
  });
  const invest = await seed.addSource({
    name: "Konto maklerskie",
    kind: "investments",
  });
  await seed.setPools(2000, 1500);
  // Cele dodajemy po kolei: wszystkie mają pozycję 0, więc o kolejności
  // wyświetlania decyduje id, a to zależy od kolejności wstawienia.
  const ids: number[] = [];
  ids.push(await seed.addGoal(savings, { name: "Poduszka", pct: 5000 }));
  ids.push(await seed.addGoal(savings, { name: "Wakacje", pct: 3000 }));
  ids.push(await seed.addGoal(savings, { name: "Rezerwa", pct: 2000 }));
  ids.push(await seed.addGoal(invest, { name: "ETF globalny", pct: 6000 }));
  ids.push(await seed.addGoal(invest, { name: "Obligacje", pct: 2500 }));
  ids.push(await seed.addGoal(invest, { name: "Akcje", pct: 1500 }));
  return ids;
}

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
  // Pierwszy przychód tworzy miesiąc i zwija kartę — rozwijamy ją, żeby zobaczyć
  // pozycje i dalej dodawać.
  await openCurrent(page);
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
  await openCurrent(page);
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

  // Ponowny przychód tworzy miesiąc z planem obowiązującym w tej chwili;
  // utworzenie miesiąca zwija kartę, więc rozwijamy ją przed sprawdzeniem.
  await addIncome(currentRegion(page), { name: "Pensja", amount: "500" });
  await openCurrent(page);
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
  // Udany zapis tworzy miesiąc i zwija kartę — rozwijamy ją przed sprawdzeniem.
  await openCurrent(page);
  await expect(currentRegion(page).getByRole("status")).toHaveText(
    "Dodano przychód.",
  );
});

test("plan miesiąca pokazuje pule, karty i do wydania (makieta B1, scen. 1)", async ({
  page,
  seed,
}) => {
  const goalIds = await seedScenarioOnePlan(seed);
  await seed.addMonth({
    month: current,
    savingsPct: 2000,
    investmentsPct: 1500,
    incomes: [
      { name: "Pensja", amount: 850000 },
      { name: "Premia", amount: 130000 },
    ],
    snapshot: goalIds.map((goalId) => ({ goalId })),
  });
  await page.goto("/");

  const plan = planRegion(page);
  await expect(plan).toContainText(text("odkładasz 3 430,00 zł"));
  await expect(plan).toContainText(text("do wydania zostaje 6 370,00 zł"));

  const savings = card(page, "Oszczędności");
  await expect(savings).toContainText(text("1 960,00 zł"));
  await expect(item(savings, "Poduszka")).toContainText(text("980,00 zł"));
  await expect(item(savings, "Wakacje")).toContainText(text("588,00 zł"));
  await expect(item(savings, "Rezerwa")).toContainText(text("392,00 zł"));

  const invest = card(page, "Inwestycje");
  await expect(invest).toContainText(text("1 470,00 zł"));
  await expect(item(invest, "ETF globalny")).toContainText(text("882,00 zł"));
  await expect(item(invest, "Obligacje")).toContainText(text("367,50 zł"));
  await expect(item(invest, "Akcje")).toContainText(text("220,50 zł"));
});

test("reszta z zaokrągleń trafia do do wydania (scen. 14)", async ({
  page,
  seed,
}) => {
  const goalIds = await seedScenarioOnePlan(seed);
  await seed.addMonth({
    month: current,
    savingsPct: 2000,
    investmentsPct: 1500,
    incomes: [{ name: "Pensja", amount: 965000 }],
    snapshot: goalIds.map((goalId) => ({ goalId })),
  });
  await page.goto("/");

  const plan = planRegion(page);
  await expect(card(page, "Oszczędności")).toContainText(text("1 930,00 zł"));
  await expect(card(page, "Inwestycje")).toContainText(text("1 447,49 zł"));
  await expect(plan).toContainText(text("do wydania zostaje 6 272,51 zł"));
});

test("cel z osiągniętą kwotą docelową pokazuje osiągnięty, a plan dalej liczy wpłatę (scen. 10)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({
    name: "Konto celowe",
    kind: "savings",
  });
  await seed.setPools(2000, 0);
  const goalId = await seed.addGoal(source, {
    name: "Wakacje",
    pct: 10000,
    targetAmount: 500000,
  });
  // Rozliczony wrzesień wpłacił całą kwotę docelową na cel.
  await seed.addMonth({
    month: previous,
    settled: true,
    savingsPct: 2000,
    snapshot: [{ goalId, actualAmount: 500000 }],
  });
  await seed.addMonth({
    month: current,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 850000 }],
    snapshot: [{ goalId }],
  });
  await page.goto("/");

  const row = item(card(page, "Oszczędności"), "Wakacje");
  await expect(row).toContainText("osiągnięty");
  await expect(row).not.toContainText("/");
  // Pula 20% z 8 500 zł, cel 100% → nadal planuje 1 700,00 zł.
  await expect(row).toContainText(text("1 700,00 zł"));
});

test("cel bez osiągnięcia pokazuje postęp z rozliczonych wpłat (scen. 11)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({
    name: "Konto celowe",
    kind: "savings",
  });
  await seed.setPools(2000, 0);
  const goalId = await seed.addGoal(source, {
    name: "Wakacje",
    pct: 10000,
    targetAmount: 500000,
    startAmount: 200000,
  });
  await seed.addMonth({
    month: previous,
    settled: true,
    savingsPct: 2000,
    snapshot: [{ goalId, actualAmount: 58800 }],
  });
  await seed.addMonth({
    month: current,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 850000 }],
    snapshot: [{ goalId }],
  });
  await page.goto("/");

  // 200 000 start + 58 800 wpłata = 258 800 groszy → 2 588 / 5 000 zł.
  await expect(item(card(page, "Oszczędności"), "Wakacje")).toContainText(
    text("2 588 / 5 000 zł"),
  );
});

test("cel w EUR ma drugą linię kwoty, a bez kursu link do ustawień (SPEC 5.4)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({
    name: "Konto maklerskie EUR",
    kind: "investments",
    currency: "EUR",
  });
  await seed.setPools(0, 1500);
  const goalId = await seed.addGoal(source, { name: "Akcje", pct: 10000 });
  await seed.addMonth({
    month: current,
    investmentsPct: 1500,
    incomes: [{ name: "Pensja", amount: 980000 }],
    snapshot: [{ goalId }],
  });

  // Bez kursu: zamiast kwoty EUR link „Ustaw kurs EUR".
  await page.goto("/");
  const row = item(card(page, "Inwestycje"), "Akcje");
  await expect(row.getByRole("link", { name: "Ustaw kurs EUR" })).toBeVisible();

  // Z kursem 4,3000: 1 470,00 zł ≈ 341,86 €.
  await seed.setEurRate(43000);
  await page.reload();
  await expect(item(card(page, "Inwestycje"), "Akcje")).toContainText(
    text("≈ 341,86 €"),
  );
});

test("pasek majątku pokazuje sumę i liczbę źródeł, a bez kursu prosi o kurs (scen. 16, SPEC 7)", async ({
  page,
  seed,
}) => {
  await seed.addSource({ name: "Konto", kind: "savings", value: 1000000 });
  await seed.addSource({ name: "Lokata", kind: "savings", value: 42380000 });
  await page.goto("/");
  await expect(wealthRegion(page)).toContainText("2 źródła");
  await expect(wealthRegion(page)).toContainText(text("433 800,00 zł"));

  // Dodanie źródła EUR bez kursu: pasek prosi o kurs zamiast sumy.
  await seed.addSource({
    name: "Konto EUR",
    kind: "investments",
    currency: "EUR",
    value: 100000,
  });
  await page.reload();
  await expect(wealthRegion(page)).toContainText("3 źródła");
  await expect(
    wealthRegion(page).getByRole("link", { name: "Ustaw kurs EUR" }),
  ).toBeVisible();
  await expect(wealthRegion(page)).not.toContainText("zł");
});

test("rozliczony miesiąc pokazuje kwoty faktyczne jako główne, plan niżej (SPEC 5.4)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  await seed.setPools(2000, 0);
  const goalId = await seed.addGoal(source, { name: "Poduszka", pct: 10000 });
  await seed.addMonth({
    month: current,
    settled: true,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 850000 }],
    snapshot: [{ goalId, actualAmount: 150000 }],
  });
  await page.goto("/");

  await expect(currentRegion(page)).toContainText("Miesiąc rozliczony");

  // Główna liczba celu i suma puli to wykonanie (1 500,00 zł), plan w drugiej linii.
  const savings = card(page, "Oszczędności");
  await expect(savings).toContainText(text("1 500,00 zł"));
  const row = item(savings, "Poduszka");
  await expect(row).toContainText(text("1 500,00 zł"));
  await expect(row).toContainText("plan:");
  await expect(row).toContainText(text("1 700,00 zł"));

  // Zdanie z faktycznymi kwotami w czasie przeszłym, bez zapowiedzi rozliczenia.
  const plan = planRegion(page);
  await expect(plan).toContainText(text("odłożono 1 500,00 zł"));
  await expect(plan).toContainText(text("zostało 7 000,00 zł"));
  await expect(plan).not.toContainText("odkładasz");
  await expect(plan).not.toContainText("potwierdzisz");
});

test("rozliczony miesiąc z celem EUR: wpłata w EUR z przelicznikiem i suma w PLN (SPEC 5.4, 6.8)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({
    name: "Konto EUR",
    kind: "investments",
    currency: "EUR",
  });
  await seed.setPools(0, 1500);
  const goalId = await seed.addGoal(source, { name: "Akcje", pct: 10000 });
  // Kurs rozliczenia 4,3000: wpłata 90,00 € = 387,00 zł.
  await seed.addMonth({
    month: current,
    settled: true,
    investmentsPct: 1500,
    settledEurRate: 43000,
    incomes: [{ name: "Pensja", amount: 980000 }],
    snapshot: [{ goalId, actualAmount: 9000 }],
  });
  await page.goto("/");

  const row = item(card(page, "Inwestycje"), "Akcje");
  await expect(row).toContainText(text("90,00 €"));
  await expect(row).toContainText(text("387,00 zł"));
  // Suma puli i zdanie liczą się z wpłaty przeliczonej kursem rozliczenia.
  await expect(card(page, "Inwestycje")).toContainText(text("387,00 zł"));
  await expect(planRegion(page)).toContainText(text("odłożono 387,00 zł"));
});

test("zaległe miesiące mają pigułki od najstarszego i znikają po rozliczeniu (scen. 7)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  await seed.setPools(2000, 0);
  const goalId = await seed.addGoal(source, { name: "Poduszka", pct: 10000 });
  // Dwa nierozliczone miesiące z przeszłości, wstawione w odwrotnej kolejności,
  // żeby test sprawdzał sortowanie od najstarszego, a nie kolejność wstawienia.
  for (const month of [previous, twoAgo]) {
    await seed.addMonth({
      month,
      savingsPct: 2000,
      incomes: [{ name: "Pensja", amount: 850000 }],
      snapshot: [{ goalId }],
    });
  }

  await page.goto("/");
  const pills = page.getByRole("list", { name: "Zaległe miesiące" });
  const items = pills.getByRole("listitem");
  await expect(items).toHaveCount(2);
  // Od najstarszego: twoAgo przed previous.
  await expect(items.nth(0)).toContainText(
    `${formatMonthTitle(twoAgo)} czeka na rozliczenie.`,
  );
  await expect(items.nth(1)).toContainText(
    `${formatMonthTitle(previous)} czeka na rozliczenie.`,
  );

  // „Rozlicz" najstarszego prowadzi na jego rozliczenie i je zatwierdzamy.
  await items.nth(0).getByRole("link", { name: "Rozlicz" }).click();
  await expect(page).toHaveURL(new RegExp(`/rozliczenie/${twoAgo}$`));
  await submit(page.getByRole("button", { name: "Zatwierdź rozliczenie" }));
  await expect(page).toHaveURL(/\/$/);

  // Zaległość znika; zostaje tylko nowszy miesiąc.
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText(
    `${formatMonthTitle(previous)} czeka na rozliczenie.`,
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`360 px, motyw ${colorScheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme });

    test("Ten miesiąc z planem bez przewijania w poziomie", async ({
      page,
      seed,
    }) => {
      const goalIds = await seedScenarioOnePlan(seed);
      await seed.addMonth({
        month: current,
        savingsPct: 2000,
        investmentsPct: 1500,
        incomes: [
          {
            name: "Wynagrodzenie z bardzo długą nazwą pozycji",
            amount: 850000,
          },
        ],
        snapshot: goalIds.map((goalId) => ({ goalId })),
      });
      await page.goto("/");
      await openCurrent(page);
      await expect(planRegion(page)).toBeVisible();
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
