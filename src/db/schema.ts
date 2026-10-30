import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Typy kwot, procentów i kursu: STACK 4. Ograniczenia CHECK chronią spójność
// danych; reguły z komunikatami dla użytkownika sprawdza `domain`.

const amount = (name: string) => bigint(name, { mode: "number" });
const kind = (name: string) =>
  text(name, { enum: ["savings", "investments"] }).notNull();

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const nameCheck = (column: AnyPgColumn) =>
  sql`char_length(${column}) between 1 and 60`;
const pctRange = (column: AnyPgColumn) => sql`${column} between 0 and 10000`;

// `demo_*` są puste dla konta wersji prywatnej; konto demo to piaskownica
// z czasem wygaśnięcia i skrótem adresu IP (STACK 4, SPEC 5.8).
export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    demoExpiresAt: timestamptz("demo_expires_at"),
    demoIpHash: text("demo_ip_hash"),
  },
  (t) => [
    check(
      "users_demo_ip_hash_check",
      sql`${t.demoIpHash} is null or ${t.demoExpiresAt} is not null`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// Licznik nieudanych prób logowania per adres e-mail, także nieistniejący:
// blokada po limicie nie zdradza, czy konto istnieje (STACK 5, SPEC 5.1).
export const loginAttempts = pgTable(
  "login_attempts",
  {
    email: text("email").primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: timestamptz("locked_until"),
  },
  (t) => [
    check("login_attempts_failed_count_check", sql`${t.failedCount} >= 0`),
  ],
);

export const settings = pgTable(
  "settings",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // Dawny ręczny kurs EUR→PLN. Od Etapu 2 (SPEC 5.9) bieżący kurs pochodzi
    // z NBP, a to ustawienie zastąpił `fallback_eur_rate` (migracja 0009
    // przepisała wartość). Kolumnę zostawiamy dla zgodności wstecz wdrożenia.
    eurRate: integer("eur_rate"),
    // Kurs zapasowy EUR→PLN, gdy NBP nie ma tabeli (reguła 6.10, SPEC 5.9).
    fallbackEurRate: integer("fallback_eur_rate"),
    savingsPct: integer("savings_pct").notNull().default(0),
    investmentsPct: integer("investments_pct").notNull().default(0),
  },
  (t) => [
    check("settings_eur_rate_check", sql`${t.eurRate} > 0`),
    check("settings_fallback_eur_rate_check", sql`${t.fallbackEurRate} > 0`),
    check("settings_savings_pct_check", pctRange(t.savingsPct)),
    check("settings_investments_pct_check", pctRange(t.investmentsPct)),
    check(
      "settings_pools_sum_check",
      sql`${t.savingsPct} + ${t.investmentsPct} <= 10000`,
    ),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: kind("kind"),
    currency: text("currency", { enum: ["PLN", "EUR"] }).notNull(),
    value: amount("value").notNull().default(0),
    note: text("note"),
    archivedAt: timestamptz("archived_at"),
    excludedFromNetWorth: boolean("excluded_from_net_worth")
      .notNull()
      .default(false),
  },
  (t) => [
    // Cel wskazuje źródło razem z użytkownikiem, więc baza nie przyjmie celu
    // połączonego ze źródłem innego konta.
    unique("sources_id_user_id_key").on(t.id, t.userId),
    check("sources_name_check", nameCheck(t.name)),
    check("sources_kind_check", sql`${t.kind} in ('savings', 'investments')`),
    check("sources_currency_check", sql`${t.currency} in ('PLN', 'EUR')`),
    check("sources_value_check", sql`${t.value} >= 0`),
    check(
      "sources_archived_value_check",
      sql`${t.archivedAt} is null or ${t.value} = 0`,
    ),
  ],
);

// Historia wartości źródeł (SPEC 5.11, STACK 5 „Historia wartości"). Każdy
// wiersz to stan źródła po zmianie, w walucie źródła z chwili zapisu. Zapisy
// tworzy wyłącznie `changeSourceValue` w `db/sources.ts`; migracja 0005 wstawia
// punkt `initial` dla źródeł istniejących przed wdrożeniem.
export const sourceValues = pgTable(
  "source_values",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: integer("source_id").notNull(),
    value: amount("value").notNull(),
    currency: text("currency", { enum: ["PLN", "EUR"] }).notNull(),
    recordedAt: timestamptz("recorded_at").notNull().defaultNow(),
    reason: text("reason", {
      enum: ["initial", "created", "manual", "settlement", "archived"],
    }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "source_values_source_fk",
      columns: [t.sourceId, t.userId],
      foreignColumns: [sources.id, sources.userId],
    }).onDelete("cascade"),
    index("source_values_source_id_recorded_at_idx").on(
      t.sourceId,
      t.recordedAt,
    ),
    index("source_values_user_id_idx").on(t.userId),
    check("source_values_value_check", sql`${t.value} >= 0`),
    check("source_values_currency_check", sql`${t.currency} in ('PLN', 'EUR')`),
    check(
      "source_values_reason_check",
      sql`${t.reason} in ('initial', 'created', 'manual', 'settlement', 'archived')`,
    ),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pool: kind("pool"),
    name: text("name").notNull(),
    pct: integer("pct").notNull(),
    sourceId: integer("source_id").notNull(),
    targetAmount: amount("target_amount"),
    startAmount: amount("start_amount"),
    // Termin celu `YYYY-MM` (SPEC 5.12). Tylko z kwotą docelową; usunięcie kwoty
    // docelowej usuwa termin (reguła pilnowana w `db/plan.ts` i przez CHECK).
    deadline: text("deadline"),
    position: integer("position").notNull(),
    removedAt: timestamptz("removed_at"),
  },
  (t) => [
    foreignKey({
      name: "goals_source_fk",
      columns: [t.sourceId, t.userId],
      foreignColumns: [sources.id, sources.userId],
    }),
    index("goals_user_id_idx").on(t.userId),
    check("goals_pool_check", sql`${t.pool} in ('savings', 'investments')`),
    check("goals_name_check", nameCheck(t.name)),
    check("goals_pct_check", sql`${t.pct} > 0 and ${t.pct} <= 10000`),
    check("goals_target_amount_check", sql`${t.targetAmount} >= 0`),
    check("goals_start_amount_check", sql`${t.startAmount} >= 0`),
    check(
      "goals_deadline_format_check",
      sql`${t.deadline} is null or ${t.deadline} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "goals_deadline_target_check",
      sql`${t.deadline} is null or ${t.targetAmount} is not null`,
    ),
    check("goals_position_check", sql`${t.position} >= 0`),
  ],
);

export const months = pgTable(
  "months",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    savingsPct: integer("savings_pct").notNull(),
    investmentsPct: integer("investments_pct").notNull(),
    settledAt: timestamptz("settled_at"),
    settledEurRate: integer("settled_eur_rate"),
    // Kurs rozliczenia miesiąca z celem EUR (reguła 6.10, SPEC 5.5): data tabeli
    // NBP (tylko dla pochodzenia `nbp`) i pochodzenie kursu. `manual` oznacza
    // ręczny kurs sprzed Etapu 2.
    settledRateDate: date("settled_rate_date", { mode: "string" }),
    settledRateSource: text("settled_rate_source"),
  },
  (t) => [
    unique("months_user_id_month_key").on(t.userId, t.month),
    check("months_month_check", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("months_savings_pct_check", pctRange(t.savingsPct)),
    check("months_investments_pct_check", pctRange(t.investmentsPct)),
    check(
      "months_pools_sum_check",
      sql`${t.savingsPct} + ${t.investmentsPct} <= 10000`,
    ),
    check("months_settled_eur_rate_check", sql`${t.settledEurRate} > 0`),
    check(
      "months_settled_eur_rate_settled_check",
      sql`${t.settledEurRate} is null or ${t.settledAt} is not null`,
    ),
    check(
      "months_settled_rate_source_check",
      sql`${t.settledRateSource} in ('nbp', 'fallback', 'manual')`,
    ),
    // Pochodzenie istnieje dokładnie wtedy, gdy zapisano kurs rozliczenia
    // (miesiąc z celem EUR); miesiąc bez celu EUR nie ma ani kursu, ani
    // pochodzenia (SPEC 5.5).
    check(
      "months_settled_rate_source_eur_rate_check",
      sql`(${t.settledEurRate} is null) = (${t.settledRateSource} is null)`,
    ),
    // Data tabeli NBP istnieje dokładnie dla pochodzenia `nbp`; `fallback`
    // i `manual` jej nie mają.
    check(
      "months_settled_rate_date_check",
      sql`(${t.settledRateDate} is not null) = (${t.settledRateSource} = 'nbp')`,
    ),
  ],
);

// Klucze obce migawki do celu i źródła oraz celu do źródła są odroczone do końca
// transakcji (migracja 0001), żeby kaskadowe usunięcie użytkownika nie
// zatrzymało się na kolejności usuwania.
export const monthGoals = pgTable(
  "month_goals",
  {
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id),
    pool: kind("pool"),
    pct: integer("pct").notNull(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    actualAmount: amount("actual_amount"),
  },
  (t) => [
    primaryKey({ columns: [t.monthId, t.goalId] }),
    index("month_goals_goal_id_idx").on(t.goalId),
    check(
      "month_goals_pool_check",
      sql`${t.pool} in ('savings', 'investments')`,
    ),
    check("month_goals_pct_check", sql`${t.pct} > 0 and ${t.pct} <= 10000`),
    check("month_goals_actual_amount_check", sql`${t.actualAmount} >= 0`),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: amount("amount").notNull(),
  },
  (t) => [
    index("incomes_month_id_idx").on(t.monthId),
    check("incomes_name_check", nameCheck(t.name)),
    check("incomes_amount_check", sql`${t.amount} > 0`),
  ],
);

// Kursy NBP (STACK 4, 5 „Kurs NBP”). Dane publiczne bez `user_id`, wspólne dla
// wszystkich kont i piaskownic. Kurs w dziesięciotysięcznych jak `settings.eur_rate`.
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    currency: text("currency", { enum: ["EUR"] }).notNull(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    rate: integer("rate").notNull(),
    tableNo: text("table_no").notNull(),
    fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.currency, t.effectiveDate] }),
    check("exchange_rates_currency_check", sql`${t.currency} in ('EUR')`),
    check("exchange_rates_rate_check", sql`${t.rate} > 0`),
  ],
);

// Ostatnia próba pobrania kursów z NBP, jeden wiersz na walutę (upsert): podstawa
// limitu „raz na godzinę” (SPEC Z11). Nie jest logiem prób.
export const rateFetches = pgTable(
  "rate_fetches",
  {
    currency: text("currency", { enum: ["EUR"] }).primaryKey(),
    attemptedAt: timestamptz("attempted_at").notNull(),
    ok: boolean("ok").notNull(),
  },
  (t) => [check("rate_fetches_currency_check", sql`${t.currency} in ('EUR')`)],
);
