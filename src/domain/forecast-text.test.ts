import { describe, expect, it } from "vitest";
import {
  forecastGoal,
  goalDeadline,
  goalFirstMonth,
  goalMonths,
  latestSnapshotPct,
  type GoalInput,
  type PlanMonth,
} from "./forecast";
import {
  FORECAST_MESSAGES,
  deadlineLine,
  forecastText,
  requiredText,
  suggestionText,
} from "./forecast-text";

// Kwoty z formatMoney mają twarde spacje (SPEC 8); w oczekiwaniach zwykłe.
const plain = (text: string | null) => text?.replace(/ /g, " ") ?? null;

const GOAL = 7;

/** Miesiąc z przykładu prognozy (SPEC 6): przychód 9 800 zł, Oszczędności 20%. */
function pm(
  month: string,
  over: Partial<PlanMonth> & {
    actual?: number | null;
    withGoal?: boolean;
  } = {},
): PlanMonth {
  const { actual = null, withGoal = true, ...rest } = over;
  return {
    month,
    settled: actual !== null,
    income: 980_000,
    savingsPct: 2000,
    investmentsPct: 1500,
    goals: withGoal
      ? [{ goalId: GOAL, pool: "savings", pct: 3000, actualAmount: actual }]
      : [],
    ...rest,
  };
}

// Przykład prognozy (SPEC 6, scen. 27): sierpień–październik rozliczone
// (588/512/600), listopad istnieje i nie jest rozliczony.
const EXAMPLE_MONTHS = [
  pm("2026-08", { actual: 58_800 }),
  pm("2026-09", { actual: 51_200 }),
  pm("2026-10", { actual: 60_000 }),
  pm("2026-11"),
];

function wakacje(months: PlanMonth[] = EXAMPLE_MONTHS): GoalInput {
  return {
    currency: "PLN",
    targetAmount: 500_000,
    progress: 370_000,
    months: goalMonths(GOAL, "savings", months),
    currentMonth: "2026-11",
    currentRate: null,
  };
}

describe("goalMonths", () => {
  it("liczy kwotę celu z planu i kwotę bazową puli (reguły 2–3)", () => {
    const [aug, , , nov] = goalMonths(GOAL, "savings", EXAMPLE_MONTHS);
    expect(aug).toEqual({
      month: "2026-08",
      settled: true,
      hasGoal: true,
      actualAmount: 58_800,
      planAmount: 58_800,
      poolBase: 196_000,
    });
    expect(nov.settled).toBe(false);
    expect(nov.actualAmount).toBeNull();
  });

  it("miesiąc bez celu: kwota bazowa puli celu, kwota planu 0", () => {
    const [nov] = goalMonths(GOAL, "investments", [
      pm("2026-11", { withGoal: false }),
    ]);
    expect(nov).toMatchObject({
      hasGoal: false,
      planAmount: 0,
      poolBase: 147_000,
    });
  });

  it("nowy cel (bez id) nie ma migawki w żadnym miesiącu", () => {
    const months = goalMonths(null, "savings", EXAMPLE_MONTHS);
    expect(months.every((m) => !m.hasGoal)).toBe(true);
    expect(goalFirstMonth(months, "2026-11")).toBe("2026-11");
  });
});

describe("latestSnapshotPct", () => {
  it("procent z najnowszego miesiąca z celem, niezależnie od kolejności", () => {
    const months = [
      pm("2026-11", {
        goals: [
          { goalId: GOAL, pool: "savings", pct: 3633, actualAmount: null },
        ],
      }),
      pm("2026-10", { actual: 60_000 }),
    ];
    expect(latestSnapshotPct(GOAL, months)).toBe(3633);
    expect(latestSnapshotPct(99, months)).toBeNull();
  });
});

