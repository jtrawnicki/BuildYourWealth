// Prognoza celu i status terminu (SPEC 5.12, reguły 6.12–6.13). Czyste funkcje
// na liczbach całkowitych: kwoty w groszach albo eurocentach, procenty w setnych
// procenta, kurs w dziesięciotysięcznych. Kwoty wejścia i wyjścia są w walucie
// celu (SPEC 6.9); kwoty celu z planu (reguła 3) i kwoty bazowe puli (reguła 2)
// są w PLN i — dla celu EUR — przeliczane po bieżącym kursie (reguła 6.10).

import { ceilMulDiv, floorMulDiv } from "./arithmetic";
import { convertEurToPln, convertPlnToEur } from "./currency";
import type { Currency } from "./format";
import { computeMonthPlan, type Pool } from "./plan";
import { addMonths, compareMonths } from "./time";

export type { Currency };

/** Istniejący miesiąc użytkownika z danymi potrzebnymi prognozie celu. */
export type GoalMonth = {
  /** Miesiąc kalendarzowy `YYYY-MM` (nie data rozliczenia). */
  month: string;
  settled: boolean;
  /** Czy migawka planu tego miesiąca zawiera ten cel. */
  hasGoal: boolean;
  /** Faktyczna kwota celu (reguła 6) w walucie celu, gdy rozliczony i ma cel. */
  actualAmount: number | null;
  /** Kwota celu z planu (reguła 3) w PLN; 0 gdy miesiąc nie ma tego celu. */
  planAmount: number;
  /** Kwota bazowa puli celu (reguła 2) w PLN. */
  poolBase: number;
};

export type GoalInput = {
  /** Waluta celu (jego źródła), SPEC 6.9. */
  currency: Currency;
  /** Kwota docelowa w walucie celu (cel bez niej nie ma prognozy). */
  targetAmount: number;
  /** Postęp celu (reguła 6) w walucie celu. */
  progress: number;
  /** Wszystkie istniejące miesiące użytkownika, w dowolnej kolejności. */
  months: GoalMonth[];
  /** Bieżący miesiąc kalendarzowy `YYYY-MM`. */
  currentMonth: string;
  /** Bieżący kurs EUR (reguła 6.10) w dziesięciotysięcznych, albo null. */
  currentRate: number | null;
};

/** Skąd pochodzi średnia wpłata (reguła 6.12): z rozliczeń czy z planu. */
export type AverageSource = "actual" | "planned";

export type Forecast =
  | { status: "reached" }
  | { status: "no-data"; firstMonth: string }
  | { status: "never"; firstMonth: string }
  | {
      status: "forecast";
      firstMonth: string;
      /** Średnia wpłata w walucie celu. */
      averageAmount: number;
      averageSource: AverageSource;
      /** Liczba wpłat n (reguła 6.12). */
      paymentsCount: number;
      /** Miesiąc osiągnięcia `YYYY-MM`. */
      achievementMonth: string;
    };

export type DeadlineStatus = "overdue" | "no-data" | "on-track" | "at-risk";

/**
 * Sugestia procentu albo komunikat zamiast niej (reguła 6.13), tylko przy
 * statusie „zagrożony” lub „brak danych”. `enough` i `too-late` zastępują
 * wymaganą wpłatę i sugestię; `over-100` i `eur-no-rate` — samą sugestię.
 */
export type Suggestion =
  | { kind: "none" }
  | { kind: "percent"; pct: number }
  | { kind: "over-100" }
  | { kind: "enough" }
  | { kind: "too-late" }
  | { kind: "eur-no-rate" };

export type DeadlineResult =
  | { status: "overdue"; firstMonth: string }
  | {
      status: "no-data" | "on-track" | "at-risk";
      firstMonth: string;
      /** Zaplanowane wpłaty od P do T (reguła 6.13) w walucie celu. */
      planned: number;
      /** Istniejące nierozliczone miesiące z celem od P do T, rosnąco. */
      plannedMonths: string[];
      /** Brakuje = pozostało − zaplanowane, w walucie celu. */
      shortfall: number;
      /** k: liczba miesięcy od P do T, które jeszcze nie istnieją. */
      futureMonths: number;
      /** Wymagana wpłata/miesiąc w walucie celu; null gdy brakuje ≤ 0 lub k = 0. */
      required: number | null;
      suggestion: Suggestion;
    };

