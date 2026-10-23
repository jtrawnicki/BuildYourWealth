import { type Locator, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { months, sources } from "@/db/schema";
import { now } from "@/domain/clock";
import { currentMonth, previousMonth } from "@/domain/time";
import { expect, test, type Seed } from "./fixtures";

// Rozliczamy poprzedni miesiąc: jest zawsze po ostatnim dniu, więc dostępność
// rozliczenia nie zależy od dnia uruchomienia testów (SPEC 5.5). Pigułkę do
// niego dokłada T13; tu wchodzimy prosto na ekran rozliczenia.
const previous = previousMonth(currentMonth(now()));

const text = (value: string) => value.replace(/ /g, " ");

const card = (page: Page, title: string) =>
  page.getByRole("region", { name: title, exact: true });
const row = (region: Locator, name: string) =>
  region.getByRole("listitem", { name, exact: true });

async function submit(button: Locator) {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

/**
 * Plan ze scenariusza 1 i poprzedni miesiąc z przychodem 9 800,00 zł. Przy
 * `eur` tylko cel „Akcje" ma źródło w EUR (wartość startowa 1 000,00 €); ETF
 * i Obligacje zostają na źródle PLN.
 */
async function seedSettleableMonth(
  seed: Seed,
  opts: { eur?: boolean; rate?: number } = {},
) {
  const savings = await seed.addSource({ name: "Konto osz.", kind: "savings" });
  const invest = await seed.addSource({
    name: "Konto makl.",
    kind: "investments",
  });
  const akcje = opts.eur
    ? await seed.addSource({
        name: "Konto EUR",
        kind: "investments",
        currency: "EUR",
        value: 100000,
      })
    : invest;
  await seed.setPools(2000, 1500);
  if (opts.rate) await seed.setEurRate(opts.rate);
  const ids: Record<string, number> = {
    poduszka: await seed.addGoal(savings, { name: "Poduszka", pct: 5000 }),
    wakacje: await seed.addGoal(savings, { name: "Wakacje", pct: 3000 }),
    rezerwa: await seed.addGoal(savings, { name: "Rezerwa", pct: 2000 }),
    etf: await seed.addGoal(invest, { name: "ETF", pct: 6000 }),
    obligacje: await seed.addGoal(invest, { name: "Obligacje", pct: 2500 }),
    akcje: await seed.addGoal(akcje, { name: "Akcje", pct: 1500 }),
  };
  await seed.addMonth({
    month: previous,
    savingsPct: 2000,
    investmentsPct: 1500,
    incomes: [
      { name: "Pensja", amount: 850000 },
      { name: "Premia", amount: 130000 },
    ],
    snapshot: Object.values(ids).map((goalId) => ({ goalId })),
  });
  return { savings, invest, akcje };
}

async function sourceValue(id: number): Promise<number> {
  const [r] = await getDb()
    .select({ value: sources.value })
    .from(sources)
    .where(eq(sources.id, id));
  return r.value;
}

async function settled(userId: number): Promise<boolean> {
  const [r] = await getDb()
    .select({ settledAt: months.settledAt })
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.month, previous)));
  return r.settledAt !== null;
}