describe("forecastText (SPEC 5.12)", () => {
  it("cel bez terminu: miesiąc osiągnięcia w miejscowniku (scen. 28)", () => {
    expect(forecastText(forecastGoal(wakacje()))).toBe(
      "Osiągniesz ok. w styczniu 2027",
    );
  });

  it("wpłaty 0 z trzech ostatnich miesięcy: nie zostanie osiągnięty (scen. 28)", () => {
    const zero = wakacje([
      pm("2026-08", { actual: 0 }),
      pm("2026-09", { actual: 0 }),
      pm("2026-10", { actual: 0 }),
      pm("2026-11"),
    ]);
    expect(forecastText(forecastGoal(zero))).toBe(FORECAST_MESSAGES.never);
  });

  it("brak danych i cel osiągnięty", () => {
    expect(forecastText({ status: "no-data", firstMonth: "2026-11" })).toBe(
      "Prognoza pojawi się, gdy cel trafi do planu miesiąca.",
    );
    expect(forecastText({ status: "reached" })).toBeNull();
  });
});

describe("teksty terminu (scen. 27)", () => {
  const input = wakacje();
  const forecast = forecastGoal(input);

  it("grudzień 2026: zagrożony, brakuje, wymagana wpłata i sugestia", () => {
    const result = goalDeadline(input, "2026-12");
    expect(deadlineLine(result, forecast, "2026-12")).toEqual({
      deadline: "Termin: grudzień 2026",
      status: "at-risk",
      statusLabel: "zagrożony",
      detail: null,
    });
    expect(plain(requiredText(result, forecast, "2026-12", "PLN"))).toBe(
      "Do grudnia 2026 brakuje 1 300,00 zł. Listopad ma już zaplanowane 588,00 zł, więc w każdym kolejnym miesiącu potrzebujesz 712,00 zł (średnio wpłacasz 566,66 zł).",
    );
    expect(
      suggestionText(
        result.status === "overdue" ? { kind: "none" } : result.suggestion,
        "Oszczędności",
        3000,
      ),
    ).toBe(
      "Ustaw ok. 36,33% puli Oszczędności (teraz 30,00%) i zmniejsz pozostałe cele albo zwiększ procent puli.",
    );
  });

  it("marzec 2027: zdążysz z miesiącem osiągnięcia, 178,00 zł, bez sugestii", () => {
    const result = goalDeadline(input, "2027-03");
    expect(deadlineLine(result, forecast, "2027-03")).toEqual({
      deadline: "Termin: marzec 2027",
      status: "on-track",
      statusLabel: "zdążysz",
      detail: "(ok. styczeń 2027)",
    });
    expect(plain(requiredText(result, forecast, "2027-03", "PLN"))).toBe(
      "Do marca 2027 brakuje 1 300,00 zł. Listopad ma już zaplanowane 588,00 zł, więc w każdym kolejnym miesiącu potrzebujesz 178,00 zł (średnio wpłacasz 566,66 zł).",
    );
    expect(result.status !== "overdue" && result.suggestion).toEqual({
      kind: "none",
    });
  });

  it("termin minął: status bez zdania o wpłacie", () => {
    const result = goalDeadline(input, "2026-10");
    expect(deadlineLine(result, forecast, "2026-10").statusLabel).toBe(
      "termin minął",
    );
    expect(requiredText(result, forecast, "2026-10", "PLN")).toBeNull();
  });
});

describe("brak danych (scen. 38)", () => {
  // Cel dodany 5.11.2026 z kwotą 3 000 zł; listopad istnieje bez niego.
  const input: GoalInput = {
    currency: "PLN",
    targetAmount: 300_000,
    progress: 0,
    months: goalMonths(GOAL, "savings", [pm("2026-11", { withGoal: false })]),
    currentMonth: "2026-11",
    currentRate: null,
  };
  const forecast = forecastGoal(input);
  const result = goalDeadline(input, "2027-06");

  it("status „brak danych” i wymagana wpłata bez zdania o zaplanowanej kwocie", () => {
    expect(deadlineLine(result, forecast, "2027-06").statusLabel).toBe(
      "brak danych",
    );
    expect(forecastText(forecast)).toBe(FORECAST_MESSAGES.noData);
    expect(plain(requiredText(result, forecast, "2027-06", "PLN"))).toBe(
      "Do czerwca 2027 brakuje 3 000,00 zł. W każdym kolejnym miesiącu potrzebujesz 428,58 zł.",
    );
  });

  it("sugestia procentu z kwoty bazowej najnowszego miesiąca", () => {
    const suggestion = result.status === "overdue" ? null : result.suggestion;
    // 428,58 ÷ 1 960,00 = 21,866…% → w górę 21,87%.
    expect(suggestion).toEqual({ kind: "percent", pct: 2187 });
    expect(suggestionText(suggestion!, "Oszczędności", 1000)).toBe(
      "Ustaw ok. 21,87% puli Oszczędności (teraz 10,00%) i zmniejsz pozostałe cele albo zwiększ procent puli.",
    );
  });
});

