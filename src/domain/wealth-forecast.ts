// Domena prognozy majątku (SPEC 5.13, reguła 6.14). Czyste funkcje na liczbach
// całkowitych: kwoty w groszach, procenty w setnych procenta, kurs
// w dziesięciotysięcznych, stopa roczna w setnych procenta (STACK 4). Dwie
// części (STACK „Prognoza majątku”): `buildWealthForecast` liczy serie 40 lat
// wszystkich scenariuszy z bieżących danych, a `summarizeHorizon` — bez wiedzy
// o bazie — składa z serii podsumowanie dla wybranego horyzontu. Teksty zdań
// buduje warstwa wyżej; tu zostają warianty (enum) i liczby. `forecast.ts` to
// prognoza celu, nie majątku.

import {
  floorMulDiv,
  roundMulDivHalfAwayFromZero,
  toSafeInteger,
} from "./arithmetic";
import { convertEurToPln } from "./currency";
import type { Currency } from "./format";
import type { Parsed } from "./input";
import { computeMonthPlan, type Pool } from "./plan";
import { addMonths } from "./time";

export type { Currency };

/** Cztery scenariusze przychodu (reguła 6.14): bazowy i +5/+10/+15% wpływów. */
export type Scenario = 0 | 5 | 10 | 15;
export const SCENARIOS: readonly Scenario[] = [0, 5, 10, 15];

/** Dzielnik zysku miesiąca: stopa roczna (setne %) ÷ 12 ÷ 10 000 (reguła 6.14). */
const MONTHLY_GAIN_DIVISOR = 120_000;
/** Liczba miesięcy najdłuższej serii: 40 lat (reguła 6.14, horyzont ≤ 40). */
const MAX_MONTHS = 12 * 40;
/** Progi kamieni milowych w groszach (reguła 6.14), rosnąco. */
const THRESHOLDS = [
  50_000, 100_000, 150_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000,
  2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000,
].map((zl) => zl * 100);

/** Aktywne, niewykluczone z majątku źródło (SPEC 5.2) w prognozie. */
export type ForecastSource = {
  id: number;
  currency: Currency;
  /** Bieżąca wartość w walucie źródła (grosze lub eurocenty). */
  value: number;
  /** Zakładana stopa zwrotu w setnych procenta; `null` = brak (liczona jako 0%). */
  rate: number | null;
};

/** Cel bieżącego planu połączony ze źródłem (reguła 6.14). */
export type ForecastGoal = {
  id: number;
  pool: Pool;
  /** Procent puli w setnych procenta. */
  pct: number;
  /** Źródło celu; cel połączony ze źródłem spoza `sources` nie dostaje wpłaty. */
  sourceId: number;
};

/** Bieżący plan podziału: procenty pul z Ustawień i cele nieusunięte z planu. */
export type ForecastPlan = {
  savingsPct: number;
  investmentsPct: number;
  goals: ForecastGoal[];
};

export type WealthForecastInput = {
  sources: ForecastSource[];
  plan: ForecastPlan;
  /**
   * Wszystkie istniejące miesiące z sumą przychodu (reguła 1) w groszach.
   * Średni przychód bierze najwyżej 6 najnowszych z przychodem wcześniejszych
   * niż bieżący miesiąc; brak takich — przychód bieżącego miesiąca.
   */
  months: { month: string; income: number }[];
  /**
   * Rozliczone miesiące z sumą faktycznych wpłat wszystkich celów w PLN (kwoty
   * EUR przeliczone po kursie rozliczenia danego miesiąca przez warstwę
   * odczytu) — do zdania kontrolnego.
   */
  settledMonths: { month: string; actualTotalPln: number }[];
  /** Bieżący miesiąc kalendarzowy `YYYY-MM`. */
  currentMonth: string;
  /** Bieżący kurs EUR (reguła 6.10) w dziesięciotysięcznych; `null` = brak. */
  currentRate: number | null;
};

/** Skąd pochodzi średni przychód (reguła 6.14). */
export type IncomeSource =
  { kind: "recent"; monthCount: number } | { kind: "current-only" };

export type StartingPoint = {
  /** Majątek dziś w PLN (reguła 7), grosze. */
  netWorthToday: number;
  /** Średni przychód, grosze. */
  averageIncome: number;
  incomeSource: IncomeSource;
  savingsPct: number;
  investmentsPct: number;
  /** Suma procentów pul odkładana według planu, setne procenta. */
  savedPct: number;
  /** Wpłata według planu miesięcznie = wpłata scenariusza bazowego, grosze. */
  planContribution: number;
};

