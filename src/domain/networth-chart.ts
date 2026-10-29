// Wykres wartości majątku (SPEC 5.11, reguła 6.11). Czysta funkcja: dostaje
// pełną historię zmian wartości źródeł, kurs EUR na dowolny dzień i bieżący
// kurs, a liczy sumę majątku w PLN na koniec każdego miesiąca od wdrożenia
// zapisu historii do teraz. Nie zna bazy ani sieci — kursy wstawia warstwa
// renderu strony.

import { convertEurToPln } from "./currency";
import type { Currency } from "./format";
import {
  addMonths,
  compareMonths,
  currentMonth,
  lastDayOfMonth,
  startOfMonthInstant,
} from "./time";

/** Jeden zapis historii wartości źródła z walutą zapisaną razem z nim. */
export type ChartHistoryEntry = {
  sourceId: number;
  value: number;
  currency: Currency;
  recordedAt: Date;
};

/** Punkt wykresu: miesiąc, suma w PLN i zmiana względem poprzedniego punktu. */
export type ChartPoint = {
  month: string;
  pln: number;
  /** `null` dla pierwszego punktu (SPEC 5.11). */
  change: number | null;
};

/**
 * Wykres albo informacja, że bez kursu nie da się go policzyć — gdy źródło
 * EUR o niezerowej wartości wypada w miesiącu bez żadnego kursu (SPEC 5.11).
 */
export type NetWorthChart =
  { ok: true; points: ChartPoint[] } | { ok: false; reason: "brak-kursu" };

type Params = {
  /** Cała historia, rosnąco po `recordedAt` (przy równych — po kolejności zapisu). */
  history: readonly ChartHistoryEntry[];
  /** Miesiąc pierwszego zapisu historii (`YYYY-MM`). */
  deploymentMonth: string;
  now: Date;
  /** `kurs na dzień D` z kursem zapasowym (reguła 6.11); `null` = brak kursu. */
  rateForDay: (day: string) => number | null;
  /** `bieżący kurs` dla punktu bieżącego miesiąca; `null` = brak kursu. */
  currentRate: number | null;
};

/** Ostatni zapis każdego źródła z chwilą przed `cutoff` (ms UTC). */
function valuesAt(
  history: readonly ChartHistoryEntry[],
  cutoff: number,
): Map<number, { value: number; currency: Currency }> {
  // Historia jest rosnąca, więc kolejny zapis w zakresie nadpisuje poprzedni:
  // zostaje ostatni z chwilą < cutoff (reguła 6.11: zapis z chwilą ≤ koniec M).
  const latest = new Map<number, { value: number; currency: Currency }>();
  for (const e of history) {
    if (e.recordedAt.getTime() >= cutoff) break;
    latest.set(e.sourceId, { value: e.value, currency: e.currency });
  }
  return latest;
}

/** Suma majątku w PLN wg reguły 7; `null` = źródło EUR bez kursu (brak-kursu). */
function sumPln(
  values: Iterable<{ value: number; currency: Currency }>,
  rate: number | null,
): number | null {
  let pln = 0;
  for (const { value, currency } of values) {
    // Zapis o wartości 0 (zarchiwizowane źródło, wyzerowana wycena) nic nie
    // wnosi i nie wymaga kursu, więc nie zamienia wykresu w prośbę o kurs.
    if (value === 0) continue;
    if (currency === "PLN") {
      pln += value;
    } else {
      if (rate === null) return null;
      pln += convertEurToPln(value, rate);
    }
  }
  return pln;
}

/**
 * Punkty wykresu od miesiąca wdrożenia do bieżącego (reguła 6.11). Każdy punkt
 * poza bieżącym miesiącem to stan na koniec miesiąca po `kursie na dzień` jego
 * ostatniego dnia; punkt bieżącego miesiąca to stan na teraz po `bieżącym
 * kursie`. Historia musi być posortowana rosnąco po chwili zapisu.
 */
export function netWorthChart(params: Params): NetWorthChart {
  const { history, deploymentMonth, now, rateForDay, currentRate } = params;
  const current = currentMonth(now);
  const nowMs = now.getTime();

  const points: ChartPoint[] = [];
  let prev: number | null = null;
  for (
    let month = deploymentMonth;
    compareMonths(month, current) <= 0;
    month = addMonths(month, 1)
  ) {
    const isCurrent = month === current;
    // Koniec miesiąca = chwila przed początkiem następnego; bieżący miesiąc
    // bierze stan na teraz (chwila ≤ now, więc granica tuż po now).
    const cutoff = isCurrent
      ? nowMs + 1
      : startOfMonthInstant(addMonths(month, 1)).getTime();
    const rate = isCurrent ? currentRate : rateForDay(lastDayOfMonth(month));
    const pln = sumPln(valuesAt(history, cutoff).values(), rate);
    if (pln === null) return { ok: false, reason: "brak-kursu" };
    points.push({ month, pln, change: prev === null ? null : pln - prev });
    prev = pln;
  }
  return { ok: true, points };
}
