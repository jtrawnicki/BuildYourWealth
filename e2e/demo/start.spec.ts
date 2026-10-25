import { expect, test } from "@playwright/test";
import { SESSION_COOKIE } from "@/auth/constants";
import { createSessionToken, createTestUser, resetDatabase } from "../db";

// Projekt „demo”: ten sam build uruchomiony z APP_MODE=demo (STACK 7).

test.beforeEach(async () => {
  await resetDatabase();
});

test("bez piaskownicy strona chroniona prowadzi na ekran startowy demo bez formularza logowania (scen. 13, 21)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(
    page.getByRole("button", { name: "Wypróbuj wersję demo" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveCount(0);
  await expect(page.getByLabel("Hasło")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toHaveCount(
    0,
  );
});

test("sesja zwykłego konta nie otwiera aplikacji w trybie demo", async ({
  page,
  baseURL,
}) => {
  const token = await createSessionToken(await createTestUser());
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: baseURL!,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/logowanie$/);
});
