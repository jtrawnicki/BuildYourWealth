// Kurs rozliczenia miesiąca z celem EUR (reguła 6.10, SPEC 5.5): spina leniwe
// pobranie kursów NBP (`refresh.ts`) z czystym wyborem kursu (`select.ts`)
// i kursem zapasowym z ustawień. Pobranie z NBP nigdy nie dzieje się
// w transakcji rozliczenia (STACK „Kurs NBP”), więc akcja woła tę funkcję
// przed `settleMonth`.

import type { Db } from "@/db/client";
import { getFallbackEurRate } from "@/db/settings";
import { addDays, lastDayOfMonth } from "@/domain/time";
import type { FetchRates } from "./nbp";
import { loadRates } from "./refresh";
import {
  SETTLEMENT_WINDOW_DAYS,
  settlementRate,
  type ChosenRate,
} from "./select";

/**
 * Ustala kurs rozliczenia miesiąca `YYYY-MM`: uzupełnia kursy NBP z okna
 * D − 6 … D (D = ostatni dzień miesiąca), a potem wybiera kurs reguły 6.10,
 * przy jego braku kurs zapasowy użytkownika. `null` oznacza, że kursu nie da
 * się ustalić i rozliczenia miesiąca z celem EUR nie można zatwierdzić.
 */
export async function resolveSettlementRate(
  db: Db,
  userId: number,
  month: string,
  now: Date,
  fetchRates?: FetchRates,
): Promise<ChosenRate | null> {
  const to = lastDayOfMonth(month);
  const from = addDays(to, -SETTLEMENT_WINDOW_DAYS);
  const [rates, fallback] = await Promise.all([
    loadRates(db, "EUR", { from, to }, now, fetchRates),
    getFallbackEurRate(db, userId),
  ]);
  return settlementRate(rates, month, fallback);
}

/** Czy dwa wybory kursu są tym samym kursem (pochodzenie, wartość, data NBP). */
export function sameChosenRate(a: ChosenRate, b: ChosenRate): boolean {
  if (a.source !== b.source || a.rate !== b.rate) return false;
  return a.source === "nbp" && b.source === "nbp" ? a.date === b.date : true;
}
