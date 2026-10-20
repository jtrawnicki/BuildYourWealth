// Przeliczenia PLN↔EUR i majątek (SPEC 6.7–6.8). Kwoty w groszach lub
// eurocentach, kurs w dziesięciotysięcznych (STACK 4). Zaokrąglenie do
// najbliższego grosza lub eurocenta, połówki w górę.

import { roundMulDivHalfUp } from "./arithmetic";
import type { Currency } from "./format";

/** Kurs zapisany w dziesięciotysięcznych: 4,2850 = 42850. */
const RATE_SCALE = 10_000;

/** PLN → EUR: `EUR = PLN ÷ kurs` (SPEC 6.8). */
export function convertPlnToEur(plnMinor: number, rate: number): number {
  return roundMulDivHalfUp(plnMinor, RATE_SCALE, rate);
}

/** EUR → PLN: `PLN = EUR × kurs` (SPEC 6.8). */
export function convertEurToPln(eurMinor: number, rate: number): number {
  return roundMulDivHalfUp(eurMinor, rate, RATE_SCALE);
}

export type SourceValue = { currency: Currency; value: number };

/**
 * Suma majątku w PLN albo informacja, że bez kursu nie da się jej policzyć.
 * `brak-kursu` wtedy, gdy istnieje źródło w EUR, a kurs nie jest ustawiony
 * (SPEC 7: aplikacja prosi o kurs przed pokazaniem sumy majątku).
 */
export type NetWorth =
  { ok: true; pln: number } | { ok: false; reason: "brak-kursu" };

/**
 * Majątek w PLN (SPEC 6.7): suma wartości źródeł PLN i przeliczeń źródeł EUR.
 * Każde źródło EUR przeliczane osobno, potem sumowane (SPEC 6.8). Źródła
 * zarchiwizowane nie wchodzą do majątku — odfiltrowuje je warstwa odczytu.
 */
export function netWorthPln(
  sources: SourceValue[],
  rate: number | null,
): NetWorth {
  let pln = 0;
  for (const source of sources) {
    if (source.currency === "PLN") {
      pln += source.value;
    } else {
      if (rate === null) return { ok: false, reason: "brak-kursu" };
      pln += convertEurToPln(source.value, rate);
    }
  }
  return { ok: true, pln };
}
