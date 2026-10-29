import { describe, expect, it } from "vitest";
import {
  forecastGoal,
  goalDeadline,
  type GoalInput,
  type GoalMonth,
} from "./forecast";

/** Miesiąc z celem, domyślnie nierozliczony; nadpisz, czego potrzebuje test. */
function gm(month: string, over: Partial<GoalMonth> = {}): GoalMonth {
  return {
    month,
    settled: false,
    hasGoal: true,
    actualAmount: null,
    planAmount: 0,
    poolBase: 0,
    ...over,
  };
}

function input(over: Partial<GoalInput>): GoalInput {
  return {
    currency: "PLN",
    targetAmount: 0,
    progress: 0,
    months: [],
    currentMonth: "2026-11",
    currentRate: null,
    ...over,
  };
}

// Dane przykładu prognozy ze SPEC 6 / scen. 27: cel „Wakacje” (30% puli
// Oszczędności), przychód 9 800,00 zł, pula 20% → kwota bazowa 1 960,00 zł,
// kwota celu 588,00 zł. Sierpień–październik rozliczone (588/512/600),
// listopad istnieje i nie jest rozliczony. Kwota docelowa 5 000, startowa
// 2 000, postęp 3 700, pozostało 1 300.
const WAKACJE = input({
  targetAmount: 500_000,
  progress: 370_000,
  currentMonth: "2026-11",
  months: [
    gm("2026-08", {
      settled: true,
      actualAmount: 58_800,
      planAmount: 58_800,
      poolBase: 196_000,
    }),
    gm("2026-09", {
      settled: true,
      actualAmount: 51_200,
      planAmount: 58_800,
      poolBase: 196_000,
    }),
    gm("2026-10", {
      settled: true,
      actualAmount: 60_000,
      planAmount: 58_800,
      poolBase: 196_000,
    }),
    gm("2026-11", { planAmount: 58_800, poolBase: 196_000 }),
  ],
});

