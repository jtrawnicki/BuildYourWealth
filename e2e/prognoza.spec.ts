import { type Page } from "@playwright/test";
import { now } from "@/domain/clock";
import { formatMonthYear } from "@/domain/month-name";
import { addMonths, currentMonth } from "@/domain/time";
import { expect, test, type Seed } from "./fixtures";

// Zakładka „Prognoza" (SPEC 5.13, scen. 40–48). E2E działa na prawdziwej dacie,
// więc miesiące przykładu prognozy majątku ze SPEC 6 są przesunięte: liczby
// (zależne tylko od serii, nie od dat) sprawdzamy wprost, a nazwy miesięcy
// kamieni milowych liczymy z bieżącego miesiąca C.

const C = currentMonth(now());
const month = (delta: number) => addMonths(C, delta);
const income = [{ name: "Pensja", amount: 1_000_000 }];

/**
 * Przykład prognozy majątku ze SPEC 6: „Konto" 10 000 zł (stopa 6%) z jednym
 * celem 100% puli Oszczędności (10%), „Gotówka" 2 000 zł bez stopy i celu,
 * 6 miesięcy przed bieżącym z przychodem 10 000 zł.
 */
async function seedExample(
  seed: Seed,
  options: { rate?: number | null; settledActuals?: number[] } = {},
): Promise<void> {
  const { rate = 600, settledActuals } = options;
  const konto = await seed.addSource({
    name: "Konto",
    kind: "savings",
    value: 1_000_000,
    expectedReturn: rate,
  });
  await seed.addSource({ name: "Gotówka", kind: "savings", value: 200_000 });
  const goal = await seed.addGoal(konto, { name: "Poduszka", pct: 10_000 });
  await seed.setPools(1000, 0);

  for (let i = 6; i >= 1; i -= 1) {
    // Trzy najnowsze miesiące bywają rozliczone (zdanie kontrolne, scen. 41).
    const settledIndex = settledActuals ? settledActuals.length - i : -1;
    const settled = settledActuals !== undefined && i <= settledActuals.length;
    await seed.addMonth({
      month: month(-i),
      settled,
      savingsPct: 1000,
      incomes: income,
      snapshot: settled
        ? [{ goalId: goal, actualAmount: settledActuals![settledIndex] }]
        : [],
    });
  }
}

const region = (page: Page, name: string) => page.getByRole("region", { name });

test("bez sesji Prognoza przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/prognoza");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("karty, wpłaty kontra zysk, kamienie milowe i źródła przy horyzoncie 5 lat (scen. 40)", async ({
  page,
  seed,
}) => {
  await seedExample(seed);
  await page.goto("/prognoza");
  await page.getByRole("button", { name: "5 lat", exact: true }).click();

  const base = page.getByRole("group", { name: "Bazowy" });
  await expect(base).toContainText("85 259 zł");
  await expect(base).toContainText("wpłata 1 000 zł / mies.");
  await expect(base).toContainText("średni przychód bez zmian");

  const plus5 = page.getByRole("group", { name: "+5%", exact: true });
  await expect(plus5).toContainText("88 747 zł");
  await expect(plus5).toContainText("wpłata 1 050 zł / mies.");
  await expect(plus5).toContainText("+3 488 zł względem bazowego");

  await expect(page.getByRole("group", { name: "+10%" })).toContainText(
    "92 236 zł",
  );
  await expect(page.getByRole("group", { name: "+15%" })).toContainText(
    "95 724 zł",
  );

  // „Wpłaty kontra zysk" dla bazowego: warstwy i zdanie.
  const profit = region(page, "Wpłaty kontra zysk");
  await expect(profit).toContainText("12 000 zł");
  await expect(profit).toContainText("60 000 zł");
  await expect(profit).toContainText("13 259 zł");
  await expect(profit).toContainText("85 259 zł");
  await expect(profit).toContainText(
    "Za 5 lat 16% majątku to zysk z założonych stóp zwrotu. Każda złotówka wpłacona według planu zamieni się średnio w 1,22 zł.",
  );

  // Kamień milowy 50 tys.: bazowy k = 34, +15% k = 30 (miesiące liczone z C).
  const milestones = region(page, "Kamienie milowe");
  const row = milestones.getByRole("row").filter({ hasText: "50 tys. zł" });
  await expect(row).toContainText(formatMonthYear(month(34)));
  await expect(row).toContainText(formatMonthYear(month(30)));

  // Tabela źródeł i dopisek o źródłach bez stopy.
  const sources = region(page, "Źródła w prognozie");
  const konto = sources.getByRole("row").filter({ hasText: "Konto" });
  await expect(konto).toContainText("6,00%");
  await expect(konto).toContainText("1 000 zł");
  await expect(konto).toContainText("83 259 zł");
  const gotowka = sources.getByRole("row").filter({ hasText: "Gotówka" });
  await expect(gotowka).toContainText("brak (0%)");
  await expect(gotowka).toContainText("2 000 zł");
  await expect(sources).toContainText(
    "1 z 2 źródeł bez zakładanej stopy zwrotu, liczone jako 0%.",
  );
});

