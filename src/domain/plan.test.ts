import { describe, expect, it } from "vitest";
import {
  computeMonthPlan,
  validatePlan,
  type MonthPlanInput,
  type PlanValidationInput,
} from "./plan";

describe("plan miesiąca (SPEC 6.1–6.5)", () => {
  it("scenariusz 1: przychód 9 800,00 zł, oszczędności 20%, inwestycje 15%", () => {
    const input: MonthPlanInput = {
      income: 980_000,
      savingsPct: 2000,
      investmentsPct: 1500,
      goals: [
        { id: 1, pool: "savings", pct: 5000 }, // Poduszka 50%
        { id: 2, pool: "savings", pct: 3000 }, // Wakacje 30%
        { id: 3, pool: "savings", pct: 2000 }, // Rezerwa 20%
        { id: 4, pool: "investments", pct: 6000 }, // ETF 60%
        { id: 5, pool: "investments", pct: 2500 }, // Obligacje 25%
        { id: 6, pool: "investments", pct: 1500 }, // Akcje 15%
      ],
    };
    const plan = computeMonthPlan(input);

    expect(plan.pools).toEqual({ savings: 196_000, investments: 147_000 });
    expect(plan.goals.map((g) => g.amount)).toEqual([
      98_000, 58_800, 39_200, 88_200, 36_750, 22_050,
    ]);
    expect(plan.toSpend).toBe(637_000);
  });

  it("scenariusz 2: zaokrąglenie, przychód 1 000,01 zł, pula 33%, cele 50/50", () => {
    const plan = computeMonthPlan({
      income: 100_001,
      savingsPct: 3300,
      investmentsPct: 0,
      goals: [
        { id: 1, pool: "savings", pct: 5000 },
        { id: 2, pool: "savings", pct: 5000 },
      ],
    });

    expect(plan.pools.savings).toBe(33_000);
    expect(plan.goals.map((g) => g.amount)).toEqual([16_500, 16_500]);
    expect(plan.toSpend).toBe(67_001);
  });

  it("scenariusz 14: reszta z zaokrągleń, przychód 9 650,00 zł", () => {
    const plan = computeMonthPlan({
      income: 965_000,
      savingsPct: 2000,
      investmentsPct: 1500,
      goals: [
        { id: 1, pool: "savings", pct: 5000 },
        { id: 2, pool: "savings", pct: 3000 },
        { id: 3, pool: "savings", pct: 2000 },
        { id: 4, pool: "investments", pct: 6000 },
        { id: 5, pool: "investments", pct: 2500 },
        { id: 6, pool: "investments", pct: 1500 },
      ],
    });

    expect(plan.pools).toEqual({ savings: 193_000, investments: 144_749 });
    expect(plan.toSpend).toBe(627_251);
  });

  it("przykład ze SPEC 6: pula pokazywana 1 447,49 zł, 0,01 zł do „do wydania”", () => {
    const plan = computeMonthPlan({
      income: 965_000,
      savingsPct: 0,
      investmentsPct: 1500,
      goals: [
        { id: 1, pool: "investments", pct: 6000 },
        { id: 2, pool: "investments", pct: 2500 },
        { id: 3, pool: "investments", pct: 1500 },
      ],
    });

    expect(plan.goals.map((g) => g.amount)).toEqual([86_850, 36_187, 21_712]);
    expect(plan.pools.investments).toBe(144_749);
  });

  it("pula 0% daje kwoty 0 (SPEC 7)", () => {
    const plan = computeMonthPlan({
      income: 980_000,
      savingsPct: 0,
      investmentsPct: 1500,
      goals: [{ id: 1, pool: "investments", pct: 10_000 }],
    });

    expect(plan.pools.savings).toBe(0);
    expect(plan.pools.investments).toBe(147_000);
  });

  it("zachowuje kolejność dodania celów (SPEC 5.3)", () => {
    const plan = computeMonthPlan({
      income: 100_000,
      savingsPct: 10_000,
      investmentsPct: 0,
      goals: [
        { id: 7, pool: "savings", pct: 3000 },
        { id: 3, pool: "savings", pct: 7000 },
      ],
    });

    expect(plan.goals.map((g) => g.id)).toEqual([7, 3]);
  });

  it("liczy iloczyn pośredni na BigInt przy kwocie z granicy (STACK 4)", () => {
    // 2 mld zł = 200_000_000_000 groszy; × 15% dałoby 3e16 > MAX_SAFE_INTEGER
    // jako iloczyn pośredni, więc float by stracił precyzję.
    const plan = computeMonthPlan({
      income: 200_000_000_000,
      savingsPct: 0,
      investmentsPct: 1500,
      goals: [{ id: 1, pool: "investments", pct: 10_000 }],
    });

    expect(plan.pools.investments).toBe(30_000_000_000);
    expect(plan.toSpend).toBe(170_000_000_000);
  });
});

