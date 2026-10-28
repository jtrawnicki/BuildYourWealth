import { and, asc, eq, sql } from "drizzle-orm";
import { computeMonthPlan } from "@/domain/plan";
import { plannedActual } from "@/domain/settlement";
import type { Db } from "./client";
import { incomes, months, monthGoals, settings, sources } from "./schema";
import { changeSourceValue } from "./sources";

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
 * zapisywane w walucie źródła, a użyty kurs trafia do `months.settled_eur_rate`,
 * żeby historia nie zmieniała się po zmianie kursu (SPEC 6.9, 5.6).
 */
export async function settleMonth(
  db: Db,
  userId: number,
  month: string,
  input: SettleInput,
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

    const [setting] = await tx
      .select({ eurRate: settings.eurRate })
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1);
    const rate = setting?.eurRate ?? null;
    if (hasEur && rate === null) return { status: "no-rate" };

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
          rate,
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
      .set({ settledAt: sql`now()`, settledEurRate: hasEur ? rate : null })
      .where(and(eq(months.id, row.id), eq(months.userId, userId)));

    return { status: "ok" };
  });
}
