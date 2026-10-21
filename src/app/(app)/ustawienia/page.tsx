import type { Metadata } from "next";
import { cookies } from "next/headers";
import { logout } from "@/auth/actions";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getEurRate } from "@/db/settings";
import { formatEurRate } from "@/domain/format";
import { THEME_COOKIE, themeFromCookies } from "@/ui/theme";
import { EurRateForm } from "./EurRateForm";
import { ThemePicker } from "./ThemePicker";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Ustawienia — BuildYourWealth",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const eurRate = await getEurRate(getDb(), user.id);
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value ?? "";
  const theme = themeFromCookies(`${THEME_COOKIE}=${themeCookie}`) ?? "system";

  return (
    <>
      <h1 className={styles.title}>Ustawienia</h1>
      <section className={styles.card} aria-labelledby="kurs">
        <h2 id="kurs" className={styles.heading}>
          Kurs euro
        </h2>
        <EurRateForm initial={eurRate === null ? "" : formatEurRate(eurRate)} />
      </section>
      <section className={styles.card} aria-labelledby="wyglad">
        <h2 id="wyglad" className={styles.heading}>
          Wygląd
        </h2>
        <ThemePicker initial={theme} />
      </section>
      <section className={styles.card} aria-labelledby="konto">
        <h2 id="konto" className={styles.heading}>
          Konto
        </h2>
        <form action={logout}>
          <button type="submit" className={styles.secondary}>
            Wyloguj się
          </button>
        </form>
      </section>
    </>
  );
}
