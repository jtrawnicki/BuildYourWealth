// Etykiety kursu EUR na ekranach (SPEC 5.9, scen. 22–24, 39). Czyste funkcje:
// biorą wybrany kurs (`select.ts`) albo pochodzenie zapisane przy rozliczeniu
// i składają tekst z pochodzeniem oraz datą tabeli NBP.

import { NBSP, formatDate, formatEurRate } from "@/domain/format";
import { addDays, currentDay } from "@/domain/time";
import type { ChosenRate } from "./select";

/** Pochodzenie kursu rozliczenia zapisane w `months` (reguła 6.10). */
export type SettledRateSource = "nbp" | "fallback" | "manual";

function amount(rate: number): string {
  return `${formatEurRate(rate)}${NBSP}zł`;
}

/**
 * Bieżący kurs w Ustawieniach (SPEC 5.9): `4,2731 zł · NBP, tabela z 27.10.2026`
 * albo `4,3000 zł · kurs zapasowy`.
 */
export function currentRateText(rate: ChosenRate): string {
  return rate.source === "nbp"
    ? `${amount(rate.rate)} · NBP, tabela z ${formatDate(rate.date)}`
    : `${amount(rate.rate)} · kurs zapasowy`;
}

/**
 * Kurs rozliczenia miesiąca bez przedrostka „Kurs " (SPEC 5.5, 5.6, scen. 23,
 * 24, 39): `4,2650 zł (NBP, 30.10.2026)`, `4,3000 zł · kurs zapasowy`,
 * `4,3000 zł (ręczny, sprzed Etapu 2)`.
 */
export function settledRateText(
  rate: number,
  source: SettledRateSource,
  date: string | null,
): string {
  switch (source) {
    case "nbp":
      return `${amount(rate)} (NBP, ${formatDate(date ?? "")})`;
    case "fallback":
      return `${amount(rate)} · kurs zapasowy`;
    case "manual":
      return `${amount(rate)} (ręczny, sprzed Etapu 2)`;
  }
}

/** Kurs rozliczenia z wybranego kursu (ekran rozliczenia, przed zapisem). */
export function chosenRateText(rate: ChosenRate): string {
  return rate.source === "nbp"
    ? settledRateText(rate.rate, "nbp", rate.date)
    : settledRateText(rate.rate, "fallback", null);
}

/**
 * Czy bieżący kurs jest „stary" (SPEC 5.9): tabela NBP starsza niż 7 dni od
 * dziś, albo w ogóle brak tabeli (w użyciu jest kurs zapasowy). Służy
 * ostrzeżeniu „Nie udało się pobrać nowszego kursu z NBP".
 */
export function isCurrentRateStale(rate: ChosenRate, now: Date): boolean {
  if (rate.source !== "nbp") return true;
  return rate.date < addDays(currentDay(now), -7);
}
