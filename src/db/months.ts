import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { canCreateMonth } from "@/domain/time";
import type { Db, Tx } from "./client";
import {
  goals,
  incomes,
  months,
  monthGoals,
  settings,
  sources,
} from "./schema";

// Przychody i tworzenie miesięcy (SPEC 5.4, Z2). Miesiąc powstaje przy pierwszym
// przychodzie z migawką bieżącego planu (procenty pul i cele: pula, procent,
// źródło). Reguły pól sprawdza `domain` przed zapisem; tutaj pilnujemy spójności
// i współbieżności: jeden miesiąc na `YYYY-MM`, blokada rozliczonego, usunięcie
// ostatniego przychodu kasuje miesiąc razem z migawką (SPEC 7, P7).

export type IncomeInput = { name: string; amount: number };
export type IncomeRow = { id: number; name: string; amount: number };

export type MonthData = {
  id: number;
  month: string;
  savingsPct: number;
  investmentsPct: number;
  settled: boolean;
  /** Kurs zapisany przy rozliczeniu (SPEC 6.9); `null`, dopóki miesiąc otwarty. */
  settledEurRate: number | null;
  incomes: IncomeRow[];
};

/**
 * Cel z migawki planu miesiąca (`month_goals`) do ekranu „Ten miesiąc" (SPEC 5.4).
 * Pula i procent pochodzą z migawki (stan planu w chwili utworzenia miesiąca),
 * a nazwa, kwota docelowa i startowa z żywego celu, więc zmiana nazwy widać też
 * w starszych miesiącach (SPEC 8, scen. 8). Waluta to waluta źródła migawki.
 */
export type SnapshotGoal = {
  goalId: number;
  pool: "savings" | "investments";
  pct: number;
  name: string;
  sourceName: string;
  currency: "PLN" | "EUR";
  targetAmount: number | null;
  startAmount: number | null;
  /** Faktyczna wpłata tego miesiąca (SPEC 5.5); `null`, dopóki nierozliczony. */
  actualAmount: number | null;
  /** Postęp celu (SPEC 6.6): kwota startowa + suma wpłat z rozliczonych miesięcy. */
  progress: number;
};

export type AddIncomeResult =
  | { status: "ok"; monthId: number; created: boolean }
  /** Miesiąc nie istnieje i nie wolno go utworzyć (starszy niż poprzedni). */
  | { status: "cannot-create" }
  /** Miesiąc istnieje i jest rozliczony: edycja przychodów zablokowana. */
  | { status: "settled" };

export type EditIncomeResult = "ok" | "not-found" | "settled";

export type DeleteIncomeResult =
  | { status: "ok"; monthRemoved: boolean }
  | { status: "not-found" }
  | { status: "settled" };

/** Miesiąc użytkownika z pozycjami przychodu w kolejności dodania albo `null`. */
export async function getMonth(
  db: Db,
  userId: number,
  month: string,
): Promise<MonthData | null> {
  const [row] = await db
    .select({
      id: months.id,
      month: months.month,
      savingsPct: months.savingsPct,
      investmentsPct: months.investmentsPct,
      settledAt: months.settledAt,
      settledEurRate: months.settledEurRate,
    })
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.month, month)))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select({ id: incomes.id, name: incomes.name, amount: incomes.amount })
    .from(incomes)
    .where(eq(incomes.monthId, row.id))
    .orderBy(asc(incomes.id));
  return {
    id: row.id,
    month: row.month,
    savingsPct: row.savingsPct,
    investmentsPct: row.investmentsPct,
    settled: row.settledAt !== null,
    settledEurRate: row.settledEurRate,
    incomes: items,
  };
}

/**
 * Klucze nierozliczonych miesięcy z przeszłości (`YYYY-MM` < bieżący), od
 * najstarszego — każdy czeka na rozliczenie i dostaje osobną pigułkę na ekranie
 * „Ten miesiąc" (SPEC 5.5, T13). Miesiąc zawsze ma przychód (usunięcie ostatniej
 * pozycji kasuje miesiąc, P7), więc nie sprawdzamy tego osobno. Bieżący miesiąc
 * rozlicza się z własnej karty, więc go pomijamy.
 */
export async function listOverdueMonths(
  db: Db,
  userId: number,
  current: string,
): Promise<string[]> {
  const rows = await db
    .select({ month: months.month })
    .from(months)
    .where(
      and(
        eq(months.userId, userId),
        isNull(months.settledAt),
        lt(months.month, current),
      ),
    )
    .orderBy(asc(months.month));
  return rows.map((row) => row.month);
}

