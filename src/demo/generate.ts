// Generator danych przykładowych wersji demo (SPEC 5.8, STACK 5 „Piaskownice
// demo"). Czysta funkcja `(now, rng) → dane`: nie zna bazy, daty liczy względem
// `now` w Europe/Warsaw, kwoty planu i rozliczeń funkcjami z `domain`, a wartości
// źródeł jako wartość początkowa + suma rozliczonych wpłat. Dzięki temu wynik
// spełnia reguły SPEC 6, walidację planu (SPEC 7.1) i ograniczenia bazy dla
// dowolnej losowości i daty. Losowość jest wstrzykiwana, żeby testy były
// powtarzalne. Zapis wyniku robi osobno `db/demo.ts`.

import { computeMonthPlan } from "@/domain/plan";
import { plannedActual } from "@/domain/settlement";
import { currentMonth, previousMonth } from "@/domain/time";

export type DemoSource = {
  /** Klucz do łączenia celów ze źródłem przy zapisie (nie trafia do bazy). */
  key: string;
  name: string;
  kind: "savings" | "investments";
  currency: "PLN" | "EUR";
  /** Wartość końcowa = początkowa + suma rozliczonych wpłat (SPEC 6.7). */
  value: number;
};

export type DemoGoal = {
  key: string;
  pool: "savings" | "investments";
  name: string;
  /** Procent puli w setnych procenta. */
  pct: number;
  sourceKey: string;
  targetAmount: number | null;
  startAmount: number | null;
  position: number;
};

export type DemoMonthGoal = {
  goalKey: string;
  /** Faktyczna wpłata rozliczonego miesiąca; `null` dla nierozliczonego. */
  actualAmount: number | null;
};

export type DemoMonth = {
  month: string;
  savingsPct: number;
  investmentsPct: number;
  settled: boolean;
  settledEurRate: number | null;
  incomes: { name: string; amount: number }[];
  goals: DemoMonthGoal[];
};

export type DemoData = {
  eurRate: number;
  savingsPct: number;
  investmentsPct: number;
  sources: DemoSource[];
  goals: DemoGoal[];
  months: DemoMonth[];
};

// Stały, zawsze poprawny plan: pule 20% / 15%, a w każdej puli cele sumują się
// do 100% (SPEC 7.1). Role celów pokrywają listę z SPEC 5.8: cel ze źródłem EUR
// (Akcje), z kwotą docelową i postępem w toku (Poduszka, Akcje), osiągnięty
// (Rezerwa) i bez kwoty docelowej (Wakacje, ETF).
const SAVINGS_PCT = 2000;
const INVEST_PCT = 1500;

type PlanGoalDef = {
  key: string;
  pool: "savings" | "investments";
  name: string;
  pct: number;
  sourceKey: string;
};

const SOURCES: Omit<DemoSource, "value">[] = [
  {
    key: "osz",
    name: "Konto oszczędnościowe",
    kind: "savings",
    currency: "PLN",
  },
  { key: "lokata", name: "Lokata", kind: "savings", currency: "PLN" },
  {
    key: "makler",
    name: "Konto maklerskie",
    kind: "investments",
    currency: "PLN",
  },
  { key: "ike", name: "Konto IKE (EUR)", kind: "investments", currency: "EUR" },
];

const PLAN_GOALS: PlanGoalDef[] = [
  {
    key: "poduszka",
    pool: "savings",
    name: "Poduszka bezpieczeństwa",
    pct: 5000,
    sourceKey: "osz",
  },
  {
    key: "wakacje",
    pool: "savings",
    name: "Wakacje",
    pct: 3000,
    sourceKey: "osz",
  },
  {
    key: "rezerwa",
    pool: "savings",
    name: "Rezerwa AGD",
    pct: 2000,
    sourceKey: "lokata",
  },
  {
    key: "etf",
    pool: "investments",
    name: "ETF globalny",
    pct: 6000,
    sourceKey: "makler",
  },
  {
    key: "akcje",
    pool: "investments",
    name: "Akcje (EUR)",
    pct: 4000,
    sourceKey: "ike",
  },
];

const INCOME_NAMES = ["Wynagrodzenie", "Premia", "Freelance"];

/** Liczba całkowita z przedziału [min, max] ze wstrzykniętej losowości. */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Dzieli przychód na `count` dodatnich pozycji (każda ≥ 1 grosz). */
function splitIncome(
  rng: () => number,
  income: number,
  count: number,
): { name: string; amount: number }[] {
  const parts: number[] = [];
  let remaining = income;
  for (let i = 0; i < count - 1; i++) {
    const slots = count - i;
    const max = Math.floor(remaining / slots);
    const amount = randInt(rng, Math.max(1, Math.floor(max / 2)), max);
    parts.push(amount);
    remaining -= amount;
  }
  parts.push(remaining); // zawsze > 0: każda poprzednia wzięła ≤ remaining/slots
  return parts.map((amount, i) => ({ name: INCOME_NAMES[i], amount }));
}

