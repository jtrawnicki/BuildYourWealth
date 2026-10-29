import { and, asc, eq, sql } from "drizzle-orm";
import { computeMonthPlan } from "@/domain/plan";
import { plannedActual } from "@/domain/settlement";
import type { ChosenRate } from "@/rates/select";
import type { Db } from "./client";
import { incomes, months, monthGoals, sources } from "./schema";
import { changeSourceValue } from "./sources";

/** Czy istniejący miesiąc ma w migawce cel ze źródłem EUR (reguła 6.10). */
export async function monthHasEurGoal(
  db: Db,
  userId: number,
  month: string,
): Promise<{ exists: boolean; hasEur: boolean }> {
  const rows = await db
    .select({ currency: sources.currency })
    .from(months)
    .leftJoin(monthGoals, eq(monthGoals.monthId, months.id))
    .leftJoin(sources, eq(sources.id, monthGoals.sourceId))
    .where(and(eq(months.userId, userId), eq(months.month, month)));
  if (rows.length === 0) return { exists: false, hasEur: false };
  return { exists: true, hasEur: rows.some((r) => r.currency === "EUR") };
}

// Rozliczenie miesiąca (SPEC 5.5). Faktyczne kwoty celów są dopisywane do
// wartości połączonych źródeł, zapisywane w migawce (`month_goals.actual_amount`)
// i miesiąc staje się rozliczony. Operacja jest atomowa i jednorazowa: wiersz
// miesiąca jest blokowany `for update`, więc drugie rozliczenie (druga karta,
// podwójne kliknięcie, dwa równoległe zapisy) widzi już rozliczony miesiąc i nie
// zmienia wartości źródeł drugi raz (SPEC 5.5, scen. 15). Ta sama blokada
// serializuje rozliczenie z edycją przychodów (`db/months.ts`), więc opcja
// „plan zrealizowany" liczy plan ze spójnego przychodu.

/** Faktyczna wpłata na cel, w walucie jego źródła (grosze albo eurocenty). */
export type ActualAmount = { goalId: number; amount: number };

export type SettleInput =
  /** „Tak, plan zrealizowany": kwoty faktyczne = plan (SPEC 5.5). */
  | { mode: "plan" }
  /** „Nie, wpiszę faktyczne kwoty": kwota przy każdym celu migawki (także 0). */
  | { mode: "manual"; actuals: ActualAmount[] };

export type SettleResult =
  | { status: "ok" }
  /** Miesiąc nie istnieje (np. usunięty po otwarciu ekranu). */
  | { status: "not-found" }
  /** Miesiąc jest już rozliczony (SPEC 5.5, scen. 15). */
  | { status: "already-settled" }
  /** Cel w EUR bez ustawionego kursu — nie da się przeliczyć ani zapisać (SPEC 7). */
  | { status: "no-rate" }
  /** Brak faktycznej kwoty dla celu migawki albo kwota niepoprawna (tryb ręczny). */
  | { status: "invalid" };

/**
 * Rozlicza miesiąc atomowo (SPEC 5.5). Reguły pól (kwota ≥ 0) sprawdza `domain`
 * przed zapisem; tutaj pilnujemy spójności i współbieżności. Kwoty EUR są
 * zapisywane w walucie źródła, a użyty kurs rozliczenia (reguła 6.10) wraz
 * z datą tabeli i pochodzeniem trafia do `months`, żeby historia nie zmieniała
 * się po zmianie kursu (SPEC 6.9, 5.6). Kurs ustala wcześniej akcja (poza
 * transakcją, STACK „Kurs NBP”) i podaje go w `rate`; miesiąc bez celu EUR
 * dostaje `rate = null` i nie zapisuje żadnego kursu.
 */
