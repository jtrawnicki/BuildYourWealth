import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, getDb, getPool } from "./client";
import {
  goals,
  incomes,
  monthGoals,
  months,
  settings,
  sources,
  users,
} from "./schema";

const db = getDb();

let userId: number;
let sourceId: number;
let goalId: number;
let monthId: number;

/** Sprawdza, że zapis odrzuciło ograniczenie bazy o podanej nazwie. */
async function expectRejectedBy(
  query: PromiseLike<unknown>,
  constraint: string | RegExp,
): Promise<void> {
  type PgError = { constraint?: string; cause?: PgError };
  const error = await Promise.resolve(query).then(
    () => undefined,
    (e: unknown) => e as PgError,
  );
  // Drizzle opakowuje błąd sterownika `pg` w `cause`.
  const actual = error?.cause?.constraint ?? error?.constraint;
  if (typeof constraint === "string") {
    expect(actual).toBe(constraint);
  } else {
    expect(actual).toMatch(constraint);
  }
}

beforeAll(async () => {
  [{ id: userId }] = await db
    .insert(users)
    .values({ email: `schema-${randomUUID()}@example.com`, passwordHash: "x" })
    .returning({ id: users.id });
  await db.insert(settings).values({ userId, eurRate: 42850 });
  [{ id: sourceId }] = await db
    .insert(sources)
    .values({ userId, name: "Konto", kind: "savings", currency: "PLN" })
    .returning({ id: sources.id });
  [{ id: goalId }] = await db
    .insert(goals)
    .values({
      userId,
      pool: "savings",
      name: "Poduszka",
      pct: 5000,
      sourceId,
      position: 0,
    })
    .returning({ id: goals.id });
  [{ id: monthId }] = await db
    .insert(months)
    .values({
      userId,
      month: "2026-10",
      savingsPct: 2000,
      investmentsPct: 1500,
    })
    .returning({ id: months.id });
  await db
    .insert(monthGoals)
    .values({ monthId, goalId, pool: "savings", pct: 5000, sourceId });
  await db.insert(incomes).values({ monthId, name: "Pensja", amount: 850000 });
});

afterAll(async () => {
  // Dane finansowe nie usuwają się kaskadowo z kontem (schema.ts).
  await db.delete(months).where(eq(months.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));
  await db.delete(sources).where(eq(sources.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await closePool();
});

describe("migracja", () => {
  it("tworzy wszystkie tabele z STACK 4", async () => {
    const { rows } = await getPool().query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "goals",
      "incomes",
      "month_goals",
      "months",
      "sessions",
      "settings",
      "sources",
      "users",
    ]);
  });

  it("zapisuje i odczytuje kwoty jako liczby", async () => {
    const [income] = await db
      .select()
      .from(incomes)
      .where(eq(incomes.monthId, monthId));
    expect(income.amount).toBe(850000);
  });
});

describe("baza odrzuca ujemne kwoty", () => {
  it("wartość źródła", () =>
    expectRejectedBy(
      db.insert(sources).values({
        userId,
        name: "X",
        kind: "savings",
        currency: "PLN",
        value: -1,
      }),
      "sources_value_nonnegative",
    ));

  it("kwota przychodu ujemna i zerowa", async () => {
    await expectRejectedBy(
      db.insert(incomes).values({ monthId, name: "X", amount: -1 }),
      "incomes_amount_positive",
    );
    await expectRejectedBy(
      db.insert(incomes).values({ monthId, name: "X", amount: 0 }),
      "incomes_amount_positive",
    );
  });

  it("kwota docelowa i startowa celu", async () => {
    const goal = {
      userId,
      pool: "savings" as const,
      name: "X",
      pct: 100,
      sourceId,
      position: 1,
    };
    await expectRejectedBy(
      db.insert(goals).values({ ...goal, targetAmount: -1 }),
      "goals_target_nonnegative",
    );
    await expectRejectedBy(
      db.insert(goals).values({ ...goal, startAmount: -1 }),
      "goals_start_nonnegative",
    );
  });

  it("faktyczna kwota rozliczenia", () =>
    expectRejectedBy(
      db
        .update(monthGoals)
        .set({ actualAmount: -1 })
        .where(eq(monthGoals.monthId, monthId)),
      "month_goals_actual_nonnegative",
    ));
});