describe("forecastGoal (reguła 6.12)", () => {
  it("liczy średnią, pierwszy miesiąc i miesiąc osiągnięcia (przykład SPEC 6)", () => {
    expect(forecastGoal(WAKACJE)).toEqual({
      status: "forecast",
      firstMonth: "2026-11",
      averageAmount: 56_666, // 1 700,00 ÷ 3 w dół
      averageSource: "actual",
      paymentsCount: 3, // ceil(1 300 ÷ 566,66) = 3
      achievementMonth: "2027-01",
    });
  });

  it("cel osiągnięty → brak prognozy", () => {
    expect(
      forecastGoal(input({ targetAmount: 100_000, progress: 100_000 })),
    ).toEqual({ status: "reached" });
  });

  it("mniej niż 3 rozliczone miesiące: średnia z dostępnych", () => {
    const f = forecastGoal(
      input({
        targetAmount: 100_000,
        progress: 0,
        months: [
          gm("2026-09", { settled: true, actualAmount: 50_000 }),
          gm("2026-10", { settled: true, actualAmount: 60_000 }),
        ],
      }),
    );
    expect(f).toMatchObject({ averageAmount: 55_000, averageSource: "actual" });
  });

  it("brak rozliczeń: średnia z planu najstarszego miesiąca z celem („planujesz”)", () => {
    const f = forecastGoal(
      input({
        targetAmount: 130_000,
        progress: 0,
        months: [gm("2026-11", { planAmount: 58_800 })],
      }),
    );
    expect(f).toMatchObject({
      averageAmount: 58_800,
      averageSource: "planned",
      firstMonth: "2026-11",
      paymentsCount: 3, // ceil(130 000 ÷ 58 800)
    });
  });

  it("cel jeszcze w żadnym planie → brak danych", () => {
    expect(
      forecastGoal(
        input({
          targetAmount: 300_000,
          months: [gm("2026-11", { hasGoal: false, poolBase: 196_000 })],
        }),
      ),
    ).toEqual({ status: "no-data", firstMonth: "2026-11" });
  });

  it("średnia 0 → cel nie zostanie osiągnięty", () => {
    expect(
      forecastGoal(
        input({
          targetAmount: 100_000,
          months: [gm("2026-11", { planAmount: 0 })],
        }),
      ),
    ).toEqual({ status: "never", firstMonth: "2026-11" });
  });

  it("P = następny miesiąc, gdy bieżący jest rozliczony i nie ma nierozliczonych z celem", () => {
    const f = forecastGoal(
      input({
        targetAmount: 100_000,
        currentMonth: "2026-11",
        months: [
          gm("2026-11", {
            settled: true,
            actualAmount: 50_000,
            planAmount: 50_000,
          }),
        ],
      }),
    );
    expect(f).toMatchObject({ firstMonth: "2026-12", averageSource: "actual" });
  });

  it("rozliczenia nie po kolei dają ten sam wynik co uporządkowane", () => {
    const shuffled = input({
      ...WAKACJE,
      months: [
        WAKACJE.months[2],
        WAKACJE.months[0],
        WAKACJE.months[3],
        WAKACJE.months[1],
      ],
    });
    expect(forecastGoal(shuffled)).toEqual(forecastGoal(WAKACJE));
  });

  it("przełom roku w miesiącu osiągnięcia", () => {
    const f = forecastGoal(
      input({
        targetAmount: 30_000,
        progress: 0,
        currentMonth: "2026-12",
        months: [gm("2026-12", { planAmount: 10_000 })],
      }),
    );
    expect(f).toMatchObject({
      firstMonth: "2026-12",
      paymentsCount: 3,
      achievementMonth: "2027-02",
    });
  });

  it("cel EUR: średnia z planu przeliczona po bieżącym kursie", () => {
    const f = forecastGoal(
      input({
        currency: "EUR",
        targetAmount: 100_000,
        progress: 0,
        currentRate: 42_850,
        months: [gm("2026-11", { planAmount: 42_850 })],
      }),
    );
    // 428,50 zł ÷ 4,2850 = 100,00 € → średnia 10 000 centów.
    expect(f).toMatchObject({
      averageAmount: 10_000,
      averageSource: "planned",
    });
  });

  it("cel EUR bez kursu i bez rozliczeń → brak danych (planu nie da się wyrazić w EUR)", () => {
    expect(
      forecastGoal(
        input({
          currency: "EUR",
          targetAmount: 100_000,
          currentRate: null,
          months: [gm("2026-11", { planAmount: 42_850 })],
        }),
      ),
    ).toEqual({ status: "no-data", firstMonth: "2026-11" });
  });
});

