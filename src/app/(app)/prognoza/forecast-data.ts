// Składa wejście prognozy majątku (reguła 6.14) z zapytań `db/` używanych już
// przez „Ten miesiąc", Majątek i Historię (STACK „Prognoza majątku"). Server
// Component liczy serie, a metadane źródeł (nazwa, pula, cele, waluta) dołączamy
// obok, bo `summarizeHorizon` zna źródła tylko po `id`.

import type { Db } from "@/db/client";
import { listHistory } from "@/db/months";
import { getPlan } from "@/db/plan";
import { listSources } from "@/db/sources";
import { convertEurToPln } from "@/domain/currency";
import type { Currency } from "@/domain/format";
import { currentMonth } from "@/domain/time";
import {
  buildWealthForecast,
  type WealthForecast,
} from "@/domain/wealth-forecast";
import { resolveCurrentRate } from "@/rates/current-rate";
import { chosenRateText } from "@/rates/label";

/** Wiersz tabeli „Źródła w prognozie" poza liczbami z `summarizeHorizon` (SPEC 5.13). */
export type SourceMeta = {
  id: number;
  name: string;
  /** „Oszczędności" albo „Inwestycje". */
  poolTitle: string;
  /** Nazwy celów połączonych ze źródłem w kolejności dodania; `null` = bez celu. */
  goalsLabel: string | null;
  currency: Currency;
  /** Zakładana stopa w setnych procenta albo `null` (brak). */
  rate: number | null;
  /** Wartość dziś w EUR (eurocenty) do dopisku przy źródle EUR; `null` dla PLN. */
  eurValue: number | null;
};

export type ForecastData = {
  forecast: WealthForecast;
  sources: SourceMeta[];
  /** Pochodzenie bieżącego kursu dla dopisku o źródłach EUR (SPEC 5.9); `null` bez EUR. */
  eurRateText: string | null;
};

const POOL_TITLE = {
  savings: "Oszczędności",
  investments: "Inwestycje",
} as const;

/** Zbiera dane i liczy serie prognozy (reguła 6.14) dla bieżącego stanu. */
export async function loadForecast(
  db: Db,
  userId: number,
  now: Date,
): Promise<ForecastData> {
  const [rows, plan, history, rate] = await Promise.all([
    listSources(db, userId),
    getPlan(db, userId),
    listHistory(db, userId),
    resolveCurrentRate(db, userId, now),
  ]);

  // Prognoza liczy tylko aktywne źródła niewykluczone z majątku (SPEC 5.2, 6.14).
  const active = rows.filter((row) => !row.excludedFromNetWorth);
  const currentRate = rate?.rate ?? null;
  const current = currentMonth(now);

  const forecast = buildWealthForecast({
    sources: active.map((row) => ({
      id: row.id,
      currency: row.currency,
      value: row.value,
      rate: row.expectedReturn,
    })),
    plan: {
      savingsPct: plan.savingsPct,
      investmentsPct: plan.investmentsPct,
      goals: plan.goals.map((goal) => ({
        id: goal.id,
        pool: goal.pool,
        pct: goal.pct,
        sourceId: goal.sourceId,
      })),
    },
    months: history.map((month) => ({
      month: month.month,
      income: month.income,
    })),
    settledMonths: history
      .filter((month) => month.settled)
      .map((month) => ({
        month: month.month,
        actualTotalPln: settledTotalPln(month),
      })),
    currentMonth: current,
    currentRate,
  });

  const goalsBySource = new Map<number, string[]>();
  for (const goal of plan.goals) {
    const list = goalsBySource.get(goal.sourceId) ?? [];
    list.push(goal.name);
    goalsBySource.set(goal.sourceId, list);
  }

  const sources: SourceMeta[] = active.map((row) => ({
    id: row.id,
    name: row.name,
    poolTitle: POOL_TITLE[row.kind],
    goalsLabel: goalsBySource.get(row.id)?.join(", ") ?? null,
    currency: row.currency,
    rate: row.expectedReturn,
    eurValue: row.currency === "EUR" ? row.value : null,
  }));

  const hasEur = active.some((row) => row.currency === "EUR");
  return {
    forecast,
    sources,
    eurRateText: hasEur && rate !== null ? chosenRateText(rate) : null,
  };
}

/**
 * Suma faktycznych wpłat wszystkich celów rozliczonego miesiąca w PLN; kwoty EUR
 * po kursie rozliczenia tego miesiąca (reguła 6.14, 8). Brak kursu nie powinien
 * wystąpić dla celu EUR rozliczonego miesiąca, ale 0 to bezpieczny zapas.
 */
function settledTotalPln(month: {
  settledEurRate: number | null;
  goals: { currency: Currency; actualAmount: number | null }[];
}): number {
  return month.goals.reduce((sum, goal) => {
    const actual = goal.actualAmount ?? 0;
    if (goal.currency === "PLN") return sum + actual;
    return (
      sum +
      (month.settledEurRate ? convertEurToPln(actual, month.settledEurRate) : 0)
    );
  }, 0);
}