/** Zdanie kontrolne (SPEC 5.13): średnia faktycznych wpłat kontra plan. */
export type ControlSentence = {
  /** Liczba rozliczonych miesięcy użytych do średniej (1–6). */
  monthCount: number;
  /** Średnia faktycznych wpłat, grosze. */
  averageActual: number;
  /** Wpłata scenariusza bazowego do porównania, grosze. */
  planContribution: number;
  /** Czy faktycznie odkładasz mniej czy więcej niż plan. */
  relation: "less" | "more";
};

export type WealthSeries = {
  currentMonth: string;
  /** Liczba miesięcznych punktów poza k = 0 (= `MAX_MONTHS`). */
  months: number;
  startingPoint: StartingPoint;
  controlSentence: ControlSentence | null;
  /** Czy którekolwiek aktywne źródło ma zakładaną stopę (reguła 6.14). */
  hasAnyRate: boolean;
  /** Dla każdego scenariusza majątek w PLN (grosze) w k = 0 … `MAX_MONTHS`. */
  scenarioNetWorth: Record<Scenario, number[]>;
  /** Miesięczna wpłata scenariusza (grosze). */
  scenarioContribution: Record<Scenario, number>;
  /** Scenariusz bazowy: wartość każdego źródła (PLN, grosze) w k = 0 … `MAX_MONTHS`. */
  baseSourceValues: { id: number; values: number[] }[];
  /** Scenariusz bazowy: miesięczna wpłata do każdego źródła (grosze). */
  baseSourceContribution: { id: number; amount: number }[];
};

export type WealthForecast =
  | { ok: false; reason: "no-sources" | "no-income" | "no-rate" }
  | { ok: true; series: WealthSeries };

/** Przeliczenie wartości źródła na PLN w k = 0 (reguła 6.14); EUR po bieżącym kursie. */
function valueInPln(
  source: ForecastSource,
  rate: number | null,
): number | null {
  if (source.currency === "PLN") return source.value;
  if (rate === null) return null;
  return convertEurToPln(source.value, rate);
}

/** Średni przychód i jego pochodzenie (reguła 6.14); `null` gdy brak przychodu (Z17). */
function averageIncome(
  months: { month: string; income: number }[],
  currentMonth: string,
): { amount: number; source: IncomeSource } | null {
  const past = months
    .filter((m) => m.income > 0 && m.month < currentMonth)
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
    .slice(-6);
  if (past.length > 0) {
    const sum = past.reduce((s, m) => s + m.income, 0);
    return {
      amount: floorMulDiv(sum, 1, past.length),
      source: { kind: "recent", monthCount: past.length },
    };
  }
  const current = months.find((m) => m.month === currentMonth);
  if (current && current.income > 0) {
    return { amount: current.income, source: { kind: "current-only" } };
  }
  return null;
}

/** Średnia faktycznych wpłat z najwyżej 6 najnowszych rozliczonych miesięcy (reguła 6.14). */
function averageActual(
  settledMonths: { month: string; actualTotalPln: number }[],
): { amount: number; monthCount: number } | null {
  const recent = [...settledMonths]
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
    .slice(-6);
  if (recent.length === 0) return null;
  const sum = recent.reduce((s, m) => s + m.actualTotalPln, 0);
  return {
    amount: floorMulDiv(sum, 1, recent.length),
    monthCount: recent.length,
  };
}

/**
 * Przychód scenariusza X (reguła 6.14): `średni przychód × (100 + X) ÷ 100`,
 * zaokrąglony w dół do grosza.
 */
function scenarioIncome(average: number, scenario: Scenario): number {
  return floorMulDiv(average, 100 + scenario, 100);
}

/**
 * Wpłaty bieżącego planu z danego przychodu rozbite na źródła (reguły 2–3).
 * Cele połączone ze źródłem spoza `sources` (wykluczonym, zarchiwizowanym) nie
 * dostają wpłaty i nie wchodzą do wpłaty scenariusza (reguła 6.14).
 */
function contributionBySource(
  income: number,
  plan: ForecastPlan,
  sourceIds: Set<number>,
): Map<number, number> {
  const month = computeMonthPlan({
    income,
    savingsPct: plan.savingsPct,
    investmentsPct: plan.investmentsPct,
    goals: plan.goals.map((g) => ({ id: g.id, pool: g.pool, pct: g.pct })),
  });
  const sourceOf = new Map(plan.goals.map((g) => [g.id, g.sourceId]));
  const bySource = new Map<number, number>();
  for (const share of month.goals) {
    const sourceId = sourceOf.get(share.id);
    if (sourceId === undefined || !sourceIds.has(sourceId)) continue;
    bySource.set(sourceId, (bySource.get(sourceId) ?? 0) + share.amount);
  }
  return bySource;
}