test("punkt wyjścia i zdanie kontrolne (scen. 41)", async ({ page, seed }) => {
  await seedExample(seed, { settledActuals: [100_000, 50_000, 90_000] });
  await page.goto("/prognoza");

  const start = region(page, "Punkt wyjścia");
  await expect(start).toContainText("12 000,00 zł");
  await expect(start).toContainText("10 000,00 zł");
  await expect(start).toContainText("6 ostatnich miesięcy z przychodem");
  await expect(start).toContainText("10,00%");
  await expect(start).toContainText("Oszczędności 10,00% · Inwestycje 0,00%");
  await expect(start).toContainText("1 000,00 zł");
  await expect(start).toContainText(
    "W ostatnich 3 rozliczonych miesiącach faktycznie odkładasz średnio 800,00 zł, czyli mniej niż zakłada plan (1 000,00 zł). Prognoza liczy wpłaty według planu.",
  );
});

test("bez rozliczonego miesiąca nie ma zdania kontrolnego (scen. 41)", async ({
  page,
  seed,
}) => {
  await seedExample(seed);
  await page.goto("/prognoza");
  await expect(region(page, "Punkt wyjścia")).not.toContainText(
    "faktycznie odkładasz",
  );
});

test("średni przychód z mniejszej liczby miesięcy i bieżący miesiąc (scen. 42)", async ({
  page,
  seed,
}) => {
  await seed.addSource({ name: "Konto", kind: "savings", value: 1_000_000 });
  await seed.setPools(1000, 0);
  // Tylko dwa miesiące przed bieżącym mają przychód.
  await seed.addMonth({
    month: month(-2),
    savingsPct: 1000,
    incomes: [{ name: "P", amount: 900_000 }],
  });
  await seed.addMonth({
    month: month(-1),
    savingsPct: 1000,
    incomes: [{ name: "P", amount: 1_100_000 }],
  });

  await page.goto("/prognoza");
  const start = region(page, "Punkt wyjścia");
  await expect(start).toContainText("10 000,00 zł");
  await expect(start).toContainText("2 ostatnie miesiące z przychodem");
});

test("przychód tylko w bieżącym miesiącu: bieżący miesiąc, jeszcze niepełny (scen. 42)", async ({
  page,
  seed,
}) => {
  await seed.addSource({ name: "Konto", kind: "savings", value: 1_000_000 });
  await seed.setPools(1000, 0);
  await seed.addMonth({
    month: C,
    savingsPct: 1000,
    incomes: [{ name: "P", amount: 400_000 }],
  });

  await page.goto("/prognoza");
  const start = region(page, "Punkt wyjścia");
  await expect(start).toContainText("4 000,00 zł");
  await expect(start).toContainText("bieżący miesiąc, jeszcze niepełny");
});

test("stany braku danych: brak źródeł, brak przychodu (scen. 42, 44)", async ({
  page,
  seed,
}) => {
  await page.goto("/prognoza");
  await expect(page.getByText("Dodaj źródło na ekranie")).toBeVisible();

  await seed.addSource({ name: "Konto", kind: "savings", value: 1_000_000 });
  await page.goto("/prognoza");
  await expect(
    page.getByText("Prognoza pojawi się po wpisaniu pierwszego przychodu."),
  ).toBeVisible();
});

test("horyzont: własna liczba lat i walidacja (scen. 44)", async ({
  page,
  seed,
}) => {
  await seedExample(seed);
  await page.goto("/prognoza");

  const field = page.getByLabel("Własna liczba lat");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });

  // Domyślnie zaznaczone „10 lat".
  await expect(button("10 lat")).toHaveAttribute("aria-pressed", "true");

  // Własna liczba 25: żaden przycisk nie zaznaczony.
  await field.fill("25");
  await expect(button("5 lat")).toHaveAttribute("aria-pressed", "false");
  await expect(button("10 lat")).toHaveAttribute("aria-pressed", "false");
  await expect(button("15 lat")).toHaveAttribute("aria-pressed", "false");

  // Niepoprawna wartość: komunikat, prognoza bez zmian (nadal 25 lat).
  await field.fill("41");
  await expect(page.getByText("Wpisz liczbę lat od 1 do 40")).toBeVisible();

  // Wpisanie 10 zaznacza „10 lat" i chowa komunikat.
  await field.fill("10");
  await expect(button("10 lat")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Wpisz liczbę lat od 1 do 40")).toHaveCount(0);
});

