// Generator danych przykładowych wersji demo (SPEC 5.8, STACK 5 „Piaskownice
// demo"). Czysta funkcja `(now, rng) → dane`: nie zna bazy, daty liczy względem
// `now` w Europe/Warsaw, kwoty planu i rozliczeń funkcjami z `domain`, a wartości
// źródeł jako ostatni punkt historii wartości, złożonej z dodania źródła,
// ręcznych wycen i wpłat z rozliczeń w kolejności dat. Dzięki temu wynik
// spełnia reguły SPEC 6, walidację planu (SPEC 7.1) i ograniczenia bazy dla
// dowolnej losowości i daty. Losowość jest wstrzykiwana, żeby testy były
// powtarzalne. Zapis wyniku robi osobno `db/demo.ts`.

import {
  forecastGoal,
  goalMonths,
  type GoalInput,
  type PlanMonth,
} from "@/domain/forecast";
import { computeMonthPlan } from "@/domain/plan";
import { plannedActual } from "@/domain/settlement";
import { addMonths, currentMonth, previousMonth } from "@/domain/time";

export type DemoSource = {
  /** Klucz do łączenia celów ze źródłem przy zapisie (nie trafia do bazy). */
  key: string;
  name: string;
  kind: "savings" | "investments";
  currency: "PLN" | "EUR";
  /** Wartość bieżąca = wartość ostatniego punktu historii źródła. */
  value: number;
};