describe("goalDeadline (reguła 6.13)", () => {
  it("termin grudzień 2026: zagrożony, wymagana 712,00 zł, sugestia 36,33%", () => {
    expect(goalDeadline(WAKACJE, "2026-12")).toEqual({
      status: "at-risk",
      firstMonth: "2026-11",
      planned: 58_800, // listopad zaplanowany
      shortfall: 71_200, // 1 300 − 588
      futureMonths: 1, // grudzień
      required: 71_200,
      suggestion: { kind: "percent", pct: 3_633 },
    });
  });

  it("termin marzec 2027: zdążysz, wymagana 178,00 zł, bez sugestii", () => {
    expect(goalDeadline(WAKACJE, "2027-03")).toEqual({
      status: "on-track",
      firstMonth: "2026-11",
      planned: 58_800,
      shortfall: 71_200,
      futureMonths: 4, // grudzień–marzec
      required: 17_800, // 712 ÷ 4
      suggestion: { kind: "none" },
    });
  });

  it("termin = P nie jest „minął”", () => {
    const result = goalDeadline(WAKACJE, "2026-11");
    expect(result.status).not.toBe("overdue");
  });

  it("termin wcześniejszy niż P → termin minął, bez dalszych obliczeń", () => {
    expect(goalDeadline(WAKACJE, "2026-10")).toEqual({
      status: "overdue",
      firstMonth: "2026-11",
    });
  });

  it("brak danych, wymagana wpłata i sugestia (scen. 38)", () => {
    // Cel dodany 5.11.2026, kwota docelowa 3 000, termin czerwiec 2027;
    // listopad istnieje bez celu (przychód 9 800, pula 20% → baza 1 960).
    const scen38 = input({
      targetAmount: 300_000,
      progress: 0,
      currentMonth: "2026-11",
      months: [gm("2026-11", { hasGoal: false, poolBase: 196_000 })],
    });
    const result = goalDeadline(scen38, "2027-06");
    expect(result).toMatchObject({
      status: "no-data",
      firstMonth: "2026-11",
      planned: 0,
      shortfall: 300_000,
      futureMonths: 7, // grudzień–czerwiec
      required: 42_858, // 3 000 ÷ 7 w górę = 428,58
    });
    expect(result).toHaveProperty("suggestion.kind", "percent");
  });

  it("zaplanowane wpłaty wystarczą → brak wymaganej wpłaty", () => {
    const g = input({
      targetAmount: 200_000,
      progress: 10_000,
      currentMonth: "2026-11",
      months: [
        gm("2026-08", {
          settled: true,
          actualAmount: 10_000,
          poolBase: 50_000,
        }),
        gm("2026-11", { planAmount: 200_000, poolBase: 50_000 }),
      ],
    });
    const result = goalDeadline(g, "2026-12");
    expect(result).toMatchObject({
      status: "at-risk",
      planned: 200_000,
      required: null,
      suggestion: { kind: "enough" },
    });
  });

  it("zagrożony bez przyszłych miesięcy (k = 0) → zmiana procentu nie zdąży", () => {
    const g = input({
      targetAmount: 120_000,
      progress: 0,
      currentMonth: "2026-11",
      months: [
        gm("2026-11", {
          settled: true,
          actualAmount: 10_000,
          planAmount: 10_000,
          poolBase: 50_000,
        }),
        gm("2026-12", { planAmount: 10_000, poolBase: 50_000 }),
      ],
    });
    // P = grudzień (najstarszy nierozliczony z celem); termin grudzień → k = 0.
    const result = goalDeadline(g, "2026-12");
    expect(result).toMatchObject({
      status: "at-risk",
      firstMonth: "2026-12",
      futureMonths: 0,
      required: null,
      suggestion: { kind: "too-late" },
    });
  });

  it("sugestia powyżej 100% puli", () => {
    const g = input({
      targetAmount: 120_000,
      progress: 30_000,
      currentMonth: "2026-11",
      months: [
        gm("2026-08", {
          settled: true,
          actualAmount: 10_000,
          poolBase: 50_000,
        }),
        gm("2026-09", {
          settled: true,
          actualAmount: 10_000,
          poolBase: 50_000,
        }),
        gm("2026-10", {
          settled: true,
          actualAmount: 10_000,
          poolBase: 50_000,
        }),
      ],
    });
    // pozostało 90 000, P = listopad, termin listopad → k = 1, wymagana 90 000;
    // baza 500,00 zł → 1 800,00% > 100%.
    const result = goalDeadline(g, "2026-11");
    expect(result).toMatchObject({
      status: "at-risk",
      firstMonth: "2026-11",
      required: 90_000,
      suggestion: { kind: "over-100" },
    });
  });

  it("cel EUR bez kursu: wymagana wpłata w EUR działa, zamiast sugestii prośba o kurs", () => {
    const g = input({
      currency: "EUR",
      targetAmount: 100_000,
      progress: 0,
      currentRate: null,
      currentMonth: "2026-11",
      months: [
        gm("2026-08", {
          settled: true,
          actualAmount: 10_000,
          poolBase: 500_000,
        }),
      ],
    });
    // Średnia z rozliczeń 100,00 € (bez kursu), P = listopad, termin grudzień
    // → k = 2 (listopad, grudzień), wymagana 500,00 € = 50 000 centów.
    const result = goalDeadline(g, "2026-12");
    expect(result).toMatchObject({
      status: "at-risk",
      required: 50_000,
      suggestion: { kind: "eur-no-rate" },
    });
  });
});