describe("walidacja planu podziału (SPEC 7.1)", () => {
  const base: PlanValidationInput = {
    savingsPct: 2000,
    investmentsPct: 1500,
    goals: [
      { pool: "savings", pct: 10_000 },
      { pool: "investments", pct: 10_000 },
    ],
  };

  it("poprawny plan nie ma problemów", () => {
    expect(validatePlan(base)).toEqual([]);
  });

  it("scenariusz 3: cele 60% + 30% → brakuje 10%", () => {
    const issues = validatePlan({
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        { pool: "savings", pct: 6000 },
        { pool: "savings", pct: 3000 },
      ],
    });

    expect(issues).toEqual([
      { target: "savings", message: "Suma celów: 90%. Brakuje 10%" },
    ]);
  });

  it("cele powyżej 100% → za dużo", () => {
    const issues = validatePlan({
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        { pool: "savings", pct: 6000 },
        { pool: "savings", pct: 6000 },
      ],
    });

    expect(issues).toEqual([
      { target: "savings", message: "Suma celów: 120%. Za dużo o 20%" },
    ]);
  });

  it("suma pul powyżej 100% → komunikat o przekroczeniu", () => {
    const issues = validatePlan({
      savingsPct: 6000,
      investmentsPct: 5000,
      goals: [
        { pool: "savings", pct: 10_000 },
        { pool: "investments", pct: 10_000 },
      ],
    });

    expect(issues).toContainEqual({
      target: "pools",
      message: "Pule przekraczają przychód o 10%",
    });
  });

  it("pula powyżej 0% bez celów → suma celów 0%, brakuje 100%", () => {
    const issues = validatePlan({
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [],
    });

    expect(issues).toEqual([
      { target: "savings", message: "Suma celów: 0%. Brakuje 100%" },
    ]);
  });

  it("pula 0% bez celów jest dozwolona (SPEC 5.3)", () => {
    const issues = validatePlan({
      savingsPct: 0,
      investmentsPct: 10_000,
      goals: [{ pool: "investments", pct: 10_000 }],
    });

    expect(issues).toEqual([]);
  });

  it("pula 0% z celami nadal wymaga sumy 100% (SPEC 5.3)", () => {
    const issues = validatePlan({
      savingsPct: 0,
      investmentsPct: 10_000,
      goals: [
        { pool: "savings", pct: 5000 },
        { pool: "investments", pct: 10_000 },
      ],
    });

    expect(issues).toEqual([
      { target: "savings", message: "Suma celów: 50%. Brakuje 50%" },
    ]);
  });

  it("suma pul dokładnie 100% jest dozwolona", () => {
    const issues = validatePlan({
      savingsPct: 4000,
      investmentsPct: 6000,
      goals: [
        { pool: "savings", pct: 10_000 },
        { pool: "investments", pct: 10_000 },
      ],
    });

    expect(issues).toEqual([]);
  });
});