/** Punkt historii wartości źródła (SPEC 5.11): stan po zmianie. */
export type DemoValuePoint = {
  sourceKey: string;
  value: number;
  recordedAt: Date;
  reason: "created" | "manual" | "settlement";
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
  /** Termin `YYYY-MM` (SPEC 5.12) albo null. */
  deadline: string | null;
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
  /** Pierwsze dni następnego miesiąca (SPEC 5.8); `null` dla nierozliczonego. */
  settledAt: Date | null;
  settledEurRate: number | null;
  /** Pochodzenie kursu rozliczenia: w demo zawsze `fallback` (SPEC Z16). */
  settledRateSource: "fallback" | null;
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
  /** Historia wartości z ostatnich 12 miesięcy, w kolejności dat. */
  history: DemoValuePoint[];
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

/** Miesiące demo w postaci wejścia prognozy celu (reguły 6.12–6.13). */
function toPlanMonths(months: DemoMonth[]): PlanMonth[] {
  return months.map((m) => ({
    month: m.month,
    settled: m.settled,
    income: m.incomes.reduce((sum, item) => sum + item.amount, 0),
    savingsPct: m.savingsPct,
    investmentsPct: m.investmentsPct,
    goals: m.goals.map((mg) => {
      const def = PLAN_GOALS[index(mg.goalKey)];
      return {
        goalId: index(mg.goalKey),
        pool: def.pool,
        pct: def.pct,
        actualAmount: mg.actualAmount,
      };
    }),
  }));
}

/** Następny miesiąc kalendarzowy `YYYY-MM`. */
function nextMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Chwila w dniu `day` miesiąca `key` o 12:00 UTC: w Europe/Warsaw to zawsze
 * ten sam dzień (13:00 albo 14:00), niezależnie od czasu letniego.
 */
function dayOf(key: string, day: number): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

// Źródła, których wartość rynkowa zmienia się co miesiąc (ręczna wycena).
const REVALUED = ["makler", "ike"];

type Settlement = { at: Date; deltaBySource: Map<string, number> };

/**
 * Historia wartości (SPEC 5.8, 5.11): źródła dodane w pierwszych dniach
 * miesiąca sprzed 11 miesięcy, w każdym kolejnym zakończonym miesiącu ręczna
 * wycena inwestycji (od −3% do +4%), jednorazowe odsetki na koncie
 * oszczędnościowym i lokacie oraz wpłaty z rozliczeń w dniu rozliczenia.
 * Wartość liczona narastająco w kolejności dat, więc punkt rozliczenia to
 * poprzedni punkt + wpłata. Wszystkie daty są przed `now` (bieżący miesiąc
 * nie ma zmian).
 */
function buildHistory(
  rng: () => number,
  current: string,
  initial: Record<string, number>,
  settlements: Settlement[],
): DemoValuePoint[] {
  type Event =
    | { at: Date; sourceKey: string; reason: "created" }
    | { at: Date; sourceKey: string; reason: "manual"; bp: number }
    | { at: Date; sourceKey: string; reason: "settlement"; delta: number };

  const keys: string[] = [current];
  while (keys.length < 12) keys.unshift(previousMonth(keys[0]));
  const finished = keys.slice(1, -1);

  const events: Event[] = [];
  for (const s of SOURCES) {
    events.push({
      at: dayOf(keys[0], randInt(rng, 1, 5)),
      sourceKey: s.key,
      reason: "created",
    });
  }
  for (const month of finished) {
    for (const sourceKey of REVALUED) {
      events.push({
        at: dayOf(month, randInt(rng, 10, 25)),
        sourceKey,
        reason: "manual",
        bp: randInt(rng, -300, 400),
      });
    }
  }
  for (const sourceKey of ["osz", "lokata"]) {
    const month = finished[randInt(rng, 0, finished.length - 1)];
    events.push({
      at: dayOf(month, randInt(rng, 10, 25)),
      sourceKey,
      reason: "manual",
      bp: randInt(rng, 50, 200),
    });
  }
  for (const { at, deltaBySource } of settlements) {
    for (const [sourceKey, delta] of deltaBySource) {
      if (delta > 0) {
        events.push({ at, sourceKey, reason: "settlement", delta });
      }
    }
  }
  // Sortowanie stabilne: przy tej samej chwili zostaje kolejność dodania.
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const value = new Map<string, number>();
  const points: DemoValuePoint[] = [];
  for (const e of events) {
    const before = value.get(e.sourceKey) ?? 0;
    const after =
      e.reason === "created"
        ? initial[e.sourceKey]
        : e.reason === "manual"
          ? Math.round((before * (10000 + e.bp)) / 10000)
          : before + e.delta;
    // Wycena bez zmiany wartości (np. źródło o wartości 0) nie jest zmianą,
    // tak jak w aplikacji (`updateSource`).
    if (e.reason === "manual" && after === before) continue;
    value.set(e.sourceKey, after);
    points.push({
      sourceKey: e.sourceKey,
      value: after,
      recordedAt: e.at,
      reason: e.reason,
    });
  }
  return points;
}

/**
 * Składa komplet danych przykładowych piaskownicy demo (SPEC 5.8). Oś czasu:
 * trzy wcześniejsze miesiące rozliczone w pierwszych dniach następnego
 * miesiąca, poprzedni miesiąc nierozliczony (pigułka zaległości) i bieżący
 * nierozliczony z kilkoma przychodami; historia wartości z 12 miesięcy.
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
  const settlements: Settlement[] = [];

  const settledMonths: DemoMonth[] = settledKeys.map((month) => {
    const income = randInt(rng, 850000, 1150000);
    const actuals = plannedActuals(income, eurRate);
    if (month === oddMonth) {
      // Poduszka wpłacona częściowo (reszta planu bez zmian) — wykonanie ≠ plan.
      const plan = actuals.get("poduszka") ?? 0;
      actuals.set("poduszka", Math.floor((plan * randInt(rng, 40, 70)) / 100));
    }
    const deltaBySource = new Map<string, number>();
    for (const g of PLAN_GOALS) {
      const amount = actuals.get(g.key) ?? 0;
      paidByGoal.set(g.key, (paidByGoal.get(g.key) ?? 0) + amount);
      deltaBySource.set(
        g.sourceKey,
        (deltaBySource.get(g.sourceKey) ?? 0) + amount,
      );
    }
    // Rozliczenie w pierwszych dniach następnego miesiąca (SPEC 5.8); ostatni
    // rozliczony to miesiąc przed poprzednim, więc data jest zawsze przed `now`.
    const settledAt = dayOf(nextMonth(month), randInt(rng, 1, 5));
    settlements.push({ at: settledAt, deltaBySource });
    return {
      month,
      savingsPct: SAVINGS_PCT,
      investmentsPct: INVEST_PCT,
      settled: true,
      settledAt,
      settledEurRate: eurRate,
      settledRateSource: "fallback",
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
    settledAt: null,
    settledEurRate: null,
    settledRateSource: null,
    incomes: splitIncome(
      rng,
      randInt(rng, 850000, 1150000),
      randInt(rng, 2, 3),
    ),
    goals: PLAN_GOALS.map((g) => ({ goalKey: g.key, actualAmount: null })),
  }));

  // Wartości z chwili dodania źródeł (eurocenty dla EUR).
  const initial: Record<string, number> = {
    osz: randInt(rng, 500000, 2000000),
    lokata: randInt(rng, 1000000, 5000000),
    makler: randInt(rng, 0, 1000000),
    ike: randInt(rng, 50000, 200000),
  };
  const history = buildHistory(rng, current, initial, settlements);
  const lastValue = new Map(history.map((p) => [p.sourceKey, p.value]));
  const sources: DemoSource[] = SOURCES.map((s) => ({
    ...s,
    value: lastValue.get(s.key) ?? 0,
  }));

  const months = [...settledMonths, ...openMonths];
  const planMonths = toPlanMonths(months);

  // Role celów ustalamy po poznaniu wpłat, żeby niezależnie od losowości jeden
  // był osiągnięty, jeden w toku i jeden bez kwoty docelowej (SPEC 5.8, 5.3),
  // a cele z terminem miały statusy „zagrożony” i „zdążysz” (scen. 34).
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
      deadline: null,
      position,
    };
    if (g.key === "poduszka" || g.key === "akcje") {
      // Postęp w toku: kwota docelowa powyżej dotychczasowego postępu. Poduszce
      // brakuje co najmniej 3 000 zł, czyli więcej niż trzy średnie wpłaty, więc
      // miesiąc osiągnięcia wypada co najmniej 2 miesiące po P.
      const start = randInt(rng, 0, 50000);
      base.startAmount = start;
      base.targetAmount =
        start +
        paid +
        (g.key === "poduszka"
          ? randInt(rng, 300000, 600000)
          : randInt(rng, 50000, 300000));
      const currency = SOURCES.find((s) => s.key === g.sourceKey)!.currency;
      const forecast = forecastGoal({
        currency,
        targetAmount: base.targetAmount,
        progress: start + paid,
        months: goalMonths(index(g.key), g.pool, planMonths),
        currentMonth: current,
        currentRate: eurRate,
      } satisfies GoalInput);
      if (forecast.status === "forecast") {
        // „zagrożony”: termin miesiąc przed osiągnięciem (i nie przed P);
        // „zdążysz”: termin w miesiącu osiągnięcia albo do 3 miesięcy później.
        base.deadline =
          g.key === "poduszka"
            ? addMonths(forecast.achievementMonth, -1)
            : addMonths(forecast.achievementMonth, randInt(rng, 0, 3));
      }
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
    months,
    history,
  };
}
