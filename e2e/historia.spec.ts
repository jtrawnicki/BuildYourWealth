import { type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { goals } from "@/db/schema";
import { now } from "@/domain/clock";
import { formatDate } from "@/domain/format";
import { formatMonthTitle } from "@/domain/month-name";
import { currentMonth, lastDayOfMonth, previousMonth } from "@/domain/time";
import { expect, test, type Seed } from "./fixtures";

// Kwoty na ekranie mają twarde spacje (SPEC 8); w oczekiwaniach piszemy zwykłe.
const text = (value: string) => value.replace(/ /g, " ");

const previous = previousMonth(currentMonth(now()));
const twoAgo = previousMonth(previous);

const monthRegion = (page: Page, month: string) =>
  page.getByRole("region", { name: formatMonthTitle(month), exact: true });
const goalRow = (region: Locator, name: string) =>
  region.getByRole("listitem").filter({ hasText: name });

async function submit(button: Locator) {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

/** Rozliczony miesiąc z jednym celem oszczędności: plan `planPct` puli × celu. */
async function seedSettledSavings(
  seed: Seed,
  opts: {
    month: string;
    income: number;
    savingsPct: number;
    goalPct: number;
    actual: number;
    goalName?: string;
  },
): Promise<number> {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  const goalId = await seed.addGoal(source, {
    name: opts.goalName ?? "Poduszka",
    pct: opts.goalPct,
  });
  await seed.addMonth({
    month: opts.month,
    settled: true,
    savingsPct: opts.savingsPct,
    incomes: [{ name: "Pensja", amount: opts.income }],
    snapshot: [{ goalId, actualAmount: opts.actual }],
  });
  return goalId;
}

test("bez sesji Historia przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/historia");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("bez sesji edycja przychodów przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(`/przychody/${previous}`);
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("pusta historia pokazuje zachętę", async ({ page }) => {
  await page.goto("/historia");
  await expect(page.getByRole("heading", { name: "Historia" })).toBeVisible();
  await expect(
    page.getByText("Nie masz jeszcze żadnych miesięcy"),
  ).toBeVisible();
});

test("rozliczenie częściowe: historia pokazuje plan 980,00 i wykonanie 500,00 (scen. 5)", async ({
  page,
  seed,
}) => {
  // Przychód 9 800, oszczędności 20%, cel 50% → plan 980,00; wpłata 500,00.
  await seedSettledSavings(seed, {
    month: previous,
    income: 980000,
    savingsPct: 2000,
    goalPct: 5000,
    actual: 50000,
  });
  await page.goto("/historia");

  const region = monthRegion(page, previous);
  await expect(region).toContainText("Rozliczony");
  const row = goalRow(region, "Poduszka");
  await expect(row).toContainText("plan");
  await expect(row).toContainText(text("980,00 zł"));
  await expect(row).toContainText("wykonanie");
  await expect(row).toContainText(text("500,00 zł"));
});

test("zmiana planu nie zmienia historii istniejącego miesiąca (scen. 8)", async ({
  page,
  seed,
}) => {
  await seedSettledSavings(seed, {
    month: previous,
    income: 980000,
    savingsPct: 2000,
    goalPct: 5000,
    actual: 98000,
  });
  await page.goto("/historia");
  const row = goalRow(monthRegion(page, previous), "Poduszka");
  await expect(row).toContainText(text("980,00 zł"));

  // Zmiana procentów pul w bieżącym planie nie rusza migawki rozliczonego miesiąca.
  await seed.setPools(1000, 0);
  await page.reload();
  const after = goalRow(monthRegion(page, previous), "Poduszka");
  await expect(after).toContainText(text("980,00 zł"));
  // 10% dałoby 490,00 zł — historia nie przelicza się na nowo.
  await expect(after).not.toContainText(text("490,00 zł"));
});

test("wykonanie celu EUR w EUR i PLN po kursie rozliczenia, odporne na zmianę kursu", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({
    name: "Konto EUR",
    kind: "investments",
    currency: "EUR",
  });
  const goalId = await seed.addGoal(source, { name: "Akcje", pct: 10000 });
  // Kurs rozliczenia 4,3000: wpłata 90,00 € = 387,00 zł.
  await seed.addMonth({
    month: previous,
    settled: true,
    investmentsPct: 1500,
    settledEurRate: 43000,
    incomes: [{ name: "Pensja", amount: 980000 }],
    snapshot: [{ goalId, actualAmount: 9000 }],
  });
  await page.goto("/historia");

  const row = goalRow(monthRegion(page, previous), "Akcje");
  await expect(row).toContainText(text("90,00 €"));
  await expect(row).toContainText(text("387,00 zł"));

  // Zmiana bieżącego kursu nie zmienia historii (liczona po kursie rozliczenia).
  await seed.setFallbackEurRate(50000);
  await page.reload();
  const after = goalRow(monthRegion(page, previous), "Akcje");
  await expect(after).toContainText(text("387,00 zł"));
  await expect(after).not.toContainText(text("450,00 zł"));
});

test("Historia pokazuje pochodzenie kursu rozliczenia (scen. 23, 39)", async ({
  page,
  seed,
}) => {
  const eurSrc = await seed.addSource({
    name: "Konto EUR",
    kind: "investments",
    currency: "EUR",
  });
  const goalId = await seed.addGoal(eurSrc, { name: "Akcje", pct: 10000 });
  const dayP = lastDayOfMonth(previous);
  // Miesiąc rozliczony po kursie NBP z datą tabeli (scen. 23).
  await seed.addMonth({
    month: previous,
    settled: true,
    investmentsPct: 1500,
    settledEurRate: 42650,
    settledRateSource: "nbp",
    settledRateDate: dayP,
    incomes: [{ name: "Pensja", amount: 980000 }],
    snapshot: [{ goalId, actualAmount: 9000 }],
  });
  // Starszy miesiąc rozliczony w MVP po kursie ręcznym (scen. 39).
  await seed.addMonth({
    month: twoAgo,
    settled: true,
    investmentsPct: 1500,
    settledEurRate: 43000,
    settledRateSource: "manual",
    incomes: [{ name: "Pensja", amount: 980000 }],
    snapshot: [{ goalId, actualAmount: 9000 }],
  });
  await page.goto("/historia");

  await expect(monthRegion(page, previous)).toContainText(
    "Kurs " + text("4,2650 zł") + ` (NBP, ${formatDate(dayP)})`,
  );
  await expect(monthRegion(page, twoAgo)).toContainText(
    "Kurs " + text("4,3000 zł") + " (ręczny, sprzed Etapu 2)",
  );
});

test("miesiąc bez celu EUR nie pokazuje kursu (scen. 39)", async ({
  page,
  seed,
}) => {
  await seedSettledSavings(seed, {
    month: previous,
    income: 980000,
    savingsPct: 2000,
    goalPct: 5000,
    actual: 98000,
  });
  await page.goto("/historia");
  await expect(monthRegion(page, previous)).toContainText("Rozliczony");
  await expect(monthRegion(page, previous)).not.toContainText("Kurs ");
});

test("zmiana nazwy celu widać także w starszych miesiącach", async ({
  page,
  seed,
}) => {
  const goalId = await seedSettledSavings(seed, {
    month: previous,
    income: 850000,
    savingsPct: 2000,
    goalPct: 10000,
    actual: 170000,
  });
  await page.goto("/historia");
  await expect(goalRow(monthRegion(page, previous), "Poduszka")).toBeVisible();

  await getDb()
    .update(goals)
    .set({ name: "Fundusz awaryjny" })
    .where(eq(goals.id, goalId));
  await page.reload();
  await expect(
    goalRow(monthRegion(page, previous), "Fundusz awaryjny"),
  ).toBeVisible();
});

test("nierozliczony miesiąc ma link do edycji przychodów, rozliczony nie", async ({
  page,
  seed,
}) => {
  // Starszy rozliczony i nowszy otwarty miesiąc.
  await seedSettledSavings(seed, {
    month: twoAgo,
    income: 850000,
    savingsPct: 2000,
    goalPct: 10000,
    actual: 170000,
  });
  await seed.addMonth({
    month: previous,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 500000 }],
  });
  await page.goto("/historia");

  await expect(
    monthRegion(page, previous).getByRole("link", { name: "Edytuj przychody" }),
  ).toBeVisible();
  await expect(
    monthRegion(page, twoAgo).getByRole("link", { name: "Edytuj przychody" }),
  ).toHaveCount(0);
});

test("z Historii wchodzę w edycję przychodów nierozliczonego miesiąca (SPEC 5.4)", async ({
  page,
  seed,
}) => {
  await seed.addMonth({
    month: previous,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 500000 }],
  });
  await page.goto("/historia");
  await monthRegion(page, previous)
    .getByRole("link", { name: "Edytuj przychody" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/przychody/${previous}$`));

  const region = page.getByRole("region", { name: formatMonthTitle(previous) });
  const pensja = region.getByRole("listitem", { name: "Pensja", exact: true });
  await pensja.getByRole("button", { name: "Edytuj Pensja" }).click();
  await pensja.getByLabel("Kwota netto (PLN)").fill("6 000,00");
  await submit(pensja.getByRole("button", { name: "Zapisz zmiany" }));
  await expect(region.getByRole("listitem", { name: "Pensja" })).toContainText(
    text("6 000,00 zł"),
  );
});
