// Wybór kursu EUR wg reguły 6.10 (SPEC 5.9). Czyste funkcje: nie znają sieci
// ani bazy, dostają kursy pobrane wcześniej z NBP i kurs zapasowy z ustawień.

import { addDays, currentDay, lastDayOfMonth } from "@/domain/time";

/** Tabela NBP: data `YYYY-MM-DD` i kurs w dziesięciotysięcznych. */
export type NbpRate = { effectiveDate: string; rate: number };

/** Wybrany kurs z pochodzeniem; data tabeli tylko dla NBP. */
export type ChosenRate =
  | { source: "nbp"; rate: number; date: string }
  | { source: "fallback"; rate: number };

/** Okno kursu rozliczenia: tabele z datą od D − 6 do D (SPEC Z10). */
const SETTLEMENT_WINDOW_DAYS = 6;

/** Najnowsza tabela z datą od `from` do `to` włącznie albo `null`. */
function latestBetween(
  rates: readonly NbpRate[],
  from: string | null,
  to: string,
): NbpRate | null {
  let latest: NbpRate | null = null;
  for (const r of rates) {
    if (r.effectiveDate > to) continue;
    if (from !== null && r.effectiveDate < from) continue;
    if (!latest || r.effectiveDate > latest.effectiveDate) latest = r;
  }
  return latest;
}

function fromNbp(r: NbpRate | null): ChosenRate | null {
  return r ? { source: "nbp", rate: r.rate, date: r.effectiveDate } : null;
}

function withFallback(
  chosen: ChosenRate | null,
  fallback: number | null,
): ChosenRate | null {
  if (chosen) return chosen;
  return fallback === null ? null : { source: "fallback", rate: fallback };
}

/** `kurs na dzień D`: ostatnia pobrana tabela z datą ≤ D, bez kursu zapasowego. */
export function rateOnDay(
  rates: readonly NbpRate[],
  day: string,
): ChosenRate | null {
  return fromNbp(latestBetween(rates, null, day));
}

/** `kurs na dzień D`, a gdy go nie ma — kurs zapasowy (reguła 6.11). */
export function rateOnDayOrFallback(
  rates: readonly NbpRate[],
  day: string,
  fallback: number | null,
): ChosenRate | null {
  return withFallback(rateOnDay(rates, day), fallback);
}

/** `bieżący kurs`: kurs na dziś (Europe/Warsaw), potem zapasowy, potem brak. */
export function currentRate(
  rates: readonly NbpRate[],
  fallback: number | null,
  now: Date,
): ChosenRate | null {
  return rateOnDayOrFallback(rates, currentDay(now), fallback);
}

/**
 * `kurs rozliczenia` miesiąca `YYYY-MM`: najnowsza z tabel dostępnych teraz
 * z datą od D − 6 do D (D = ostatni dzień miesiąca), potem zapasowy. `null`
 * oznacza, że rozliczenia miesiąca z celem EUR nie da się zatwierdzić.
 */
export function settlementRate(
  rates: readonly NbpRate[],
  month: string,
  fallback: number | null,
): ChosenRate | null {
  const d = lastDayOfMonth(month);
  const from = addDays(d, -SETTLEMENT_WINDOW_DAYS);
  return withFallback(fromNbp(latestBetween(rates, from, d)), fallback);
}
