// Plan miesiąca i walidacja planu podziału (SPEC 6.1–6.5, 7.1). Czyste funkcje
// na liczbach całkowitych: kwoty w groszach, procenty w setnych procenta.
// Plan miesiąca nie jest zapisywany — liczony przy każdym odczycie z przychodu
// i migawki planu (STACK 3).

import { floorMulDiv } from "./arithmetic";
import { formatPercent } from "./format";

export type Pool = "savings" | "investments";

const POOLS: Pool[] = ["savings", "investments"];

/** 100,00% w setnych procenta; dzielnik dla kwota × procent. */
const FULL_PERCENT = 10_000;

export type PlanGoal = {
  /** Tożsamość celu (SPEC 5.3), przenoszona do wyniku. */
  id: number;
  pool: Pool;
  /** Procent puli, w setnych procenta. */
  pct: number;
};

export type MonthPlanInput = {
  /** Suma pozycji przychodu, w groszach. */
  income: number;
  /** Procenty pul z migawki miesiąca, w setnych procenta. */
  savingsPct: number;
  investmentsPct: number;
  goals: PlanGoal[];
};

export type GoalShare = { id: number; pool: Pool; amount: number };

export type MonthPlan = {
  income: number;
  /** Kwota puli pokazywana = suma kwot jej celów (SPEC 6.4). */
  pools: Record<Pool, number>;
  /** Kwoty celów w kolejności z wejścia (SPEC 5.3). */
  goals: GoalShare[];
  /** Przychód minus suma kwot celów, z resztą z zaokrągleń (SPEC 6.5). */
  toSpend: number;
};

/**
 * Liczy plan miesiąca z przychodu i migawki planu (SPEC 6.1–6.5). Kwota bazowa
 * puli (`przychód × procent puli`) jest pośrednia i nie jest zwracana; kwota
 * celu to zaokrąglona w dół część kwoty bazowej, a kwota puli to suma kwot jej
 * celów. Reszta z zaokrągleń przechodzi do „do wydania”.
 */
export function computeMonthPlan(input: MonthPlanInput): MonthPlan {
  const poolPct: Record<Pool, number> = {
    savings: input.savingsPct,
    investments: input.investmentsPct,
  };
  const poolBase: Record<Pool, number> = {
    savings: floorMulDiv(input.income, poolPct.savings, FULL_PERCENT),
    investments: floorMulDiv(input.income, poolPct.investments, FULL_PERCENT),
  };

  const goals: GoalShare[] = input.goals.map((goal) => ({
    id: goal.id,
    pool: goal.pool,
    amount: floorMulDiv(poolBase[goal.pool], goal.pct, FULL_PERCENT),
  }));

  const pools: Record<Pool, number> = { savings: 0, investments: 0 };
  let goalsTotal = 0;
  for (const goal of goals) {
    pools[goal.pool] += goal.amount;
    goalsTotal += goal.amount;
  }

  return {
    income: input.income,
    pools,
    goals,
    toSpend: input.income - goalsTotal,
  };
}

export type PlanValidationInput = {
  savingsPct: number;
  investmentsPct: number;
  goals: { pool: Pool; pct: number }[];
};

/** Problem walidacji planu wskazuje pole: obie pule razem albo konkretną pulę. */
export type PlanIssue = { target: "pools" | Pool; message: string };

/**
 * Sprawdza plan podziału (SPEC 7.1): suma pul ≤ 100%, a w każdej puli suma
 * celów = 100,00%. Pula z 0% i bez celów jest dozwolona; pula z procentem
 * powyżej 0 bez celów ma sumę celów 0% i wpada pod regułę sumy celów
 * (komunikat „Suma celów: 0%. Brakuje 100%”). Pusta lista oznacza plan poprawny.
 */
export function validatePlan(input: PlanValidationInput): PlanIssue[] {
  const issues: PlanIssue[] = [];

  const poolsSum = input.savingsPct + input.investmentsPct;
  if (poolsSum > FULL_PERCENT) {
    issues.push({
      target: "pools",
      message: `Pule przekraczają przychód o ${formatPercent(poolsSum - FULL_PERCENT)}`,
    });
  }

  for (const pool of POOLS) {
    const poolPct =
      pool === "savings" ? input.savingsPct : input.investmentsPct;
    const goals = input.goals.filter((goal) => goal.pool === pool);
    if (poolPct === 0 && goals.length === 0) continue;

    const goalsSum = goals.reduce((sum, goal) => sum + goal.pct, 0);
    if (goalsSum !== FULL_PERCENT) {
      const tail =
        goalsSum < FULL_PERCENT
          ? `Brakuje ${formatPercent(FULL_PERCENT - goalsSum)}`
          : `Za dużo o ${formatPercent(goalsSum - FULL_PERCENT)}`;
      issues.push({
        target: pool,
        message: `Suma celów: ${formatPercent(goalsSum)}. ${tail}`,
      });
    }
  }

  return issues;
}
