import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const pool = (page: Page, name: string) => page.getByRole("region", { name });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Zapisz plan" });

async function submit(button: Locator) {
  await Promise.all([
    button.page().waitForResponse((r) => r.request().method() === "POST"),
    button.click(),
  ]);
}

/** Dodaje cel w sekcji puli i wypełnia pola (po indeksie w obrębie sekcji). */
async function addGoal(
  section: Locator,
  index: number,
  fields: { name: string; pct: string; source: string; target?: string },
) {
  await section.getByRole("button", { name: /^Dodaj cel w puli/ }).click();
  await section.getByLabel("Nazwa celu").nth(index).fill(fields.name);
  await section
    .getByLabel("Źródło")
    .nth(index)
    .selectOption({ label: fields.source });
  await section.getByLabel("% puli").nth(index).fill(fields.pct);
  if (fields.target !== undefined) {
    await section
      .getByLabel("Kwota docelowa (opcjonalnie)")
      .nth(index)
      .fill(fields.target);
  }
}

test("bez sesji Plan podziału przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("pusty plan: zakładka aktywna, bez źródeł zachęca do Majątku", async ({
  page,
}) => {
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Plan podziału" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Menu główne" })
      .locator('[aria-current="page"]'),
  ).toHaveText("Plan podziału");
  await expect(pool(page, "Oszczędności")).toContainText("zakładce Majątek");
});

test("walidacja sumy celów: brakuje 10% blokuje zapis (scen. 3)", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  await seed.addSource({ name: "Konto 2", kind: "savings" });
  await page.goto("/plan");

  const savings = pool(page, "Oszczędności");
  await savings.getByLabel("Procent przychodu").fill("20");
  await addGoal(savings, 0, {
    name: "Poduszka",
    pct: "60",
    source: "Konto (PLN)",
  });
  await addGoal(savings, 1, {
    name: "Wakacje",
    pct: "30",
    source: "Konto (PLN)",
  });

  await expect(savings.getByRole("status")).toHaveText(
    "Suma celów: 90%. Brakuje 10%",
  );
  await expect(saveButton(page)).toBeDisabled();

  await savings.getByLabel("% puli").nth(1).fill("40");
  await expect(savings.getByRole("status")).toHaveText("Suma celów: 100%");
  await expect(saveButton(page)).toBeEnabled();

  await submit(saveButton(page));
  await expect(page.getByText("Zapisano plan.")).toBeVisible();

  // Plan przetrwał przeładowanie i cele mają kolejność dodania.
  await page.reload();
  const reloaded = pool(page, "Oszczędności");
  await expect(reloaded.getByLabel("Procent przychodu")).toHaveValue("20");
  await expect(reloaded.getByLabel("Nazwa celu").nth(0)).toHaveValue(
    "Poduszka",
  );
  await expect(reloaded.getByLabel("Nazwa celu").nth(1)).toHaveValue("Wakacje");
  expect(source).toBeGreaterThan(0);
});

test("usunięcie celu i pusty plan zapisują się atomowo", async ({
  page,
  seed,
}) => {
  const source = await seed.addSource({ name: "Konto", kind: "savings" });
  await seed.setPools(1000, 0);
  await seed.addGoal(source, { name: "Stary cel", pct: 10000 });
  await page.goto("/plan");

  const savings = pool(page, "Oszczędności");
  await expect(savings.getByLabel("Nazwa celu")).toHaveValue("Stary cel");

  // Usuwamy cel i zerujemy pulę → poprawny pusty plan.
  await savings.getByRole("button", { name: "Usuń cel Stary cel" }).click();
  await savings.getByLabel("Procent przychodu").fill("0");
  await submit(saveButton(page));
  await expect(page.getByText("Zapisano plan.")).toBeVisible();

  await page.reload();
  const reloaded = pool(page, "Oszczędności");
  await expect(reloaded.getByLabel("Nazwa celu")).toHaveCount(0);
  await expect(reloaded.getByLabel("Procent przychodu")).toHaveValue("0");
});

test("cel z kwotą docelową nie pozwala wybrać źródła w innej walucie (SPEC 6.9)", async ({
  page,
  seed,
}) => {
  const pln = await seed.addSource({ name: "Konto PLN", kind: "savings" });
  await seed.addSource({ name: "Konto EUR", kind: "savings", currency: "EUR" });
  await seed.setPools(2000, 0);
  await seed.addGoal(pln, { name: "Cel", pct: 10000, targetAmount: 500000 });
  await page.goto("/plan");

  const savings = pool(page, "Oszczędności");
  const sourceSelect = savings.getByLabel("Źródło");
  // Źródło EUR nie jest oferowane, dopóki cel ma kwotę docelową.
  await expect(sourceSelect.locator("option")).toHaveText([
    "Wybierz źródło…",
    "Konto PLN (PLN)",
  ]);
  await expect(savings).toContainText("Waluty nie można zmienić");

  // Po wyczyszczeniu kwoty docelowej źródło EUR staje się dostępne.
  await savings.getByLabel("Kwota docelowa (opcjonalnie)").fill("");
  await expect(sourceSelect.locator("option")).toHaveText([
    "Wybierz źródło…",
    "Konto PLN (PLN)",
    "Konto EUR (EUR)",
  ]);
});