/** Miesiące posortowane rosnąco po miesiącu kalendarzowym. */
function sortedByMonth(months: GoalMonth[]): GoalMonth[] {
  return [...months].sort((a, b) => compareMonths(a.month, b.month));
}

/**
 * Pierwszy miesiąc wpłaty P (reguła 6.12): najstarszy nierozliczony miesiąc
 * z celem; gdy takiego nie ma — bieżący miesiąc, jeśli nie jest rozliczony,
 * w przeciwnym razie następny.
 */
function firstPaymentMonth(currentMonth: string, sorted: GoalMonth[]): string {
  const oldestUnsettled = sorted.find((m) => m.hasGoal && !m.settled);
  if (oldestUnsettled) return oldestUnsettled.month;
  const currentSettled = sorted.some(
    (m) => m.month === currentMonth && m.settled,
  );
  return currentSettled ? addMonths(currentMonth, 1) : currentMonth;
}

/** Pierwszy miesiąc wpłaty P (reguła 6.12) — dolna granica terminu (SPEC 7.1). */
export function goalFirstMonth(
  months: GoalMonth[],
  currentMonth: string,
): string {
  return firstPaymentMonth(currentMonth, sortedByMonth(months));
}

/**
 * Kwota planu (reguła 3, w PLN) w walucie celu. Dla celu EUR przeliczana
 * regułą 8 po bieżącym kursie; bez kursu nie da się jej wyrazić w EUR (null).
 */
function planInGoalCurrency(
  planPln: number,
  currency: Currency,
  rate: number | null,
): number | null {
  // Zero przelicza się na zero bez kursu; tylko niezerowa kwota celu EUR
  // wymaga kursu (SPEC 7: bez kursu prosimy o niego zamiast sugestii).
  if (currency === "PLN" || planPln === 0) return planPln;
  if (rate === null) return null;
  return convertPlnToEur(planPln, rate);
}

/** Średnia arytmetyczna ostatnich ≤ 3 wartości, zaokrąglona w dół. */
function averageOfLast3(values: number[]): number {
  const last3 = values.slice(-3);
  const sum = last3.reduce((s, v) => s + v, 0);
  return floorMulDiv(sum, 1, last3.length);
}

/**
 * Prognoza celu z kwotą docelową, nieosiągniętego (reguła 6.12). Zwraca
 * `reached`, gdy cel jest już osiągnięty (pozostało ≤ 0); `no-data`, gdy cel
 * nie trafił jeszcze do planu żadnego miesiąca (ani do przeliczenia planu EUR
 * nie ma kursu); `never`, gdy średnia wpłata wynosi 0; w pozostałych
 * przypadkach miesiąc osiągnięcia.
 */
export function forecastGoal(input: GoalInput): Forecast {
  const sorted = sortedByMonth(input.months);
  return forecastFrom(
    input,
    sorted,
    firstPaymentMonth(input.currentMonth, sorted),
  );
}

/**
 * Prognoza z już posortowanymi miesiącami i wyliczonym P — wspólna dla
 * `forecastGoal` i `goalDeadline`, żeby nie sortować i nie liczyć P dwa razy.
 */
