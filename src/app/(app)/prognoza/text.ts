// Teksty zakładki „Prognoza" (SPEC 5.13). Domena (`wealth-forecast.ts`) zwraca
// liczby i warianty (enum), a tu składamy z nich polskie zdania i etykiety.
// Czyste funkcje — używa ich komponent kliencki przy każdej zmianie horyzontu
// i scenariusza (bez żądania do serwera).

import { roundMulDivHalfAwayFromZero } from "@/domain/arithmetic";
import {
  NBSP,
  formatMoney,
  formatPercentFixed,
  groupThousands,
} from "@/domain/format";
import { formatAmountShort } from "@/app/(app)/majatek/chart-view";
import type {
  ControlSentence,
  IncomeSource,
  ProfitSentence,
  Scenario,
  ScenarioCard,
} from "@/domain/wealth-forecast";
import { yearsPhrase } from "@/domain/wealth-forecast";

/** Nazwa scenariusza na wykresie, w kartach i przełączniku (SPEC 5.13). */
export const SCENARIO_NAME: Record<Scenario, string> = {
  0: "Bazowy",
  5: "+5%",
  10: "+10%",
  15: "+15%",
};

/** Kwota w pełnych złotych (SPEC 5.13): `85259` → `85 259 zł`, `-16579` → `−16 579 zł`. */
export function formatZloty(zloty: number): string {
  const sign = zloty < 0 ? "−" : "";
  return `${sign}${groupThousands(String(Math.abs(zloty)))}${NBSP}zł`;
}

/** Kwota z groszy zaokrąglona do pełnych złotych, połówki od zera (reguła 6.14). */
export function formatMinorAsZloty(minor: number): string {
  return formatZloty(roundMulDivHalfAwayFromZero(minor, 1, 100));
}

/** Skrót progu na znaczniku wykresu (SPEC 5.13): `5_000_000` gr → `50 tys.`. */
export function formatThresholdShort(minor: number): string {
  return formatAmountShort(minor).replace(`${NBSP}zł`, "");
}

/** Dopisek, skąd pochodzi średni przychód (SPEC 5.13, reguła 6.14). */
export function incomeSourceNote(source: IncomeSource): string {
  if (source.kind === "current-only")
    return "bieżący miesiąc, jeszcze niepełny";
  const n = source.monthCount;
  if (n === 1) return "ostatni miesiąc z przychodem";
  if (n >= 2 && n <= 4) return `${n} ostatnie miesiące z przychodem`;
  return `${n} ostatnich miesięcy z przychodem`;
}

/** Rozbicie odkładanego procentu na pule (SPEC 5.13): „Oszczędności 20,00% · Inwestycje 15,00%". */
export function savedBreakdown(
  savingsPct: number,
  investmentsPct: number,
): string {
  return `Oszczędności ${formatPercentFixed(savingsPct)} · Inwestycje ${formatPercentFixed(investmentsPct)}`;
}

/** Zdanie kontrolne pod „Punktem wyjścia" (SPEC 5.13, reguła 6.14). */
export function controlSentenceText(cs: ControlSentence): string {
  const relation = cs.relation === "less" ? "mniej" : "więcej";
  const actual = formatMoney(cs.averageActual, "PLN");
  const plan = formatMoney(cs.planContribution, "PLN");
  const opening =
    cs.monthCount === 1
      ? `W ostatnim rozliczonym miesiącu faktycznie odkładasz ${actual}`
      : `W ostatnich ${cs.monthCount} rozliczonych miesiącach faktycznie odkładasz średnio ${actual}`;
  return `${opening}, czyli ${relation} niż zakłada plan (${plan}). Prognoza liczy wpłaty według planu.`;
}

/** Zdanie „Wpłaty kontra zysk" zależne od zysku na koniec horyzontu (SPEC 5.13). */
export function profitSentenceText(
  sentence: ProfitSentence,
  years: number,
): string {
  const phrase = yearsPhrase(years);
  switch (sentence.kind) {
    case "no-rate":
      return "Żadne źródło nie ma zakładanej stopy zwrotu, więc majątek rośnie tylko o wpłaty.";
    case "positive": {
      const share =
        sentence.profitSharePct === 0
          ? "mniej niż 1%"
          : `${sentence.profitSharePct}%`;
      const first = `Za ${phrase} ${share} majątku to zysk z założonych stóp zwrotu.`;
      if (sentence.perZloty === null) return first;
      // `perZloty` to grosze ratio (1,22 zł); formatMoney daje „1,22 zł".
      return `${first} Każda złotówka wpłacona według planu zamieni się średnio w ${formatMoney(sentence.perZloty, "PLN")}.`;
    }
    case "negative":
      return `Przy założonych stopach majątek za ${phrase} będzie o ${formatMinorAsZloty(sentence.loss)} niższy niż majątek dziś i suma wpłat.`;
    case "zero":
      return `Przy założonych stopach zysk za ${phrase} wynosi 0 zł.`;
  }
}

/** Miesięczna wpłata scenariusza na karcie (SPEC 5.13): „wpłata 1 050 zł / mies.". */
export function cardContributionText(card: ScenarioCard): string {
  return `wpłata ${formatZloty(card.monthlyContribution)} / mies.`;
}

/** Różnica scenariusza względem bazowego (SPEC 5.13); karta bazowa ma stały tekst. */
export function cardDiffText(card: ScenarioCard): string {
  if (card.scenario === 0) return "średni przychód bez zmian";
  const sign = card.diffFromBase < 0 ? "−" : "+";
  return `${sign}${formatZloty(Math.abs(card.diffFromBase))} względem bazowego`;
}

/** Zakładana stopa w tabeli źródeł (SPEC 5.13): „6,00%" albo „brak (0%)". */
export function rateLabel(rate: number | null): string {
  return rate === null ? "brak (0%)" : formatPercentFixed(rate);
}

/** Dopisek o liczbie źródeł bez stopy pod tabelą źródeł (SPEC 5.13). */
export function sourcesRateNote(withoutRate: number, total: number): string {
  if (withoutRate === 0) return "Wszystkie źródła mają zakładaną stopę zwrotu.";
  return `${withoutRate} z ${total} źródeł bez zakładanej stopy zwrotu, liczone jako 0%.`;
}