/** Faktyczne wpłaty celów miesiąca na podstawie planu i kursu (SPEC 5.5). */
function plannedActuals(income: number, eurRate: number): Map<string, number> {
  const plan = computeMonthPlan({
    income,
    savingsPct: SAVINGS_PCT,
    investmentsPct: INVEST_PCT,
    goals: PLAN_GOALS.map((g) => ({
      id: index(g.key),
      pool: g.pool,
      pct: g.pct,
    })),
  });
  const planByKey = new Map(
    plan.goals.map((g) => [PLAN_GOALS[g.id].key, g.amount]),
  );
  const result = new Map<string, number>();
  for (const g of PLAN_GOALS) {
    const currency = SOURCES.find((s) => s.key === g.sourceKey)!.currency;
    result.set(
      g.key,
      plannedActual(planByKey.get(g.key) ?? 0, currency, eurRate),
    );
  }
  return result;
}

function index(key: string): number {
  return PLAN_GOALS.findIndex((g) => g.key === key);
}

/**
 * Składa komplet danych przykładowych piaskownicy demo (SPEC 5.8). Oś czasu:
 * trzy wcześniejsze miesiące rozliczone, poprzedni miesiąc nierozliczony
 * (pigułka zaległości) i bieżący nierozliczony z kilkoma przychodami.
 */
export function generateDemoData(now: Date, rng: () => number): DemoData {
  const eurRate = randInt(rng, 40000, 45000);

  const current = currentMonth(now);
  const previous = previousMonth(current);
  const settledKeys: string[] = [];
  let cursor = previous;
  for (let i = 0; i < 3; i++) {
    cursor = previousMonth(cursor);
    settledKeys.unshift(cursor); // od najstarszego
  }

  // Który miesiąc rozliczy się inaczej niż plan (co najmniej jeden, SPEC 5.8).
  const oddMonth = settledKeys[settledKeys.length - 1];

  const paidByGoal = new Map<string, number>(PLAN_GOALS.map((g) => [g.key, 0]));
  const deltaBySource = new Map<string, number>(SOURCES.map((s) => [s.key, 0]));

  const settledMonths: DemoMonth[] = settledKeys.map((month) => {
    const income = randInt(rng, 850000, 1150000);
    const actuals = plannedActuals(income, eurRate);
    if (month === oddMonth) {
      // Poduszka wpłacona częściowo (reszta planu bez zmian) — wykonanie ≠ plan.
      const plan = actuals.get("poduszka") ?? 0;
      actuals.set("poduszka", Math.floor((plan * randInt(rng, 40, 70)) / 100));
    }
    for (const g of PLAN_GOALS) {
      const amount = actuals.get(g.key) ?? 0;
      paidByGoal.set(g.key, (paidByGoal.get(g.key) ?? 0) + amount);
      deltaBySource.set(
        g.sourceKey,
        (deltaBySource.get(g.sourceKey) ?? 0) + amount,
      );
    }
    return {
      month,
      savingsPct: SAVINGS_PCT,
      investmentsPct: INVEST_PCT,
      settled: true,
      settledEurRate: eurRate,
      incomes: splitIncome(rng, income, randInt(rng, 2, 3)),
      goals: PLAN_GOALS.map((g) => ({
        goalKey: g.key,
        actualAmount: actuals.get(g.key) ?? 0,
      })),
    };
  });

  const openMonths: DemoMonth[] = [previous, current].map((month) => ({
    month,
    savingsPct: SAVINGS_PCT,
    investmentsPct: INVEST_PCT,
    settled: false,
    settledEurRate: null,
    incomes: splitIncome(
      rng,
      randInt(rng, 850000, 1150000),
      randInt(rng, 2, 3),
    ),
    goals: PLAN_GOALS.map((g) => ({ goalKey: g.key, actualAmount: null })),
  }));

  // Wartości startowe źródeł (eurocenty dla EUR); wartość końcowa dolicza wpłaty.
  const initial: Record<string, number> = {
    osz: randInt(rng, 500000, 2000000),
    lokata: randInt(rng, 1000000, 5000000),
    makler: randInt(rng, 0, 1000000),
    ike: randInt(rng, 50000, 200000),
  };
  const sources: DemoSource[] = SOURCES.map((s) => ({
    ...s,
    value: initial[s.key] + (deltaBySource.get(s.key) ?? 0),
  }));

  // Role celów ustalamy po poznaniu wpłat, żeby niezależnie od losowości jeden
  // był osiągnięty, jeden w toku i jeden bez kwoty docelowej (SPEC 5.8, 5.3).
  const goals: DemoGoal[] = PLAN_GOALS.map((g, position) => {
    const paid = paidByGoal.get(g.key) ?? 0;
    const base: DemoGoal = {
      key: g.key,
      pool: g.pool,
      name: g.name,
      pct: g.pct,
      sourceKey: g.sourceKey,
      targetAmount: null,
      startAmount: null,
      position,
    };
    if (g.key === "poduszka" || g.key === "akcje") {
      // Postęp w toku: kwota docelowa powyżej dotychczasowego postępu.
      const start = randInt(rng, 0, 50000);
      base.startAmount = start;
      base.targetAmount = start + paid + randInt(rng, 50000, 300000);
    } else if (g.key === "rezerwa") {
      // Osiągnięty: kwota docelowa nie większa niż postęp (postęp > 0).
      const start = randInt(rng, 0, 50000);
      base.startAmount = start;
      base.targetAmount = start + paid;
    }
    // „wakacje" i „etf": bez kwoty docelowej (startAmount też puste).
    return base;
  });

  return {
    eurRate,
    savingsPct: SAVINGS_PCT,
    investmentsPct: INVEST_PCT,
    sources,
    goals,
    months: [...settledMonths, ...openMonths],
  };
}
