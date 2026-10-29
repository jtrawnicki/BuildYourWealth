// Bieżący kurs EUR na ekranach (SPEC 5.9, reguła 6.10): spina leniwe pobranie
// kursów NBP (`refresh.ts`) z czystym wyborem kursu (`select.ts`) i kursem
// zapasowym z ustawień. Służy Majątkowi, „Ten miesiąc" i Ustawieniom. Pobranie
// z NBP nie dzieje się w transakcji, więc wołamy to w renderze strony.

import type { Db } from "@/db/client";
import { getFallbackEurRate } from "@/db/settings";
import { addDays, currentDay } from "@/domain/time";
import type { FetchRates } from "./nbp";
import { loadRates } from "./refresh";
import { currentRate, SETTLEMENT_WINDOW_DAYS, type ChosenRate } from "./select";

/**
 * Ustala `bieżący kurs` (reguła 6.10): najnowsza tabela NBP z datą ≤ dziś,
 * przy jej braku kurs zapasowy użytkownika, a przy braku obu — `null`.
 * `loadRates` dołącza ostatnią tabelę sprzed okna, więc kurs działa też po
 * przerwie w pobieraniu.
 */
export async function resolveCurrentRate(
  db: Db,
  userId: number,
  now: Date,
  fetchRates?: FetchRates,
): Promise<ChosenRate | null> {
  const to = currentDay(now);
  const from = addDays(to, -SETTLEMENT_WINDOW_DAYS);
  const [rates, fallback] = await Promise.all([
    loadRates(db, "EUR", { from, to }, now, fetchRates),
    getFallbackEurRate(db, userId),
  ]);
  return currentRate(rates, fallback, now);
}