describe("requiredText: warianty", () => {
  it("kilka zaplanowanych miesięcy i średnia z planu („planujesz”)", () => {
    const input: GoalInput = {
      currency: "PLN",
      targetAmount: 500_000,
      progress: 0,
      months: goalMonths(GOAL, "savings", [pm("2026-10"), pm("2026-11")]),
      currentMonth: "2026-11",
      currentRate: null,
    };
    const forecast = forecastGoal(input);
    const result = goalDeadline(input, "2027-01");
    expect(plain(requiredText(result, forecast, "2027-01", "PLN"))).toBe(
      "Do stycznia 2027 brakuje 5 000,00 zł. Październik i listopad mają już zaplanowane 1 176,00 zł, więc w każdym kolejnym miesiącu potrzebujesz 1 912,00 zł (planujesz 588,00 zł).",
    );
  });

  it("zaplanowane wystarczą: bez wymaganej wpłaty, komunikat zamiast sugestii", () => {
    const input = { ...wakacje(), progress: 450_000 };
    const forecast = forecastGoal(input);
    const result = goalDeadline(input, "2026-11");
    expect(plain(requiredText(result, forecast, "2026-11", "PLN"))).toBe(
      "Do listopada 2026 brakuje 500,00 zł. Listopad ma już zaplanowane 588,00 zł.",
    );
  });

  it("kwoty celu EUR w euro", () => {
    const input: GoalInput = {
      currency: "EUR",
      targetAmount: 100_000,
      progress: 0,
      months: goalMonths(GOAL, "savings", [pm("2026-11", { withGoal: false })]),
      currentMonth: "2026-11",
      currentRate: 42_000,
    };
    const result = goalDeadline(input, "2026-12");
    expect(
      plain(requiredText(result, forecastGoal(input), "2026-12", "EUR")),
    ).toBe(
      "Do grudnia 2026 brakuje 1 000,00 €. W każdym kolejnym miesiącu potrzebujesz 1 000,00 €.",
    );
  });
});

describe("requiredText: cel EUR bez kursu", () => {
  it("pomija zdanie o zaplanowanej kwocie, której nie da się wyrazić w EUR", () => {
    const input: GoalInput = {
      currency: "EUR",
      targetAmount: 100_000,
      progress: 0,
      months: goalMonths(GOAL, "savings", [pm("2026-11")]),
      currentMonth: "2026-11",
      currentRate: null,
    };
    const result = goalDeadline(input, "2026-12");
    expect(
      plain(requiredText(result, forecastGoal(input), "2026-12", "EUR")),
    ).toBe(
      "Do grudnia 2026 brakuje 1 000,00 €. W każdym kolejnym miesiącu potrzebujesz 1 000,00 €.",
    );
  });
});

describe("suggestionText: komunikaty zamiast procentu", () => {
  it.each([
    [{ kind: "over-100" } as const, FORECAST_MESSAGES.over100],
    [{ kind: "too-late" } as const, FORECAST_MESSAGES.tooLate],
    [{ kind: "enough" } as const, FORECAST_MESSAGES.enough],
    [{ kind: "eur-no-rate" } as const, FORECAST_MESSAGES.eurNoRate],
    [{ kind: "none" } as const, null],
  ])("%o", (suggestion, expected) => {
    expect(suggestionText(suggestion, "Inwestycje", 5000)).toBe(expected);
  });

  it("bez odczytanego procentu celu pomija „teraz”", () => {
    expect(
      suggestionText({ kind: "percent", pct: 3633 }, "Inwestycje", null),
    ).toBe(
      "Ustaw ok. 36,33% puli Inwestycje i zmniejsz pozostałe cele albo zwiększ procent puli.",
    );
  });
});
