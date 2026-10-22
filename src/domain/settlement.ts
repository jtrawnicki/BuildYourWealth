// Rozliczenie miesiąca (SPEC 5.5). Kwota faktyczna celu jest w walucie jego
// źródła: dla źródła PLN to kwota planu w groszach, dla źródła EUR — kwota planu
// przeliczona po bieżącym kursie na eurocenty (reguła 6.8). Ta sama funkcja
// wypełnia wstępnie pola formularza i wylicza kwoty opcji „plan zrealizowany".

import { convertPlnToEur } from "./currency";
import type { Currency } from "./format";

/**
 * Kwota planu celu sprowadzona do waluty jego źródła (SPEC 5.5). Cel PLN zwraca
 * kwotę planu bez zmian; cel EUR przelicza ją po kursie na eurocenty (6.8,
 * połówki w górę). Dla celu EUR kurs jest wymagany — bez kursu rozliczenia nie
 * da się zatwierdzić (SPEC 7), więc wołający nie dochodzi tu z `null`.
 */
export function plannedActual(
  planPln: number,
  currency: Currency,
  rate: number | null,
): number {
  if (currency === "PLN") return planPln;
  if (rate === null) {
    throw new RangeError("Cel w EUR wymaga kursu do przeliczenia planu.");
  }
  return convertPlnToEur(planPln, rate);
}
