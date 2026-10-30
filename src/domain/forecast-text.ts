// Teksty prognozy celu i terminu (SPEC 5.12) z wyników `forecast.ts`. Czyste
// funkcje: kwoty w walucie celu, miesiące `YYYY-MM`. Wspólne dla „Ten miesiąc”
// i Planu podziału, żeby oba ekrany mówiły tymi samymi zdaniami.

import type {
  DeadlineResult,
  DeadlineStatus,
  Forecast,
  Suggestion,
} from "./forecast";
import { formatMoney, formatPercentFixed, type Currency } from "./format";
import {
  formatMonthName,
  formatMonthYear,
  formatMonthYearGenitive,
  formatMonthYearLocative,
} from "./month-name";

export const FORECAST_MESSAGES = {
  never: "Przy obecnych wpłatach cel nie zostanie osiągnięty",
  noData: "Prognoza pojawi się, gdy cel trafi do planu miesiąca.",
  newPercent:
    "Prognoza uwzględni nowy procent po rozliczeniu miesięcy z nowym planem.",
  over100:
    "Nawet 100% puli nie wystarczy. Zwiększ procent puli albo przesuń termin.",
  tooLate:
    "Zmiana procentu nie zdąży przed terminem. Przesuń termin albo przy rozliczeniu wpisz wyższą faktyczną kwotę.",
  enough: "Zaplanowane wpłaty wystarczą do terminu.",
  eurNoRate: "Ustaw kurs EUR, aby zobaczyć sugestię procentu.",
} as const;

export const DEADLINE_STATUS_LABEL: Record<DeadlineStatus, string> = {
  "on-track": "zdążysz",
  "at-risk": "zagrożony",
  overdue: "termin minął",
  "no-data": "brak danych",
};

/** Prognoza celu bez terminu (SPEC 5.12); cel osiągnięty nie ma prognozy. */
export function forecastText(forecast: Forecast): string | null {
  switch (forecast.status) {
    case "reached":
      return null;
    case "no-data":
      return FORECAST_MESSAGES.noData;
    case "never":
      return FORECAST_MESSAGES.never;
    case "forecast":
      return `Osiągniesz ok. w ${formatMonthYearLocative(forecast.achievementMonth)}`;
  }
}

/** Linia statusu terminu na „Ten miesiąc”: „Termin: marzec 2027 · zdążysz (ok. styczeń 2027)”. */
export type DeadlineLine = {
  /** „Termin: marzec 2027”. */
  deadline: string;
  status: DeadlineStatus;
  /** Tekst pigułki statusu. */
  statusLabel: string;
  /** Dopełnienie po pigułce, np. „(ok. styczeń 2027)” przy „zdążysz”. */
  detail: string | null;
};

export function deadlineLine(
  result: DeadlineResult,
  forecast: Forecast,
  deadline: string,
): DeadlineLine {
  return {
    deadline: `Termin: ${formatMonthYear(deadline)}`,
    status: result.status,
    statusLabel: DEADLINE_STATUS_LABEL[result.status],
    detail:
      result.status === "on-track" && forecast.status === "forecast"
        ? `(ok. ${formatMonthYear(forecast.achievementMonth)})`
        : null,
  };
}

/** „Listopad”, „Październik i listopad”, „Wrzesień, październik i listopad”. */
function monthList(months: string[]): string {
  const names = months.map((m, i) =>
    i === 0 ? formatMonthName(m) : formatMonthName(m).toLowerCase(),
  );
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

/**
 * Brakująca kwota i wymagana wpłata w Planie podziału (SPEC 5.12), dla statusu
 * innego niż „termin minął”: „Do grudnia 2026 brakuje 1 300,00 zł. Listopad ma
 * już zaplanowane 588,00 zł, więc w każdym kolejnym miesiącu potrzebujesz
 * 712,00 zł (średnio wpłacasz 566,66 zł).” Bez istniejących miesięcy z celem
 * zdanie o zaplanowanej kwocie jest pominięte.
 */
export function requiredText(
  result: DeadlineResult,
  forecast: Forecast,
  deadline: string,
  currency: Currency,
): string | null {
  if (result.status === "overdue") return null;
  const money = (minor: number) => formatMoney(minor, currency);
  const remaining = result.shortfall + result.planned;
  let text = `Do ${formatMonthYearGenitive(deadline)} brakuje ${money(remaining)}.`;

  const hasPlanned = result.plannedMonths.length > 0;
  if (hasPlanned) {
    const verb = result.plannedMonths.length === 1 ? "ma" : "mają";
    text += ` ${monthList(result.plannedMonths)} ${verb} już zaplanowane ${money(result.planned)}`;
  }
  if (result.required !== null) {
    const average =
      forecast.status === "forecast"
        ? ` (${forecast.averageSource === "actual" ? "średnio wpłacasz" : "planujesz"} ${money(forecast.averageAmount)})`
        : "";
    text += `${hasPlanned ? ", więc w" : " W"} każdym kolejnym miesiącu potrzebujesz ${money(result.required)}${average}.`;
  } else if (hasPlanned) {
    text += ".";
  }
  return text;
}

/**
 * Sugestia procentu albo komunikat zamiast niej (SPEC 5.12): „Ustaw ok. 36,33%
 * puli Oszczędności (teraz 30,00%) i zmniejsz pozostałe cele albo zwiększ
 * procent puli.” `currentPct` to procent celu w bieżącym planie (null, gdy pole
 * nie daje się odczytać).
 */
export function suggestionText(
  suggestion: Suggestion,
  poolTitle: string,
  currentPct: number | null,
): string | null {
  switch (suggestion.kind) {
    case "none":
      return null;
    case "percent": {
      const now =
        currentPct === null ? "" : ` (teraz ${formatPercentFixed(currentPct)})`;
      return `Ustaw ok. ${formatPercentFixed(suggestion.pct)} puli ${poolTitle}${now} i zmniejsz pozostałe cele albo zwiększ procent puli.`;
    }
    case "over-100":
      return FORECAST_MESSAGES.over100;
    case "too-late":
      return FORECAST_MESSAGES.tooLate;
    case "enough":
      return FORECAST_MESSAGES.enough;
    case "eur-no-rate":
      return FORECAST_MESSAGES.eurNoRate;
  }
}
