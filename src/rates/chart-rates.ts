// Kursy EUR dla ekranu Majątek: jedno pobranie NBP na cały zakres od końca
// miesiąca wdrożenia do dziś, z którego bierze się i bieżący kurs (suma majątku,
// SPEC 5.9), i `kurs na dzień` końca każdego miesiąca na wykres (reguła 6.11).
// Jedno pobranie, bo dwa konkurujące o limit „raz na godzinę" zostawiłyby
// jedno z nich bez brakujących tabel (pierwsze wejście do demo pobiera kursy
// końców miesięcy kilkoma zapytaniami).

import type { Db } from "@/db/client";
import { getFallbackEurRate } from "@/db/settings";
import { addDays, currentDay } from "@/domain/time";
import type { FetchRates } from "./nbp";
import { loadRates } from "./refresh";
import {
  currentRate,
  rateOnDayOrFallback,
  SETTLEMENT_WINDOW_DAYS,
  type ChosenRate,
} from "./select";

export type ChartRates = {
  /** `bieżący kurs` (reguła 6.10) z pochodzeniem — do sumy majątku i punktu bieżącego miesiąca. */
  current: ChosenRate | null;
  /** `kurs na dzień D` z kursem zapasowym (reguła 6.11); `null` = brak kursu. */
  rateForDay: (day: string) => number | null;
};

/**
 * Ładuje kursy EUR z zakresu `from`…dziś (z ostatnią tabelą sprzed `from`,
 * dzięki `loadRates`) i zwraca bieżący kurs oraz funkcję kursu na dzień końca
 * miesiąca. `from` to koniec miesiąca wdrożenia, a przy braku historii — okno
 * bieżącego kursu.
 */
export async function resolveChartRates(
  db: Db,
  userId: number,
  from: string,
  now: Date,
  fetchRates?: FetchRates,
): Promise<ChartRates> {
  const to = currentDay(now);
  // Początek zakresu nie później niż okno bieżącego kursu, żeby `bieżący kurs`
  // działał także wtedy, gdy wdrożenie jest tego samego miesiąca.
  const windowFrom = addDays(to, -SETTLEMENT_WINDOW_DAYS);
  const start = from < windowFrom ? from : windowFrom;
  const [rates, fallback] = await Promise.all([
    loadRates(db, "EUR", { from: start, to }, now, fetchRates),
    getFallbackEurRate(db, userId),
  ]);
  return {
    current: currentRate(rates, fallback, now),
    rateForDay: (day) => rateOnDayOrFallback(rates, day, fallback)?.rate ?? null,
  };
}
