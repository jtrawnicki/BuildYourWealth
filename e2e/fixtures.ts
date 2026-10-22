import { test as base, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "@/auth/constants";
import { getDb } from "@/db/client";
import {
  goals,
  incomes,
  monthGoals,
  months,
  settings,
  sources,
} from "@/db/schema";
import {
  TEST_EMAIL,
  createSessionToken,
  createTestUser,
  resetDatabase,
} from "./db";

type SourceInput = {
  name: string;
  kind: "savings" | "investments";
  currency?: "PLN" | "EUR";
  value?: number;
};

/** Helper seedujący dane użytkownika przez `db/` (rozwijany w kolejnych zadaniach). */
export type Seed = {
  userId: number;
  addSource(input: SourceInput): Promise<number>;
  countSources(): Promise<number>;
  /** Cel bieżącego planu połączony ze źródłem (bez walidacji planu). */
  addGoal(sourceId: number, options?: GoalOptions): Promise<number>;
  /** Usuwa cel z planu (miękko, jak SPEC 5.3). */
  removeGoal(goalId: number): Promise<void>;
  /** Ustawia procenty pul w bieżącym planie (w setnych procenta). */
  setPools(savingsPct: number, investmentsPct: number): Promise<void>;
  setEurRate(rate: number): Promise<void>;
  /** Miesiąc z pozycjami przychodu; `settled` oznacza rozliczony (SPEC 5.4). */
  addMonth(input: MonthInput): Promise<number>;
};

/**
 * Migawka celu w miesiącu (`month_goals`): pulę, procent i źródło kopiujemy
 * z żywego celu, a `actualAmount` to faktyczna wpłata rozliczonego miesiąca.
 */
type SnapshotInput = { goalId: number; actualAmount?: number };

type MonthInput = {
  month: string;
  settled?: boolean;
  savingsPct?: number;
  investmentsPct?: number;
  settledEurRate?: number;
  incomes?: { name: string; amount: number }[];
  snapshot?: SnapshotInput[];
};

type GoalOptions = {
  name?: string;
  pct?: number;
  targetAmount?: number;
  startAmount?: number;
};

function makeSeed(userId: number): Seed {
  return {
    userId,
    async addSource({ name, kind, currency = "PLN", value = 0 }) {
      const [row] = await getDb()
        .insert(sources)
        .values({ userId, name, kind, currency, value })
        .returning({ id: sources.id });
      return row.id;
    },
    async countSources() {
      const rows = await getDb()
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.userId, userId));
      return rows.length;
    },
    async addGoal(sourceId, options = {}) {
      const [source] = await getDb()
        .select({ kind: sources.kind })
        .from(sources)
        .where(eq(sources.id, sourceId));
      const [row] = await getDb()
        .insert(goals)
        .values({
          userId,
          pool: source.kind,
          name: options.name ?? "Cel testowy",
          pct: options.pct ?? 10000,
          sourceId,
          targetAmount: options.targetAmount ?? null,
          startAmount: options.startAmount ?? null,
          position: 0,
        })
        .returning({ id: goals.id });
      return row.id;
    },
    async removeGoal(goalId) {
      await getDb()
        .update(goals)
        .set({ removedAt: new Date() })
        .where(eq(goals.id, goalId));
    },
    async setPools(savingsPct, investmentsPct) {
      await getDb()
        .update(settings)
        .set({ savingsPct, investmentsPct })
        .where(eq(settings.userId, userId));
    },
    async setEurRate(rate) {
      await getDb()
        .update(settings)
        .set({ eurRate: rate })
        .where(eq(settings.userId, userId));
    },
    async addMonth({
      month,
      settled = false,
      savingsPct = 0,
      investmentsPct = 0,
      settledEurRate,
      incomes: items = [],
      snapshot = [],
    }) {
      const [row] = await getDb()
        .insert(months)
        .values({
          userId,
          month,
          savingsPct,
          investmentsPct,
          settledAt: settled ? new Date() : null,
          settledEurRate: settled ? (settledEurRate ?? null) : null,
        })
        .returning({ id: months.id });
      if (items.length > 0) {
        await getDb()
          .insert(incomes)
          .values(items.map((item) => ({ monthId: row.id, ...item })));
      }
      for (const entry of snapshot) {
        const [goal] = await getDb()
          .select({
            pool: goals.pool,
            pct: goals.pct,
            sourceId: goals.sourceId,
          })
          .from(goals)
          .where(eq(goals.id, entry.goalId));
        await getDb()
          .insert(monthGoals)
          .values({
            monthId: row.id,
            goalId: entry.goalId,
            pool: goal.pool,
            pct: goal.pct,
            sourceId: goal.sourceId,
            actualAmount: entry.actualAmount ?? null,
          });
      }
      return row.id;
    },
  };
}

/**
 * Fixture „zalogowany użytkownik na czystej bazie”: czyści bazę, tworzy konto
 * testowe i ustawia ciasteczko sesji dla każdego testu (SPEC 12, T3).
 * `authUserId` ma `auto: true`, więc każdy test z tego modułu jest zalogowany.
 */
export const test = base.extend<{ authUserId: number; seed: Seed }>({
  authUserId: [
    async ({ page, baseURL }, provide) => {
      await resetDatabase();
      const userId = await createTestUser();
      const token = await createSessionToken(userId);
      await page.context().addCookies([
        {
          name: SESSION_COOKIE,
          value: token,
          url: baseURL!,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ]);
      await provide(userId);
    },
    { auto: true },
  ],
  seed: async ({ authUserId }, provide) => {
    await provide(makeSeed(authUserId));
  },
});

export { expect, TEST_EMAIL };