/**
 * Seria wartości jednego źródła w k = 0 … `MAX_MONTHS` (reguła 6.14): co miesiąc
 * zysk = wartość × stopa ÷ 120 000 (połówki od zera) plus stała wpłata. Liczona
 * na `BigInt`, każdy punkt sprawdzany względem bezpiecznego zakresu (STACK).
 */
function sourceSeries(
  value0: number,
  rate: number,
  contribution: number,
): number[] {
  const values = new Array<number>(MAX_MONTHS + 1);
  values[0] = value0;
  let value = value0;
  for (let k = 1; k <= MAX_MONTHS; k += 1) {
    const gain = roundMulDivHalfAwayFromZero(value, rate, MONTHLY_GAIN_DIVISOR);
    value = toSafeInteger(BigInt(value) + BigInt(gain) + BigInt(contribution));
    values[k] = value;
  }
  return values;
}

/**
 * Serie prognozy majątku z bieżących danych (reguła 6.14, część „serie”). Zwraca
 * brak danych w kolejności z SPEC 5.13: brak aktywnych źródeł, brak przychodu,
 * źródło EUR bez kursu. Plan z pulami 0% nie jest brakiem danych.
 */
export function buildWealthForecast(
  input: WealthForecastInput,
): WealthForecast {
  const { sources, plan, currentMonth, currentRate } = input;
  if (sources.length === 0) return { ok: false, reason: "no-sources" };

  const average = averageIncome(input.months, currentMonth);
  if (average === null) return { ok: false, reason: "no-income" };

  const valuesPln: { id: number; pln: number; rate: number }[] = [];
  for (const source of sources) {
    const pln = valueInPln(source, currentRate);
    if (pln === null) return { ok: false, reason: "no-rate" };
    valuesPln.push({ id: source.id, pln, rate: source.rate ?? 0 });
  }

  const sourceIds = new Set(sources.map((s) => s.id));
  const scenarioNetWorth = {} as Record<Scenario, number[]>;
  const scenarioContribution = {} as Record<Scenario, number>;
  let baseSourceValues: { id: number; values: number[] }[] = [];
  let baseSourceContribution: { id: number; amount: number }[] = [];

  for (const scenario of SCENARIOS) {
    const income = scenarioIncome(average.amount, scenario);
    const bySource = contributionBySource(income, plan, sourceIds);
    scenarioContribution[scenario] = [...bySource.values()].reduce(
      (s, v) => s + v,
      0,
    );

    const seriesOf = valuesPln.map((v) => ({
      id: v.id,
      values: sourceSeries(v.pln, v.rate, bySource.get(v.id) ?? 0),
    }));

    const netWorth = new Array<number>(MAX_MONTHS + 1);
    for (let k = 0; k <= MAX_MONTHS; k += 1) {
      let sum = BigInt(0);
      for (const s of seriesOf) sum += BigInt(s.values[k]);
      netWorth[k] = toSafeInteger(sum);
    }
    scenarioNetWorth[scenario] = netWorth;

    if (scenario === 0) {
      baseSourceValues = seriesOf;
      baseSourceContribution = valuesPln.map((v) => ({
        id: v.id,
        amount: bySource.get(v.id) ?? 0,
      }));
    }
  }

  const netWorthToday = scenarioNetWorth[0][0];
  const planContribution = scenarioContribution[0];

  const actual = averageActual(input.settledMonths);
  const controlSentence: ControlSentence | null =
    actual && actual.amount !== planContribution
      ? {
          monthCount: actual.monthCount,
          averageActual: actual.amount,
          planContribution,
          relation: actual.amount < planContribution ? "less" : "more",
        }
      : null;

  return {
    ok: true,
    series: {
      currentMonth,
      months: MAX_MONTHS,
      startingPoint: {
        netWorthToday,
        averageIncome: average.amount,
        incomeSource: average.source,
        savingsPct: plan.savingsPct,
        investmentsPct: plan.investmentsPct,
        savedPct: plan.savingsPct + plan.investmentsPct,
        planContribution,
      },
      controlSentence,
      hasAnyRate: sources.some((s) => s.rate !== null),
      scenarioNetWorth,
      scenarioContribution,
      baseSourceValues,
      baseSourceContribution,
    },
  };
}