describe("baza odrzuca procent poza zakresem", () => {
  it("ujemny procent puli w ustawieniach i w miesiącu", async () => {
    await expectRejectedBy(
      db
        .update(settings)
        .set({ savingsPct: -1 })
        .where(eq(settings.userId, userId)),
      "settings_savings_pct_range",
    );
    await expectRejectedBy(
      db
        .update(settings)
        .set({ investmentsPct: -1 })
        .where(eq(settings.userId, userId)),
      "settings_investments_pct_range",
    );
    await expectRejectedBy(
      db.update(months).set({ savingsPct: -1 }).where(eq(months.id, monthId)),
      "months_savings_pct_range",
    );
    await expectRejectedBy(
      db
        .update(months)
        .set({ investmentsPct: -1 })
        .where(eq(months.id, monthId)),
      "months_investments_pct_range",
    );
  });

  // Pula powyżej 100% zawsze przekracza też sumę pul.
  it("pula albo suma pul powyżej 100%", async () => {
    await expectRejectedBy(
      db
        .update(settings)
        .set({ savingsPct: 10001, investmentsPct: 0 })
        .where(eq(settings.userId, userId)),
      "settings_pools_sum",
    );
    await expectRejectedBy(
      db
        .update(settings)
        .set({ savingsPct: 6000, investmentsPct: 4001 })
        .where(eq(settings.userId, userId)),
      "settings_pools_sum",
    );
    await expectRejectedBy(
      db
        .update(months)
        .set({ savingsPct: 6000, investmentsPct: 4001 })
        .where(eq(months.id, monthId)),
      "months_pools_sum",
    );
  });

  it("procent celu równy 0 albo powyżej 100%", async () => {
    await expectRejectedBy(
      db.update(goals).set({ pct: 0 }).where(eq(goals.id, goalId)),
      "goals_pct_range",
    );
    await expectRejectedBy(
      db.update(goals).set({ pct: 10001 }).where(eq(goals.id, goalId)),
      "goals_pct_range",
    );
    await expectRejectedBy(
      db
        .update(monthGoals)
        .set({ pct: 0 })
        .where(eq(monthGoals.monthId, monthId)),
      "month_goals_pct_range",
    );
  });

  it("przyjmuje granice zakresu", async () => {
    await db
      .update(settings)
      .set({ savingsPct: 0, investmentsPct: 10000 })
      .where(eq(settings.userId, userId));
    await db.update(goals).set({ pct: 10000 }).where(eq(goals.id, goalId));
  });
});

describe("baza odrzuca kurs ≤ 0", () => {
  it("kurs w ustawieniach", async () => {
    for (const eurRate of [0, -42850]) {
      await expectRejectedBy(
        db.update(settings).set({ eurRate }).where(eq(settings.userId, userId)),
        "settings_eur_rate_positive",
      );
    }
  });

  it("kurs zapisany przy rozliczeniu", () =>
    expectRejectedBy(
      db
        .update(months)
        .set({ settledAt: new Date(), settledEurRate: 0 })
        .where(eq(months.id, monthId)),
      "months_settled_eur_rate_positive",
    ));
});

describe("miesiące", () => {
  it("drugi miesiąc o tym samym YYYY-MM jest odrzucony", () =>
    expectRejectedBy(
      db
        .insert(months)
        .values({ userId, month: "2026-10", savingsPct: 0, investmentsPct: 0 }),
      "months_user_month_unique",
    ));

  it("miesiąc musi mieć format YYYY-MM", async () => {
    for (const month of ["2026-13", "2026-1", "2026-00", "październik"]) {
      await expectRejectedBy(
        db
          .insert(months)
          .values({ userId, month, savingsPct: 0, investmentsPct: 0 }),
        "months_month_format",
      );
    }
  });

  it("usunięcie miesiąca usuwa jego przychody i migawkę celów", async () => {
    const [{ id }] = await db
      .insert(months)
      .values({ userId, month: "2026-09", savingsPct: 0, investmentsPct: 0 })
      .returning({ id: months.id });
    await db.insert(incomes).values({ monthId: id, name: "Premia", amount: 1 });
    await db
      .insert(monthGoals)
      .values({ monthId: id, goalId, pool: "savings", pct: 100, sourceId });
    await db.delete(months).where(eq(months.id, id));
    const { rows } = await getPool().query(
      "select 1 from incomes where month_id = $1 union all select 1 from month_goals where month_id = $1",
      [id],
    );
    expect(rows).toEqual([]);
  });
});

describe("pozostałe ograniczenia", () => {
  it("konta z danymi finansowymi nie da się usunąć", () =>
    expectRejectedBy(
      db.delete(users).where(eq(users.id, userId)),
      /^(sources|goals|months)_user_id_users_id_fk$/,
    ));

  it("celu użytego w migawce miesiąca nie da się usunąć", () =>
    expectRejectedBy(
      db.delete(goals).where(eq(goals.id, goalId)),
      "month_goals_goal_id_goals_id_fk",
    ));

  it("nazwa od 1 do 60 znaków", async () => {
    await expectRejectedBy(
      db.insert(incomes).values({ monthId, name: "", amount: 1 }),
      "incomes_name_length",
    );
    await expectRejectedBy(
      db.insert(incomes).values({ monthId, name: "x".repeat(61), amount: 1 }),
      "incomes_name_length",
    );
    await db
      .insert(incomes)
      .values({ monthId, name: "ż".repeat(60), amount: 1 });
  });

  it("typ i waluta źródła z dozwolonej listy", async () => {
    await expectRejectedBy(
      getPool().query(
        "insert into sources (user_id, name, kind, currency) values ($1, 'X', 'crypto', 'PLN')",
        [userId],
      ),
      "sources_kind_valid",
    );
    await expectRejectedBy(
      getPool().query(
        "insert into sources (user_id, name, kind, currency) values ($1, 'X', 'savings', 'USD')",
        [userId],
      ),
      "sources_currency_valid",
    );
  });

  it("zarchiwizowane źródło ma wartość 0", async () => {
    await expectRejectedBy(
      db.insert(sources).values({
        userId,
        name: "X",
        kind: "savings",
        currency: "PLN",
        value: 50000,
        archivedAt: new Date(),
      }),
      "sources_archived_empty",
    );
  });

  it("e-mail konta zapisany małymi literami bez spacji", () =>
    expectRejectedBy(
      db
        .insert(users)
        .values({ email: "Owner@Example.com", passwordHash: "x" }),
      "users_email_normalized",
    ));
});