test("źródło EUR w prognozie i brak kursu (scen. 45)", async ({
  page,
  seed,
}) => {
  await seed.addSource({
    name: "IKE",
    kind: "investments",
    currency: "EUR",
    value: 100_000,
    expectedReturn: null,
  });
  await seed.setPools(0, 1000);
  await seed.addMonth({
    month: month(-1),
    investmentsPct: 1000,
    incomes: income,
  });

  // Bez kursu NBP ani zapasowego: prośba o kurs zamiast prognozy.
  await page.goto("/prognoza");
  await expect(
    page.getByText("Ustaw kurs EUR, żeby zobaczyć prognozę."),
  ).toBeVisible();

  // Z kursem zapasowym 4,2700: źródło wchodzi jako 4 270 zł z dopiskiem.
  await seed.setFallbackEurRate(42_700);
  await page.goto("/prognoza");
  const sources = region(page, "Źródła w prognozie");
  await expect(
    sources.getByRole("row").filter({ hasText: "IKE" }),
  ).toContainText("4 270 zł (1 000,00 €)");
  await expect(sources).toContainText(
    "Źródło w EUR przeliczone po bieżącym kursie 4,2700 zł · kurs zapasowy, stałym przez cały horyzont.",
  );
});

test("otwarcie i zmiana horyzontu nie wysyłają żądań poza aplikację (scen. 47)", async ({
  page,
  baseURL,
  seed,
}) => {
  await seedExample(seed);
  const appHost = new URL(baseURL!).host;
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).host !== appHost) external.push(request.url());
  });

  await page.goto("/prognoza");
  await expect(region(page, "Punkt wyjścia")).toBeVisible();

  // Zmiana horyzontu liczy się po stronie klienta: żadnego żądania do serwera.
  const toServer: string[] = [];
  page.on("request", (request) => toServer.push(request.url()));
  await page.getByRole("button", { name: "5 lat", exact: true }).click();
  await expect(page.getByRole("group", { name: "Bazowy" })).toContainText(
    "85 259 zł",
  );
  // Zmiana horyzontu nie przeładowuje strony (brak żądania do /prognoza)…
  expect(toServer.filter((url) => url.includes("/prognoza"))).toHaveLength(0);
  // …ani żadnego żądania poza aplikację przez cały czas.
  expect(external).toHaveLength(0);
});

test("zysk ujemny i zerowy (scen. 48)", async ({ page, seed }) => {
  await seedExample(seed, { rate: -1000 });
  await page.goto("/prognoza");
  await page.getByRole("button", { name: "5 lat", exact: true }).click();

  await expect(page.getByRole("group", { name: "Bazowy" })).toContainText(
    "55 421 zł",
  );
  const profit = region(page, "Wpłaty kontra zysk");
  await expect(profit).toContainText(
    "Przy założonych stopach majątek za 5 lat będzie o 16 579 zł niższy niż majątek dziś i suma wpłat.",
  );
  await expect(profit).toContainText("−16 579 zł");
});

test("majątek 0 i pule 0%: zysk zerowy, karty bez różnicy (scen. 48)", async ({
  page,
  seed,
}) => {
  await seed.addSource({
    name: "Konto",
    kind: "savings",
    value: 0,
    expectedReturn: 600,
  });
  await seed.setPools(0, 0);
  await seed.addMonth({ month: month(-1), incomes: income });

  await page.goto("/prognoza");
  await expect(region(page, "Wpłaty kontra zysk")).toContainText(
    "Przy założonych stopach zysk za 10 lat wynosi 0 zł.",
  );
  await expect(
    page.getByRole("group", { name: "+5%", exact: true }),
  ).toContainText("+0 zł względem bazowego");
});

test("bez stopy: Wpłaty kontra zysk informuje, że majątek rośnie tylko o wpłaty (scen. 43)", async ({
  page,
  seed,
}) => {
  await seedExample(seed, { rate: null });
  await page.goto("/prognoza");
  await expect(region(page, "Wpłaty kontra zysk")).toContainText(
    "Żadne źródło nie ma zakładanej stopy zwrotu, więc majątek rośnie tylko o wpłaty.",
  );
});