/** Zaokrąglenie kwoty w groszach do pełnych złotych, połówki od zera (reguła 6.14). */
function toWholeZloty(minor: number): number {
  return roundMulDivHalfAwayFromZero(minor, 1, 100);
}

export type ScenarioCard = {
  scenario: Scenario;
  /** Majątek na koniec horyzontu w pełnych złotych. */
  netWorth: number;
  /** Miesięczna wpłata scenariusza w pełnych złotych. */
  monthlyContribution: number;
  /** Różnica względem bazowego w pełnych złotych (różnica zaokrąglonych kwot). */
  diffFromBase: number;
};

/** Legenda „Wpłaty kontra zysk” (SPEC 5.13) w pełnych złotych. */
export type ProfitLegend = {
  /** Majątek dziś. */
  netWorthToday: number;
  /** Suma wpłat = k × wpłata scenariusza. */
  contributions: number;
  /** Zysk = zaokrąglony majątek − pozostałe dwie części (może być ujemny). */
  profit: number;
};

/** Wariant zdania „Wpłaty kontra zysk” (SPEC 5.13) zależny od zysku na koniec. */
export type ProfitSentence =
  | { kind: "no-rate" }
  | { kind: "positive"; profitSharePct: number; perZloty: number | null }
  | { kind: "negative"; loss: number }
  | { kind: "zero" };

export type MilestoneReach = { k: number; month: string } | null;

export type Milestone = {
  /** Próg w groszach. */
  threshold: number;
  /** Dla każdego scenariusza miesiąc pierwszego osiągnięcia progu albo `null`. */
  reached: Record<Scenario, MilestoneReach>;
};

/** Wiersz tabeli „Źródła w prognozie” (SPEC 5.13), scenariusz bazowy, pełne złote. */
export type SourceRow = {
  id: number;
  /** Miesięczna wpłata do źródła. */
  contribution: number;
  /** Wartość dziś (k = 0). */
  today: number;
  /** Wartość na koniec horyzontu. */
  end: number;
};

export type HorizonSummary = {
  years: number;
  /** Indeks miesiąca końca horyzontu w serii (= 12 × lata). */
  monthIndex: number;
  cards: ScenarioCard[];
  /** Legenda i zdanie dla każdego scenariusza (przełącznik „Wpłaty kontra zysk”). */
  layers: Record<Scenario, { legend: ProfitLegend; sentence: ProfitSentence }>;
  milestones: Milestone[];
  sources: SourceRow[];
};

/** Zysk na koniec horyzontu w groszach (reguła 6.14): majątek − majątek dziś − suma wpłat. */
function rawProfit(
  series: WealthSeries,
  scenario: Scenario,
  k: number,
): number {
  const netWorth = series.scenarioNetWorth[scenario][k];
  const contributions = k * series.scenarioContribution[scenario];
  return netWorth - series.scenarioNetWorth[0][0] - contributions;
}

/** Legenda scenariusza na koniec horyzontu (reguła 6.14): zysk z zaokrąglonych części. */
function legendOf(
  series: WealthSeries,
  scenario: Scenario,
  k: number,
): ProfitLegend {
  const netWorthToday = toWholeZloty(series.scenarioNetWorth[0][0]);
  const contributions = toWholeZloty(k * series.scenarioContribution[scenario]);
  const netWorth = toWholeZloty(series.scenarioNetWorth[scenario][k]);
  return {
    netWorthToday,
    contributions,
    profit: netWorth - netWorthToday - contributions,
  };
}

/** Zdanie „Wpłaty kontra zysk” scenariusza (reguła 6.14), z legendy i surowych kwot. */
function sentenceOf(
  series: WealthSeries,
  scenario: Scenario,
  k: number,
  legend: ProfitLegend,
): ProfitSentence {
  if (!series.hasAnyRate) return { kind: "no-rate" };
  if (legend.profit > 0) {
    const netWorth = series.scenarioNetWorth[scenario][k];
    const gain = netWorth - series.scenarioNetWorth[0][0];
    const contributions = k * series.scenarioContribution[scenario];
    // Udział zysku: zysk ÷ majątek, pełne procenty, połówki w górę (reguła 6.14).
    const profitSharePct = roundMulDivHalfAwayFromZero(
      rawProfit(series, scenario, k),
      100,
      netWorth,
    );
    // „Każda złotówka”: (majątek − majątek dziś) ÷ suma wpłat, 2 miejsca, połówki
    // w górę; pominięta, gdy wpłata scenariusza wynosi 0 (reguła 6.14).
    const perZloty =
      contributions === 0
        ? null
        : roundMulDivHalfAwayFromZero(gain, 100, contributions);
    return { kind: "positive", profitSharePct, perZloty };
  }
  if (legend.profit < 0) return { kind: "negative", loss: -legend.profit };
  return { kind: "zero" };
}

