import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Jednostki wartości: STACK 4. Ograniczenia CHECK chronią spójność danych;
// reguły z komunikatami dla użytkownika sprawdza `src/domain`.
// Kaskadowo usuwane są tylko sesje i ustawienia konta oraz przychody i migawka
// usuwanego miesiąca (SPEC 7); źródeł, celów i miesięcy nie da się usunąć
// razem z kontem ani spod istniejących odwołań.

const POOLS = ["savings", "investments"] as const;
const CURRENCIES = ["PLN", "EUR"] as const;

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const amount = () => bigint({ mode: "number" });
const timestamptz = () => timestamp({ withTimezone: true, mode: "date" });

const nameLength = (column: string) =>
  sql.raw(`char_length(${column}) between 1 and 60`);
const pctInRange = (column: string, min: 0 | 1) =>
  sql.raw(`${column} between ${min} and 10000`);
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
  },
  () => [
    check("users_email_normalized", sql.raw("email = lower(btrim(email))")),
  ],
);

export const sessions = pgTable("sessions", {
  // Hash SHA-256 tokenu z ciasteczka; sam token nie trafia do bazy.
  id: text().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamptz().notNull(),
});

export const settings = pgTable(
  "settings",
  {
    userId: integer()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    eurRate: integer(),
    savingsPct: integer().notNull().default(0),
    investmentsPct: integer().notNull().default(0),
  },
  () => [
    check("settings_eur_rate_positive", sql.raw("eur_rate > 0")),
    check("settings_savings_pct_range", pctInRange("savings_pct", 0)),
    check("settings_investments_pct_range", pctInRange("investments_pct", 0)),
    check(
      "settings_pools_sum",
      sql.raw("savings_pct + investments_pct <= 10000"),
    ),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    kind: text({ enum: POOLS }).notNull(),
    currency: text({ enum: CURRENCIES }).notNull(),
    value: amount().notNull().default(0),
    note: text(),
    archivedAt: timestamptz(),
  },
  () => [
    check("sources_name_length", nameLength("name")),
    check("sources_kind_valid", inList("kind", POOLS)),
    check("sources_currency_valid", inList("currency", CURRENCIES)),
    check("sources_value_nonnegative", sql.raw("value >= 0")),
    check(
      "sources_archived_empty",
      sql.raw("archived_at is null or value = 0"),
    ),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    pool: text({ enum: POOLS }).notNull(),
    name: text().notNull(),
    pct: integer().notNull(),
    sourceId: integer()
      .notNull()
      .references(() => sources.id),
    targetAmount: amount(),
    startAmount: amount(),
    position: integer().notNull(),
    removedAt: timestamptz(),
  },
  () => [
    check("goals_pool_valid", inList("pool", POOLS)),
    check("goals_name_length", nameLength("name")),
    check("goals_pct_range", pctInRange("pct", 1)),
    check("goals_target_nonnegative", sql.raw("target_amount >= 0")),
    check("goals_start_nonnegative", sql.raw("start_amount >= 0")),
  ],
);

export const months = pgTable(
  "months",
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    // Miesiąc kalendarzowy w formacie YYYY-MM.
    month: text().notNull(),
    savingsPct: integer().notNull(),
    investmentsPct: integer().notNull(),
    settledAt: timestamptz(),
    settledEurRate: integer(),
  },
  (t) => [
    unique("months_user_month_unique").on(t.userId, t.month),
    check(
      "months_month_format",
      sql.raw("month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'"),
    ),
    check("months_savings_pct_range", pctInRange("savings_pct", 0)),
    check("months_investments_pct_range", pctInRange("investments_pct", 0)),
    check(
      "months_pools_sum",
      sql.raw("savings_pct + investments_pct <= 10000"),
    ),
    check("months_settled_eur_rate_positive", sql.raw("settled_eur_rate > 0")),
    check(
      "months_rate_only_when_settled",
      sql.raw("settled_eur_rate is null or settled_at is not null"),
    ),
  ],
);

export const monthGoals = pgTable(
  "month_goals",
  {
    monthId: integer()
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    goalId: integer()
      .notNull()
      .references(() => goals.id),
    pool: text({ enum: POOLS }).notNull(),
    pct: integer().notNull(),
    sourceId: integer()
      .notNull()
      .references(() => sources.id),
    // W walucie źródła; null do rozliczenia miesiąca.
    actualAmount: amount(),
  },
  (t) => [
    primaryKey({ columns: [t.monthId, t.goalId] }),
    check("month_goals_pool_valid", inList("pool", POOLS)),
    check("month_goals_pct_range", pctInRange("pct", 1)),
    check("month_goals_actual_nonnegative", sql.raw("actual_amount >= 0")),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: id(),
    monthId: integer()
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    name: text().notNull(),
    amount: amount().notNull(),
  },
  () => [
    check("incomes_name_length", nameLength("name")),
    check("incomes_amount_positive", sql.raw("amount > 0")),
  ],
);
