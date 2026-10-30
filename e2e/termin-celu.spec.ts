import { type Locator, type Page } from "@playwright/test";
import { now } from "@/domain/clock";
import {
  formatMonthName,
  formatMonthYear,
  formatMonthYearGenitive,
  formatMonthYearLocative,
} from "@/domain/month-name";
import { addMonths, currentMonth } from "@/domain/time";
import { expect, test, type Seed } from "./fixtures";

// Termin celu i prognoza (SPEC 5.12, scen. 27, 28, 37, 38). E2E działa na
// prawdziwej dacie, więc przykład prognozy ze SPEC 6 jest przesunięty: listopad
// 2026 z przykładu to tu bieżący miesiąc C, a sierpień–październik to C−3…C−1.

const C = currentMonth(now());
const month = (delta: number) => addMonths(C, delta);
const year = (key: string) => key.slice(0, 4);
const monthPart = (key: string) => key.slice(5);

const goalRow = (page: Page, name: string) =>
  page.locator(`[aria-label="Cel: ${name}"]`);
const transfer = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Plan miesiąca" })
    .getByRole("listitem", { name, exact: true });

async function setDeadline(row: Locator, key: string) {
  await row.getByLabel("Miesiąc terminu").selectOption(monthPart(key));
  await row.getByLabel("Rok terminu").selectOption(year(key));
}

async function save(page: Page) {
  const button = page.getByRole("button", { name: "Zapisz plan" });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
  await expect(page.getByText("Zapisano plan.")).toBeVisible();
}

/**
 * Przykład prognozy (SPEC 6): Oszczędności 20%, „Wakacje” 30% puli (kwota
 * docelowa 5 000, startowa 2 000) i „Poduszka” 70%; przychód 9 800 zł w każdym
 * miesiącu, rozliczone wpłaty Wakacji 588, 512 i 600 zł, bieżący miesiąc
 * istnieje i nie jest rozliczony.
 */
async function seedExample(
  seed: Seed,
  options: {
    deadline?: string;
    actuals?: number[];
    /** Bieżący miesiąc rozliczony (wpłata 0), więc P = następny miesiąc. */
    currentSettled?: boolean;
  } = {},
) {
  const {
    deadline,
    actuals = [58_800, 51_200, 60_000],
    currentSettled = false,
  } = options;
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  const wakacje = await seed.addGoal(source, {
    name: "Wakacje",
    pct: 3000,
    targetAmount: 500_000,
    startAmount: 200_000,
    deadline,
  });
  const poduszka = await seed.addGoal(source, { name: "Poduszka", pct: 7000 });
  await seed.setPools(2000, 0);
  const incomes = [{ name: "Pensja", amount: 980_000 }];
  for (const [i, actual] of actuals.entries()) {
    await seed.addMonth({
      month: month(i - 3),
      settled: true,
      savingsPct: 2000,
      incomes,
      snapshot: [
        { goalId: wakacje, actualAmount: actual },
        { goalId: poduszka, actualAmount: 0 },
      ],
    });
  }
  const actual = currentSettled ? 0 : undefined;
  await seed.addMonth({
    month: C,
    settled: currentSettled,
    savingsPct: 2000,
    incomes,
    snapshot: [
      { goalId: wakacje, actualAmount: actual },
      { goalId: poduszka, actualAmount: actual },
    ],
  });
}

test("bez sesji Plan podziału z terminem przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("termin zagrożony, potem zdążysz; procenty planu się nie zmieniają (scen. 27)", async ({
  page,
  seed,
}) => {
  await seedExample(seed, { deadline: month(1) });

  await page.goto("/");
  const line = transfer(page, "Wakacje");
  await expect(line).toContainText(
    `Termin: ${formatMonthYear(month(1))} · Ryzyko opóźnienia`,
  );
  await expect(
    line.getByRole("link", { name: "Ryzyko opóźnienia" }),
  ).toHaveAttribute("href", "/plan");

  await page.goto("/plan");
  const row = goalRow(page, "Wakacje");
  const note = row.getByRole("note");
  await expect(note).toContainText(
    `Do ${formatMonthYearGenitive(month(1))} brakuje 1 300,00 zł. ${formatMonthName(C)} ma już zaplanowane 588,00 zł, więc w każdym kolejnym miesiącu potrzebujesz 712,00 zł (średnio wpłacasz 566,66 zł).`,
  );
  await expect(note).toContainText(
    "Ustaw ok. 36,33% puli Oszczędności (teraz 30,00%) i zmniejsz pozostałe cele albo zwiększ procent puli.",
  );

  await setDeadline(row, month(4));
  await expect(note).toContainText(
    "w każdym kolejnym miesiącu potrzebujesz 178,00 zł",
  );
  await expect(note).not.toContainText("Ustaw ok.");
  await save(page);
  // Procenty planu nie zmieniają się same.
  await expect(row.getByLabel("% puli")).toHaveValue("30");

  await page.goto("/");
  await expect(transfer(page, "Wakacje")).toContainText(
    `Termin: ${formatMonthYear(month(4))} · Zgodnie z planem (ok. ${formatMonthYear(month(2))})`,
  );
});

