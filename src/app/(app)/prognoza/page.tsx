import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { now } from "@/domain/clock";
import { ForecastView } from "./ForecastView";
import { loadForecast } from "./forecast-data";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Prognoza — BuildYourWealth",
};

// Zawartość zależy od sesji (guard czyta ciasteczko), więc strona jest
// dynamiczna i streamuje się za granicą `loading.tsx`. Prognoza majątku
// (SPEC 5.13): serwer liczy serie 40 lat (reguła 6.14), a komponent kliencki
// składa podsumowanie dla wybranego horyzontu bez żądania do serwera.
export default async function ForecastPage() {
  const user = await requireUser();
  const { forecast, sources, eurRateText } = await loadForecast(
    getDb(),
    user.id,
    now(),
  );

  return (
    <>
      <header className={styles.head}>
        <h1 className={styles.title}>Prognoza</h1>
        <p className={styles.lead}>
          Jak może rosnąć Twój majątek, gdy odkładasz według bieżącego planu.
        </p>
      </header>

      {forecast.ok ? (
        <ForecastView
          series={forecast.series}
          sources={sources}
          eurRateText={eurRateText}
        />
      ) : (
        <NoData reason={forecast.reason} />
      )}
    </>
  );
}

/** Stany braku danych w kolejności z SPEC 5.13. */
function NoData({
  reason,
}: {
  reason: "no-sources" | "no-income" | "no-rate";
}) {
  if (reason === "no-sources") {
    return (
      <section className={styles.card}>
        <p className={styles.empty}>
          Dodaj źródło na ekranie{" "}
          <Link href="/majatek" className={styles.link}>
            Majątek
          </Link>
          , aby zobaczyć prognozę.
        </p>
      </section>
    );
  }
  if (reason === "no-income") {
    return (
      <section className={styles.card}>
        <p className={styles.empty}>
          Prognoza pojawi się po wpisaniu pierwszego przychodu.{" "}
          <Link href="/" className={styles.link}>
            Ten miesiąc
          </Link>
        </p>
      </section>
    );
  }
  return (
    <section className={styles.card}>
      <p className={styles.empty}>
        Ustaw kurs EUR, żeby zobaczyć prognozę.{" "}
        <Link href="/ustawienia" className={styles.link}>
          Ustaw kurs EUR
        </Link>
      </p>
    </section>
  );
}
