import { expect, test } from "./fixtures";

test("fixture loguje użytkownika i wpuszcza na stronę główną", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ten miesiąc" }),
  ).toBeVisible();
});

test("wylogowanie unieważnia sesję i wraca na logowanie", async ({ page }) => {
  await page.goto("/ustawienia");
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page).toHaveURL(/\/logowanie$/);

  // Ciasteczko usunięte, a sesja skasowana w bazie, więc wejście znów przekierowuje.
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test.describe("izolacja danych między testami", () => {
  test("pierwszy test seeduje własne źródło", async ({ seed }) => {
    await seed.addSource({ name: "Konto A", kind: "savings" });
    expect(await seed.countSources()).toBe(1);
  });

  test("drugi test nie widzi danych pierwszego", async ({ seed }) => {
    expect(await seed.countSources()).toBe(0);
    await seed.addSource({ name: "Konto B", kind: "investments" });
    expect(await seed.countSources()).toBe(1);
  });
});