/**
 * Cele z migawki planu miesiąca w kolejności dodania (SPEC 5.3). Postęp każdego
 * celu liczy się z kwoty startowej i sumy faktycznych wpłat z rozliczonych
 * miesięcy — ręczne zmiany wartości źródła do niego nie wchodzą (SPEC 6.6).
 */
export async function getMonthSnapshot(
  db: Db,
  monthId: number,
): Promise<SnapshotGoal[]> {
  // Suma faktycznych wpłat na ten cel ze wszystkich rozliczonych miesięcy,
  // skorelowana z zewnętrznym wierszem po `month_goals.goal_id`.
  const settledPaid = sql<number>`coalesce((
    select sum(mg2.actual_amount)
    from month_goals mg2
    join months m2 on m2.id = mg2.month_id
    where mg2.goal_id = month_goals.goal_id and m2.settled_at is not null
  ), 0)`;
  const rows = await db
    .select({
      goalId: monthGoals.goalId,
      pool: monthGoals.pool,
      pct: monthGoals.pct,
      name: goals.name,
      sourceName: sources.name,
      currency: sources.currency,
      targetAmount: goals.targetAmount,
      startAmount: goals.startAmount,
      actualAmount: monthGoals.actualAmount,
      // Suma `bigint` wraca ze sterownika jako string; rzutujemy na liczbę.
      progress: sql<string>`coalesce(${goals.startAmount}, 0) + ${settledPaid}`,
    })
    .from(monthGoals)
    .innerJoin(goals, eq(goals.id, monthGoals.goalId))
    .innerJoin(sources, eq(sources.id, monthGoals.sourceId))
    .where(eq(monthGoals.monthId, monthId))
    .orderBy(asc(goals.position), asc(goals.id));
  return rows.map((row) => ({ ...row, progress: Number(row.progress) }));
}

/**
 * Dodaje pozycję przychodu. Jeśli miesiąca jeszcze nie ma, tworzy go z migawką
 * bieżącego planu — ale tylko bieżący albo bezpośrednio poprzedni (SPEC 5.4,
 * `canCreateMonth`). Istniejący rozliczony miesiąc jest zablokowany: wiersz
 * miesiąca blokujemy `for update`, więc sprawdzenie `settled_at` serializuje się
 * z rozliczeniem (`db/settlement.ts`) i równoległe rozliczenie nie przejdzie
 * między sprawdzeniem a wstawieniem przychodu.
 */
export async function addIncome(
  db: Db,
  userId: number,
  month: string,
  input: IncomeInput,
  now: Date,
): Promise<AddIncomeResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: months.id, settledAt: months.settledAt })
      .from(months)
      .where(and(eq(months.userId, userId), eq(months.month, month)))
      .for("update")
      .limit(1);

    if (existing) {
      if (existing.settledAt !== null) return { status: "settled" };
      await insertIncome(tx, existing.id, input);
      return { status: "ok", monthId: existing.id, created: false };
    }

    if (!canCreateMonth(month, now)) return { status: "cannot-create" };

    const { id, created } = await ensureMonth(tx, userId, month);
    await insertIncome(tx, id, input);
    return { status: "ok", monthId: id, created };
  });
}

/**
 * Zapisuje edycję pozycji przychodu nierozliczonego miesiąca (SPEC 5.4).
 * Rozliczony miesiąc jest zablokowany; wiersz miesiąca jest zablokowany na czas
 * sprawdzenia, więc równoległe rozliczenie nie przejdzie między nimi.
 */
export async function updateIncome(
  db: Db,
  userId: number,
  incomeId: number,
  input: IncomeInput,
): Promise<EditIncomeResult> {
  return db.transaction(async (tx) => {
    const guard = await lockIncomeMonth(tx, userId, incomeId);
    if (guard === "not-found") return "not-found";
    if (guard === "settled") return "settled";
    await tx
      .update(incomes)
      .set({ name: input.name, amount: input.amount })
      .where(eq(incomes.id, incomeId));
    return "ok";
  });
}