/**
 * Progi do pokazania (reguła 6.14): większe od majątku dziś i nie większe od
 * majątku scenariusza +15% na koniec horyzontu; gdy więcej niż 3 — trzy
 * największe. Dla każdego progu miesiąc pierwszego osiągnięcia w każdym
 * scenariuszu albo `null` (poza horyzontem).
 */
function milestonesOf(series: WealthSeries, k: number): Milestone[] {
  const today = series.scenarioNetWorth[0][0];
  const ceiling = series.scenarioNetWorth[15][k];
  const selected = THRESHOLDS.filter((t) => t > today && t <= ceiling).slice(
    -3,
  );

  return selected.map((threshold) => {
    const reached = {} as Record<Scenario, MilestoneReach>;
    for (const scenario of SCENARIOS) {
      const netWorth = series.scenarioNetWorth[scenario];
      let hit: MilestoneReach = null;
      for (let i = 1; i <= k; i += 1) {
        if (netWorth[i] >= threshold) {
          hit = { k: i, month: addMonths(series.currentMonth, i) };
          break;
        }
      }
      reached[scenario] = hit;
    }
    return { threshold, reached };
  });
}

/**
 * Podsumowanie prognozy dla horyzontu N lat (reguła 6.14, część „podsumowanie”).
 * Czysta funkcja serii — nie zna bazy, więc liczy ją komponent kliencki przy
 * zmianie horyzontu (STACK). Zakłada poprawny horyzont (`parseHorizonYears`).
 */
export function summarizeHorizon(
  series: WealthSeries,
  years: number,
): HorizonSummary {
  const k = 12 * years;
  const baseNetWorth = toWholeZloty(series.scenarioNetWorth[0][k]);

  const cards: ScenarioCard[] = SCENARIOS.map((scenario) => {
    const netWorth = toWholeZloty(series.scenarioNetWorth[scenario][k]);
    return {
      scenario,
      netWorth,
      monthlyContribution: toWholeZloty(series.scenarioContribution[scenario]),
      diffFromBase: netWorth - baseNetWorth,
    };
  });

  const layers = {} as Record<
    Scenario,
    { legend: ProfitLegend; sentence: ProfitSentence }
  >;
  for (const scenario of SCENARIOS) {
    const legend = legendOf(series, scenario, k);
    layers[scenario] = {
      legend,
      sentence: sentenceOf(series, scenario, k, legend),
    };
  }

  const sources: SourceRow[] = series.baseSourceValues.map((s) => ({
    id: s.id,
    contribution: toWholeZloty(
      series.baseSourceContribution.find((c) => c.id === s.id)?.amount ?? 0,
    ),
    today: toWholeZloty(s.values[0]),
    end: toWholeZloty(s.values[k]),
  }));

  return {
    years,
    monthIndex: k,
    cards,
    layers,
    milestones: milestonesOf(series, k),
    sources,
  };
}

/** Komunikat walidacji horyzontu (SPEC 7.1). */
export const HORIZON_MESSAGE = "Wpisz liczbę lat od 1 do 40";

/**
 * Walidacja własnej liczby lat horyzontu (SPEC 7.1): liczba całkowita od 1 do
 * 40. Puste pole obsługuje warstwa interfejsu (zostawia bieżący wybór bez
 * komunikatu), tu puste jest niepoprawne.
 */
export function parseHorizonYears(input: string): Parsed<number> {
  const trimmed = input.replace(/\s/g, "");
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: HORIZON_MESSAGE };
  const years = Number(trimmed);
  if (years < 1 || years > 40) return { ok: false, error: HORIZON_MESSAGE };
  return { ok: true, value: years };
}

/** Lata w formie z odmianą (reguła 6.14): „1 rok”, „2 lata”, „5 lat”. */
export function yearsPhrase(years: number): string {
  const lastTwo = years % 100;
  const last = years % 10;
  if (years === 1) return "1 rok";
  const word =
    last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
      ? "lata"
      : "lat";
  return `${years} ${word}`;
}