function forecastFrom(
  input: GoalInput,
  sorted: GoalMonth[],
  firstMonth: string,
): Forecast {
  const remaining = input.targetAmount - input.progress;
  if (remaining <= 0) return { status: "reached" };

  const settledWithGoal = sorted.filter((m) => m.hasGoal && m.settled);
  let averageAmount: number;
  let averageSource: AverageSource;
  if (settledWithGoal.length > 0) {
    averageAmount = averageOfLast3(
      settledWithGoal.map((m) => m.actualAmount ?? 0),
    );
    averageSource = "actual";
  } else {
    const oldestUnsettled = sorted.find((m) => m.hasGoal && !m.settled);
    if (!oldestUnsettled) return { status: "no-data", firstMonth };
    const planned = planInGoalCurrency(
      oldestUnsettled.planAmount,
      input.currency,
      input.currentRate,
    );
    if (planned === null) return { status: "no-data", firstMonth };
    averageAmount = planned;
    averageSource = "planned";
  }

  if (averageAmount === 0) return { status: "never", firstMonth };

  const paymentsCount = ceilMulDiv(remaining, 1, averageAmount);
  return {
    status: "forecast",
    firstMonth,
    averageAmount,
    averageSource,
    paymentsCount,
    achievementMonth: addMonths(firstMonth, paymentsCount - 1),
  };
}

/**
 * Średnia kwota bazowa puli (reguła 6.13): z ostatnich ≤ 3 rozliczonych
 * miesięcy z celem; gdy takich nie ma — kwota bazowa najnowszego istniejącego
 * miesiąca; gdy i jego brak albo wynosi 0 — null (sugestii procentu nie ma).
 */
function averagePoolBase(sorted: GoalMonth[]): number | null {
  const settledWithGoal = sorted.filter((m) => m.hasGoal && m.settled);
  if (settledWithGoal.length > 0) {
    return averageOfLast3(settledWithGoal.map((m) => m.poolBase));
  }
  if (sorted.length === 0) return null;
  const base = sorted[sorted.length - 1].poolBase;
  return base === 0 ? null : base;
}

/** Sugerowany procent (reguła 6.13) albo komunikat zamiast niego. */
function suggestPercent(
  required: number,
  sorted: GoalMonth[],
  currency: Currency,
  rate: number | null,
): Suggestion {
  const requiredPln =
    currency === "EUR"
      ? rate === null
        ? null
        : convertEurToPln(required, rate)
      : required;
  if (requiredPln === null) return { kind: "eur-no-rate" };
  const base = averagePoolBase(sorted);
  if (base === null) return { kind: "none" };
  const pct = ceilMulDiv(requiredPln, 10_000, base);
  return pct > 10_000 ? { kind: "over-100" } : { kind: "percent", pct };
}

/**
 * Status celu z terminem T i obliczenia wymaganej wpłaty (reguła 6.13). Dla
 * celu nieosiągniętego; cel osiągnięty nie ma statusu terminu (SPEC 5.12).
 * `overdue` gdy T wcześniejszy niż P. W pozostałych statusach liczy
 * `zaplanowane`, k, `brakuje` i wymaganą wpłatę; sugestia (albo komunikat
 * zamiast niej) jest tylko przy „zagrożony” i „brak danych”.
 */