/**
 * Usuwa pozycję przychodu nierozliczonego miesiąca. Gdy była ostatnia, kasuje
 * miesiąc razem z migawką planu (kaskada na `month_goals`): wraca pusty stan
 * (SPEC 7, P7). Blokada wiersza miesiąca serializuje równoległe usuwanie, więc
 * dwie ostatnie pozycje nie zostawią miesiąca bez przychodu ani nie skasują go
 * dwa razy.
 */
export async function deleteIncome(
  db: Db,
  userId: number,
  incomeId: number,
): Promise<DeleteIncomeResult> {
  return db.transaction(async (tx) => {
    const guard = await lockIncomeMonth(tx, userId, incomeId);
    if (guard === "not-found") return { status: "not-found" };
    if (guard === "settled") return { status: "settled" };
    await tx.delete(incomes).where(eq(incomes.id, incomeId));
    const remaining = await tx
      .select({ id: incomes.id })
      .from(incomes)
      .where(eq(incomes.monthId, guard.monthId))
      .limit(1);
    if (remaining.length > 0) return { status: "ok", monthRemoved: false };
    await tx
      .delete(months)
      .where(and(eq(months.id, guard.monthId), eq(months.userId, userId)));
    return { status: "ok", monthRemoved: true };
  });
}

async function insertIncome(tx: Tx, monthId: number, input: IncomeInput) {
  await tx
    .insert(incomes)
    .values({ monthId, name: input.name, amount: input.amount });
}

/**
 * Blokuje wiersz miesiąca pozycji przychodu i zwraca jego stan. `of: months`
 * zakłada blokadę tylko na miesiąc (nie na pozycję), więc równoległe rozliczenie
 * albo usuwanie innej pozycji tego miesiąca czeka.
 */
async function lockIncomeMonth(
  tx: Tx,
  userId: number,
  incomeId: number,
): Promise<"not-found" | "settled" | { monthId: number }> {
  const [row] = await tx
    .select({ monthId: months.id, settledAt: months.settledAt })
    .from(incomes)
    .innerJoin(months, eq(months.id, incomes.monthId))
    .where(and(eq(incomes.id, incomeId), eq(months.userId, userId)))
    .for("update", { of: months })
    .limit(1);
  if (!row) return "not-found";
  if (row.settledAt !== null) return "settled";
  return { monthId: row.monthId };
}

/**
 * Tworzy miesiąc z migawką bieżącego planu albo zwraca już istniejący (gdy
 * równoległy przychód utworzył go pierwszy). Źródła celów są blokowane `for
 * share` z warunkiem `archived_at is null` — kontrakt z `db/sources.ts`: pod tą
 * blokadą archiwizacja źródła z migawki czeka, a klucz obcy migawki do źródła
 * (odroczony, migracja 0001) pozostaje spójny.
 */
async function ensureMonth(
  tx: Tx,
  userId: number,
  month: string,
): Promise<{ id: number; created: boolean }> {
  const planGoals = await tx
    .select({
      id: goals.id,
      pool: goals.pool,
      pct: goals.pct,
      sourceId: goals.sourceId,
    })
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.removedAt)))
    .orderBy(asc(goals.position), asc(goals.id));

  const sourceIds = [...new Set(planGoals.map((goal) => goal.sourceId))];
  if (sourceIds.length > 0) {
    await tx
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.userId, userId),
          isNull(sources.archivedAt),
          inArray(sources.id, sourceIds),
        ),
      )
      .orderBy(asc(sources.id))
      .for("share");
  }

  const [setting] = await tx
    .select({
      savingsPct: settings.savingsPct,
      investmentsPct: settings.investmentsPct,
    })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  const inserted = await tx
    .insert(months)
    .values({
      userId,
      month,
      savingsPct: setting?.savingsPct ?? 0,
      investmentsPct: setting?.investmentsPct ?? 0,
    })
    .onConflictDoNothing({ target: [months.userId, months.month] })
    .returning({ id: months.id });

  if (inserted.length === 0) {
    const [row] = await tx
      .select({ id: months.id })
      .from(months)
      .where(and(eq(months.userId, userId), eq(months.month, month)))
      .limit(1);
    return { id: row.id, created: false };
  }

  const monthId = inserted[0].id;
  if (planGoals.length > 0) {
    await tx.insert(monthGoals).values(
      planGoals.map((goal) => ({
        monthId,
        goalId: goal.id,
        pool: goal.pool,
        pct: goal.pct,
        sourceId: goal.sourceId,
      })),
    );
  }
  return { id: monthId, created: true };
}
