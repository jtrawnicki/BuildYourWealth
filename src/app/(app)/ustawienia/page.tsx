import type { Metadata } from "next";
import { cookies } from "next/headers";
import { logout } from "@/auth/actions";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getFallbackEurRate } from "@/db/settings";
import { now } from "@/domain/clock";
import { formatEurRate } from "@/domain/format";
import { resolveCurrentRate } from "@/rates/current-rate";
import { currentRateText, isCurrentRateStale } from "@/rates/label";
import { THEME_COOKIE, themeFromCookies } from "@/ui/theme";
import { FallbackRateForm } from "./FallbackRateForm";
import { ThemePicker } from "./ThemePicker";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Ustawienia — BuildYourWealth",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const db = getDb();
  const [current, fallback] = await Promise.all([
    resolveCurrentRate(db, user.id, now()),
    getFallbackEurRate(db, user.id),
  ]);
  const stale = current !== null && isCurrentRateStale(current, now());
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value ?? "";
  const theme = themeFromCookies(`${THEME_COOKIE}=${themeCookie}`) ?? "system";

  return (
    <>
      <h1 className={styles.title}>Ustawienia</h1>
      <section className={styles.card} aria-labelledby="kurs">
        <h2 id="kurs" className={styles.heading}>
          Kurs euro
        </h2>
        <p className={styles.currentRate}>
          <span className={styles.currentRateLabel}>Bieżący kurs</span>
          {current !== null ? (
            <span className={styles.currentRateValue}>
              {currentRateText(current)}
            </span>
          ) : (
            <span className={styles.currentRateValue}>
              Brak kursu — ustaw kurs zapasowy poniżej.
            </span>
          )}
        </p>
        {stale && (
          <p role="status" className={styles.rateWarning}>
            Nie udało się pobrać nowszego kursu z NBP
          </p>
        )}
        <FallbackRateForm
          initial={fallback === null ? "" : formatEurRate(fallback)}
        />
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
