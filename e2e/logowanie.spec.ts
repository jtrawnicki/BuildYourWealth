import { expect, test, type Page } from "@playwright/test";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOCKED_MESSAGE,
  MAX_FAILED_ATTEMPTS,
} from "@/auth/constants";
import { TEST_EMAIL, TEST_PASSWORD, createTestUser, resetDatabase } from "./db";

test.beforeEach(async () => {
  await resetDatabase();
});

// Czeka na zakończenie Server Action (POST), żeby kolejne próby nie wyprzedzały
// odpowiedzi serwera.
async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło").fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Zaloguj się" }).click(),
  ]);
}

test("bez sesji strona chroniona przekierowuje na logowanie (scen. 13)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
});

test("poprawne dane logują i prowadzą na stronę główną", async ({ page }) => {
  await createTestUser();
  await page.goto("/logowanie");
  await submitLogin(page, TEST_EMAIL, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Zalogowano jako ${TEST_EMAIL}`)).toBeVisible();
});

test("błędne hasło nie zdradza, czy konto istnieje", async ({ page }) => {
  await createTestUser();
  await page.goto("/logowanie");

  await submitLogin(page, TEST_EMAIL, "zle-haslo");
  await expect(page.getByText(INVALID_CREDENTIALS_MESSAGE)).toBeVisible();

  await submitLogin(page, "nieznane@example.com", "jakies-haslo-123");
  await expect(page.getByText(INVALID_CREDENTIALS_MESSAGE)).toBeVisible();
});

test("po zbyt wielu próbach logowanie jest chwilowo blokowane", async ({
  page,
}) => {
  await createTestUser();
  await page.goto("/logowanie");

  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    await submitLogin(page, TEST_EMAIL, "zle-haslo");
    await expect(page.getByText(INVALID_CREDENTIALS_MESSAGE)).toBeVisible();
  }

  // Nawet poprawne hasło jest teraz odrzucane komunikatem blokady.
  await submitLogin(page, TEST_EMAIL, TEST_PASSWORD);
  await expect(page.getByText(LOCKED_MESSAGE)).toBeVisible();
});