test("bez sesji ekran rozliczenia przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(`/rozliczenie/${previous}`);
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("plan zrealizowany dopisuje zaplanowane kwoty do źródeł (scen. 4)", async ({
  page,
  seed,
  authUserId,
}) => {
  const src = await seedSettleableMonth(seed);
  await page.goto(`/rozliczenie/${previous}`);
  await expect(
    page.getByRole("heading", { name: "Czy udało się zrealizować plan?" }),
  ).toBeVisible();
  // Podtytuł planu: 1 960,00 + 1 470,00 = 3 430,00 zł na 6 celów (kwota
  // powtarza się w podsumowaniu, więc celujemy w jednoznaczny ogon podtytułu).
  await expect(page.getByText("na 6 celów")).toBeVisible();

  await submit(page.getByRole("button", { name: "Zatwierdź rozliczenie" }));
  await expect(page).toHaveURL(/\/$/);

  expect(await settled(authUserId)).toBe(true);
  // Oszczędności (jedno źródło): 980 + 588 + 392 = 1 960,00 zł.
  expect(await sourceValue(src.savings)).toBe(196000);
  // Inwestycje (jedno źródło): 882 + 367,50 + 220,50 = 1 470,00 zł.
  expect(await sourceValue(src.invest)).toBe(147000);
});

test("rozliczenie częściowe zapisuje wpisaną kwotę, nie plan (scen. 5)", async ({
  page,
  seed,
  authUserId,
}) => {
  const src = await seedSettleableMonth(seed);
  await page.goto(`/rozliczenie/${previous}`);

  await page
    .getByRole("radio", { name: "Nie, wpiszę faktyczne kwoty" })
    .click();
  const savings = card(page, "Oszczędności");
  // Poduszka: 500,00 zamiast planu 980,00; reszta zostaje na planie.
  await row(savings, "Poduszka")
    .getByLabel("Faktycznie wpłacono (PLN)")
    .fill("500,00");
  await submit(page.getByRole("button", { name: "Zatwierdź rozliczenie" }));
  await expect(page).toHaveURL(/\/$/);

  expect(await settled(authUserId)).toBe(true);
  // 500 (Poduszka) + 588 (Wakacje) + 392 (Rezerwa) = 1 480,00 zł.
  expect(await sourceValue(src.savings)).toBe(148000);
});

test("cel w EUR: plan przeliczony po kursie trafia do źródła EUR (scen. 6)", async ({
  page,
  seed,
  authUserId,
}) => {
  const src = await seedSettleableMonth(seed, { eur: true, rate: 43000 });
  await page.goto(`/rozliczenie/${previous}`);
  const invest = card(page, "Inwestycje");
  // Akcje: plan 220,50 zł → 51,28 € po kursie 4,3000.
  await expect(row(invest, "Akcje")).toContainText(text("51,28 €"));

  await submit(page.getByRole("button", { name: "Zatwierdź rozliczenie" }));
  await expect(page).toHaveURL(/\/$/);

  expect(await settled(authUserId)).toBe(true);
  // Akcje: źródło EUR 1 000,00 € + wpłata 51,28 € = 1 051,28 €.
  expect(await sourceValue(src.akcje)).toBe(105128);
  // ETF 882,00 + Obligacje 367,50 trafiają na źródło PLN inwestycji.
  expect(await sourceValue(src.invest)).toBe(88200 + 36750);
});

test("brak kursu przy celu EUR blokuje rozliczenie (SPEC 7)", async ({
  page,
  seed,
}) => {
  await seedSettleableMonth(seed, { eur: true });
  await page.goto(`/rozliczenie/${previous}`);
  // Pełny komunikat jest jednoznaczny (sam „kurs euro" jest też w linku).
  await expect(
    page.getByText(
      "Najpierw ustaw kurs euro w Ustawieniach, żeby rozliczyć cel w euro.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zatwierdź rozliczenie" }),
  ).toHaveCount(0);
});

test("ponowne wejście na rozliczony miesiąc pokazuje komunikat (scen. 15)", async ({
  page,
  seed,
}) => {
  const savings = await seed.addSource({ name: "Konto", kind: "savings" });
  await seed.setPools(2000, 0);
  const goalId = await seed.addGoal(savings, { name: "Poduszka", pct: 10000 });
  await seed.addMonth({
    month: previous,
    settled: true,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 850000 }],
    snapshot: [{ goalId, actualAmount: 170000 }],
  });
  await page.goto(`/rozliczenie/${previous}`);
  await expect(
    page.getByText("Ten miesiąc jest już rozliczony."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zatwierdź rozliczenie" }),
  ).toHaveCount(0);
});