export function goalDeadline(
  input: GoalInput,
  deadline: string,
): DeadlineResult {
  const sorted = sortedByMonth(input.months);
  const firstMonth = firstPaymentMonth(input.currentMonth, sorted);
  const forecast = forecastFrom(input, sorted, firstMonth);

  if (compareMonths(deadline, firstMonth) < 0) {
    return { status: "overdue", firstMonth };
  }

  let status: "no-data" | "on-track" | "at-risk";
  if (forecast.status === "no-data") {
    status = "no-data";
  } else if (forecast.status === "never") {
    // Średnia 0 → cel nie zdąży przed terminem (SPEC 6.13).
    status = "at-risk";
  } else if (forecast.status === "reached") {
    // Cel osiągnięty nie ma statusu terminu (SPEC 5.12) — tu trafia tylko, gdy
    // warstwa wyżej nie odfiltrowała celu; nic nie jest zagrożone.
    status = "on-track";
  } else {
    status =
      compareMonths(forecast.achievementMonth, deadline) <= 0
        ? "on-track"
        : "at-risk";
  }

  const inRange = (month: string) =>
    compareMonths(month, firstMonth) >= 0 &&
    compareMonths(month, deadline) <= 0;
  const plannedInRange = sorted.filter(
    (m) => m.hasGoal && !m.settled && inRange(m.month),
  );
  const plannedPln = plannedInRange.reduce((sum, m) => sum + m.planAmount, 0);
  // Bez kursu kwot planu celu EUR nie da się wyrazić w EUR; traktujemy je jak 0
  // i prosimy o kurs (SPEC 7: „Ustaw kurs EUR, aby zobaczyć sugestię procentu”).
  const planned =
    planInGoalCurrency(plannedPln, input.currency, input.currentRate) ?? 0;

  const existing = new Set(sorted.map((m) => m.month));
  let futureMonths = 0;
  for (
    let month = firstMonth;
    compareMonths(month, deadline) <= 0;
    month = addMonths(month, 1)
  ) {
    if (!existing.has(month)) futureMonths += 1;
  }

  const remaining = input.targetAmount - input.progress;
  const shortfall = remaining - planned;
  const required =
    shortfall <= 0 || futureMonths === 0
      ? null
      : ceilMulDiv(shortfall, 1, futureMonths);

  let suggestion: Suggestion = { kind: "none" };
  if (status === "at-risk" || status === "no-data") {
    if (shortfall <= 0) {
      suggestion = { kind: "enough" };
    } else if (futureMonths === 0) {
      suggestion = { kind: "too-late" };
    } else {
      suggestion = suggestPercent(
        required as number,
        sorted,
        input.currency,
        input.currentRate,
      );
    }
  }

  return {
    status,
    firstMonth,
    planned,
    plannedMonths: plannedInRange.map((m) => m.month),
    shortfall,
    futureMonths,
    required,
    suggestion,
  };
}

/** Istniejący miesiąc użytkownika z migawką planu — wejście `goalMonths`. */
export type PlanMonth = {
  month: string;
  settled: boolean;
  /** Przychód miesiąca (reguła 1) w groszach. */
  income: number;
  savingsPct: number;
  investmentsPct: number;
  /** Cele migawki planu z faktyczną kwotą (gdy rozliczony). */
  goals: {
    goalId: number;
    pool: Pool;
    pct: number;
    actualAmount: number | null;
  }[];
};

/**
 * Miesiące użytkownika w postaci potrzebnej prognozie jednego celu (reguły
 * 6.12–6.13): kwota celu z planu miesiąca (reguła 3) i kwota bazowa puli celu
 * (reguła 2). Miesiąc bez celu w migawce ma kwotę bazową puli `pool` — tej,
 * do której cel należy teraz (nowy cel nie ma jeszcze migawki).
 */
export function goalMonths(
  goalId: number | null,
  pool: Pool,
  months: PlanMonth[],
): GoalMonth[] {
  return months.map((m) => {
    const entry = m.goals.find((g) => g.goalId === goalId);
    const goalPool = entry?.pool ?? pool;
    const poolPct = goalPool === "savings" ? m.savingsPct : m.investmentsPct;
    const plan = computeMonthPlan({
      income: m.income,
      savingsPct: m.savingsPct,
      investmentsPct: m.investmentsPct,
      goals: m.goals.map((g) => ({ id: g.goalId, pool: g.pool, pct: g.pct })),
    });
    return {
      month: m.month,
      settled: m.settled,
      hasGoal: entry !== undefined,
      actualAmount: entry && m.settled ? (entry.actualAmount ?? 0) : null,
      planAmount: plan.goals.find((g) => g.id === goalId)?.amount ?? 0,
      poolBase: floorMulDiv(m.income, poolPct, 10_000),
    };
  });
}

/**
 * Procent celu w najnowszym miesiącu z tym celem albo null. Gdy różni się od
 * procentu w bieżącym planie, prognoza dostaje dopisek o nowym procencie
 * (SPEC 5.12, P22).
 */
export function latestSnapshotPct(
  goalId: number,
  months: PlanMonth[],
): number | null {
  let latest: { month: string; pct: number } | null = null;
  for (const m of months) {
    const entry = m.goals.find((g) => g.goalId === goalId);
    if (
      entry &&
      (latest === null || compareMonths(m.month, latest.month) > 0)
    ) {
      latest = { month: m.month, pct: entry.pct };
    }
  }
  return latest?.pct ?? null;
}