export async function settleMonth(
  db: Db,
  userId: number,
  month: string,
  input: SettleInput,
  rate: ChosenRate | null,
): Promise<SettleResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: months.id,
        settledAt: months.settledAt,
        savingsPct: months.savingsPct,
        investmentsPct: months.investmentsPct,
      })
      .from(months)
      .where(and(eq(months.userId, userId), eq(months.month, month)))
      .for("update")
      .limit(1);
    if (!row) return { status: "not-found" };
    if (row.settledAt !== null) return { status: "already-settled" };

    const snapshot = await tx
      .select({
        goalId: monthGoals.goalId,
        pool: monthGoals.pool,
        pct: monthGoals.pct,
        sourceId: monthGoals.sourceId,
        currency: sources.currency,
      })
      .from(monthGoals)
      .innerJoin(sources, eq(sources.id, monthGoals.sourceId))
      .where(eq(monthGoals.monthId, row.id))
      .orderBy(asc(monthGoals.goalId));

    const hasEur = snapshot.some((goal) => goal.currency === "EUR");

    // Kurs ustala akcja przed transakcją (reguła 6.10). Miesiąc z celem EUR bez
    // kursu nie da się rozliczyć; miesiąc bez celu EUR kursu nie potrzebuje.
    if (hasEur && rate === null) return { status: "no-rate" };
    const rateValue = hasEur ? rate!.rate : null;

    const actualByGoal = new Map<number, number>();
    if (input.mode === "plan") {
      const incomeRows = await tx
        .select({ amount: incomes.amount })
        .from(incomes)
        .where(eq(incomes.monthId, row.id));
      const income = incomeRows.reduce((sum, item) => sum + item.amount, 0);
      const plan = computeMonthPlan({
        income,
        savingsPct: row.savingsPct,
        investmentsPct: row.investmentsPct,
        goals: snapshot.map((goal) => ({
          id: goal.goalId,
          pool: goal.pool,
          pct: goal.pct,
        })),
      });
      const planByGoal = new Map(plan.goals.map((g) => [g.id, g.amount]));
      for (const goal of snapshot) {
        const amount = plannedActual(
          planByGoal.get(goal.goalId) ?? 0,
          goal.currency,
          rateValue,
        );
        actualByGoal.set(goal.goalId, amount);
      }
    } else {
      const provided = new Map(input.actuals.map((a) => [a.goalId, a.amount]));
      for (const goal of snapshot) {
        const amount = provided.get(goal.goalId);
        if (
          amount === undefined ||
          !Number.isSafeInteger(amount) ||
          amount < 0
        ) {
          return { status: "invalid" };
        }
        actualByGoal.set(goal.goalId, amount);
      }
    }

    // Suma wpłat per źródło: dwa cele na to samo źródło dokładają się razem
    // (SPEC 7: dwa cele połączone z tym samym źródłem są dozwolone).
    const deltaBySource = new Map<number, number>();
    for (const goal of snapshot) {
      const amount = actualByGoal.get(goal.goalId) ?? 0;
      deltaBySource.set(
        goal.sourceId,
        (deltaBySource.get(goal.sourceId) ?? 0) + amount,
      );
    }
    for (const [sourceId, delta] of deltaBySource) {
      if (delta === 0) continue;
      await changeSourceValue(tx, userId, sourceId, { delta }, "settlement");
    }

    for (const goal of snapshot) {
      await tx
        .update(monthGoals)
        .set({ actualAmount: actualByGoal.get(goal.goalId) ?? 0 })
        .where(
          and(
            eq(monthGoals.monthId, row.id),
            eq(monthGoals.goalId, goal.goalId),
          ),
        );
    }

    await tx
      .update(months)
      .set({
        settledAt: sql`now()`,
        settledEurRate: rateValue,
        settledRateSource: hasEur ? rate!.source : null,
        settledRateDate: hasEur && rate!.source === "nbp" ? rate!.date : null,
      })
      .where(and(eq(months.id, row.id), eq(months.userId, userId)));

    return { status: "ok" };
  });
}