test("cel bez terminu pokazuje prognozę, a przy wpłatach 0 — brak osiągnięcia (scen. 28)", async ({
  page,
  seed,
}) => {
  await seedExample(seed);
  await page.goto("/");
  await expect(transfer(page, "Wakacje")).toContainText(
    `Osiągniesz w ${formatMonthYearLocative(month(2))}`,
  );
});

test("wpłaty 0 z trzech ostatnich miesięcy: cel nie zostanie osiągnięty (scen. 28)", async ({
  page,
  seed,
}) => {
  await seedExample(seed, { actuals: [0, 0, 0] });
  await page.goto("/");
  await expect(transfer(page, "Wakacje")).toContainText(
    "Przy obecnych wpłatach cel nie zostanie osiągnięty",
  );
});

test("nowy procent nie zmienia statusu, ale dodaje dopisek (scen. 37)", async ({
  page,
  seed,
}) => {
  await seedExample(seed, { deadline: month(1) });

  await page.goto("/plan");
  await goalRow(page, "Wakacje").getByLabel("% puli").fill("36,33");
  await goalRow(page, "Poduszka").getByLabel("% puli").fill("63,67");
  await save(page);

  await page.goto("/");
  const line = transfer(page, "Wakacje");
  await expect(line).toContainText(
    `Termin: ${formatMonthYear(month(1))} · Ryzyko opóźnienia`,
  );
  await expect(line).toContainText(
    "Prognoza uwzględni nowy procent po rozliczeniu miesięcy z nowym planem.",
  );
});

test("cel spoza migawek: brak danych, wymagana wpłata i sugestia w Planie (scen. 38)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  const poduszka = await seed.addGoal(source, { name: "Poduszka", pct: 9000 });
  await seed.setPools(2000, 0);
  await seed.addMonth({
    month: C,
    savingsPct: 2000,
    incomes: [{ name: "Pensja", amount: 980_000 }],
    snapshot: [{ goalId: poduszka }],
  });
  // Cel dodany po utworzeniu bieżącego miesiąca (nie ma go w migawce).
  await seed.addGoal(source, {
    name: "Rower",
    pct: 1000,
    targetAmount: 300_000,
    deadline: month(7),
  });

  await page.goto("/plan");
  const note = goalRow(page, "Rower").getByRole("note");
  await expect(note).toContainText(
    `Termin: ${formatMonthYear(month(7))} · Brak danych`,
  );
  await expect(note).toContainText(
    "Prognoza pojawi się, gdy cel trafi do planu miesiąca.",
  );
  // 3 000 zł ÷ 7 miesięcy (C+1…C+7), w górę do grosza.
  await expect(note).toContainText(
    "W każdym kolejnym miesiącu potrzebujesz 428,58 zł.",
  );
  await expect(note).toContainText("Ustaw ok. 21,87% puli Oszczędności");
});

test("walidacja terminu: przed pierwszym miesiącem wpłaty i bez kwoty docelowej (SPEC 7.1)", async ({
  page,
  seed,
}) => {
  // Bieżący miesiąc rozliczony: pierwszy miesiąc wpłaty P to następny miesiąc,
  // więc bieżący jest już za wczesny (i zawsze jest na liście lat).
  await seedExample(seed, { currentSettled: true });
  await page.goto("/plan");
  const row = goalRow(page, "Wakacje");

  await setDeadline(row, C);
  await expect(row).toContainText(
    `Wybierz termin od ${formatMonthYearGenitive(month(1))}`,
  );
  await expect(
    page.getByRole("button", { name: "Zapisz plan" }),
  ).toBeDisabled();

  // Usunięcie kwoty docelowej usuwa termin (SPEC 5.12).
  await setDeadline(row, month(1));
  await row.getByLabel("Kwota docelowa").fill("");
  await expect(row.getByLabel("Miesiąc terminu")).toHaveValue("");
  await expect(row.getByLabel("Rok terminu")).toHaveValue("");

  // Termin wpisany przed kwotą docelową: komunikat ze SPEC 7.1.
  await setDeadline(row, month(1));
  await expect(row).toContainText("Termin wymaga kwoty docelowej");
});

test.describe("szerokość 360 px (scen. 12)", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const path of ["/", "/plan"]) {
    test(`${path} z terminem bez przewijania w poziomie`, async ({
      page,
      seed,
    }) => {
      await seedExample(seed, { deadline: month(1) });
      await page.goto(path);
      await expect(page.getByText(/Ryzyko opóźnienia/).first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
