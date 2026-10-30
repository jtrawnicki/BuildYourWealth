import { describe, expect, it } from "vitest";
import {
  buildWealthForecast,
  HORIZON_MESSAGE,
  parseHorizonYears,
  summarizeHorizon,
  yearsPhrase,
  type WealthForecastInput,
  type WealthSeries,
} from "./wealth-forecast";

/** Sześć miesięcy kwiecień–wrzesień 2026, każdy z przychodem `income` groszy. */
function sixMonths(income: number) {
  return ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map(
    (month) => ({ month, income }),
  );
}

/** Dane z „Przykładu prognozy majątku” (SPEC reguła 6.14, scen. 40–41). */
function scen40Input(
  overrides: Partial<WealthForecastInput> = {},
): WealthForecastInput {
  return {
    sources: [
      { id: 1, currency: "PLN", value: 1_000_000, rate: 600 }, // Konto 10 000 zł, 6%
      { id: 2, currency: "PLN", value: 200_000, rate: null }, // Gotówka 2 000 zł
    ],
    plan: {
      savingsPct: 1000, // 10%
      investmentsPct: 0,
      goals: [{ id: 10, pool: "savings", pct: 10_000, sourceId: 1 }],
    },
    months: sixMonths(1_000_000),
    settledMonths: [],
    currentMonth: "2026-10",
    currentRate: null,
    ...overrides,
  };
}

function series(input: WealthForecastInput): WealthSeries {
  const result = buildWealthForecast(input);
  if (!result.ok)
    throw new Error(`oczekiwano serii, otrzymano ${result.reason}`);
  return result.series;
}

describe("buildWealthForecast — serie (reguła 6.14)", () => {
  it("odtwarza przykład prognozy majątku co do grosza", () => {
    const s = series(scen40Input());
    expect(s.scenarioNetWorth[0][1]).toBe(1_305_000); // listopad 13 050,00 zł
    expect(s.scenarioNetWorth[0][2]).toBe(1_410_525); // grudzień 14 105,25 zł
    expect(s.scenarioNetWorth[0][12]).toBe(2_495_236); // po roku 24 952,36 zł
  });

  it("punkt wyjścia: majątek, średni przychód i wpłata planu (scen. 41)", () => {
    const { startingPoint } = series(scen40Input());
    expect(startingPoint.netWorthToday).toBe(1_200_000); // 12 000,00 zł
    expect(startingPoint.averageIncome).toBe(1_000_000); // 10 000,00 zł
    expect(startingPoint.incomeSource).toEqual({
      kind: "recent",
      monthCount: 6,
    });
    expect(startingPoint.savedPct).toBe(1000); // 10,00%
    expect(startingPoint.planContribution).toBe(100_000); // 1 000,00 zł
  });

  it("wpłaty scenariuszy liczone z przychodu scenariusza", () => {
    const s = series(scen40Input());
    expect(s.scenarioContribution[0]).toBe(100_000); // 1 000,00 zł
    expect(s.scenarioContribution[5]).toBe(105_000); // 1 050,00 zł
    expect(s.scenarioContribution[10]).toBe(110_000); // 1 100,00 zł
    expect(s.scenarioContribution[15]).toBe(115_000); // 1 150,00 zł
  });

  it("zdanie kontrolne tylko przy rozliczonych miesiącach i różnicy od planu (scen. 41)", () => {
    const withSettled = series(
      scen40Input({
        settledMonths: [
          { month: "2026-07", actualTotalPln: 100_000 },
          { month: "2026-08", actualTotalPln: 50_000 },
          { month: "2026-09", actualTotalPln: 90_000 },
        ],
      }),
    );
    expect(withSettled.controlSentence).toEqual({
      monthCount: 3,
      averageActual: 80_000, // 800,00 zł
      planContribution: 100_000,
      relation: "less",
    });
    expect(series(scen40Input()).controlSentence).toBeNull();
  });

  it("średnia faktycznych wpłat bierze najwyżej 6 najnowszych rozliczonych miesięcy", () => {
    const s = series(
      scen40Input({
        settledMonths: [
          { month: "2026-01", actualTotalPln: 0 },
          { month: "2026-02", actualTotalPln: 1_200_000 },
          { month: "2026-03", actualTotalPln: 120_000 },
          { month: "2026-04", actualTotalPln: 120_000 },
          { month: "2026-05", actualTotalPln: 120_000 },
          { month: "2026-06", actualTotalPln: 120_000 },
          { month: "2026-07", actualTotalPln: 120_000 },
        ],
      }),
    );
    // Najnowsze 6 (luty–lipiec), bez stycznia: (1 200 000 + 5 × 120 000) / 6.
    expect(s.controlSentence?.averageActual).toBe(300_000);
    expect(s.controlSentence?.relation).toBe("more");
  });

  it("zdania kontrolnego nie ma, gdy średnia faktycznych równa się planowi", () => {
    const s = series(
      scen40Input({
        settledMonths: [{ month: "2026-09", actualTotalPln: 100_000 }],
      }),
    );
    expect(s.controlSentence).toBeNull();
  });
});

describe("buildWealthForecast — średni przychód (scen. 42, brzegowe)", () => {
  it("mniej niż 6 miesięcy: średnia z tych, które są", () => {
    const s = series(
      scen40Input({
        months: [
          { month: "2026-08", income: 900_000 },
          { month: "2026-09", income: 1_100_000 },
          { month: "2026-10", income: 400_000 },
        ],
      }),
    );
    expect(s.startingPoint.averageIncome).toBe(1_000_000);
    expect(s.startingPoint.incomeSource).toEqual({
      kind: "recent",
      monthCount: 2,
    });
  });

  it("tylko bieżący miesiąc: przychód bieżącego, jeszcze niepełny", () => {
    const s = series(
      scen40Input({ months: [{ month: "2026-10", income: 400_000 }] }),
    );
    expect(s.startingPoint.averageIncome).toBe(400_000);
    expect(s.startingPoint.incomeSource).toEqual({ kind: "current-only" });
  });

  it("brak jakiegokolwiek przychodu: brak danych (Z17)", () => {
    const result = buildWealthForecast(scen40Input({ months: [] }));
    expect(result).toEqual({ ok: false, reason: "no-income" });
  });

  it("miesiące z przychodem z przerwą: 6 najnowszych, choć obejmują więcej niż pół roku", () => {
    const s = series(
      scen40Input({
        months: [
          { month: "2025-01", income: 9_999_999 }, // zbyt stary, pomijany
          { month: "2025-06", income: 400_000 },
          { month: "2025-09", income: 600_000 },
          { month: "2025-12", income: 1_000_000 },
          { month: "2026-03", income: 1_000_000 },
          { month: "2026-06", income: 1_000_000 },
          { month: "2026-09", income: 1_000_000 },
        ],
      }),
    );
    // Najnowsze 6 (2025-06 … 2026-09): (40+60+100+100+100+100)×10⁴ / 6.
    expect(s.startingPoint.averageIncome).toBe(topSix());
    expect(s.startingPoint.incomeSource).toEqual({
      kind: "recent",
      monthCount: 6,
    });
  });

  it("zaległy nierozliczony miesiąc z przychodem liczy się do średniej (Z19)", () => {
    const settled = series(scen40Input()).startingPoint.averageIncome;
    // Te same miesiące, żaden nie rozliczony — średni przychód bez zmian.
    expect(settled).toBe(1_000_000);
  });
});

function topSix() {
  const sum = 400_000 + 600_000 + 1_000_000 + 1_000_000 + 1_000_000 + 1_000_000;
  return Math.floor(sum / 6);
}

describe("buildWealthForecast — źródła, plan, kurs (scen. 43, 45)", () => {
  it("brak aktywnych źródeł: brak danych", () => {
    expect(buildWealthForecast(scen40Input({ sources: [] }))).toEqual({
      ok: false,
      reason: "no-sources",
    });
  });

  it("źródło EUR wchodzi po bieżącym kursie (scen. 45)", () => {
    const s = series(
      scen40Input({
        sources: [{ id: 1, currency: "EUR", value: 100_000, rate: null }],
        plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
        currentRate: 42_700, // 4,2700
      }),
    );
    expect(s.baseSourceValues[0].values[0]).toBe(427_000); // 4 270,00 zł
    expect(s.scenarioNetWorth[0][0]).toBe(427_000);
  });

  it("źródło EUR bez kursu: prośba o kurs zamiast prognozy (scen. 45)", () => {
    const result = buildWealthForecast(
      scen40Input({
        sources: [{ id: 1, currency: "EUR", value: 100_000, rate: null }],
        currentRate: null,
      }),
    );
    expect(result).toEqual({ ok: false, reason: "no-rate" });
  });

  it("źródło bez celu dostaje wpłatę 0; dwa cele na jednym źródle sumują się", () => {
    const s = series(
      scen40Input({
        plan: {
          savingsPct: 1000,
          investmentsPct: 2000,
          goals: [
            { id: 10, pool: "savings", pct: 10_000, sourceId: 1 },
            { id: 11, pool: "investments", pct: 4000, sourceId: 1 },
            { id: 12, pool: "investments", pct: 6000, sourceId: 2 },
          ],
        },
      }),
    );
    const konto = s.baseSourceContribution.find((c) => c.id === 1)?.amount;
    const gotowka = s.baseSourceContribution.find((c) => c.id === 2)?.amount;
    // Konto: 10% całości + 40% z 20% puli = 100 000 + 80 000; Gotówka: 60% z 20% = 120 000.
    expect(konto).toBe(180_000);
    expect(gotowka).toBe(120_000);
  });

  it("cel połączony ze źródłem spoza prognozy nie wchodzi do wpłaty scenariusza", () => {
    const s = series(
      scen40Input({
        plan: {
          savingsPct: 1000,
          investmentsPct: 0,
          goals: [
            { id: 10, pool: "savings", pct: 5000, sourceId: 1 },
            { id: 11, pool: "savings", pct: 5000, sourceId: 99 }, // źródło wykluczone
          ],
        },
      }),
    );
    expect(s.scenarioContribution[0]).toBe(50_000); // tylko cel na Konto
  });

  it("plan z pulami 0%: wpłaty 0, linie scenariuszy pokrywają się", () => {
    const s = series(
      scen40Input({ plan: { savingsPct: 0, investmentsPct: 0, goals: [] } }),
    );
    expect(s.scenarioContribution[0]).toBe(0);
    expect(s.scenarioNetWorth[5][60]).toBe(s.scenarioNetWorth[0][60]);
  });
});

describe("summarizeHorizon — podsumowanie dla horyzontu (scen. 40, 48)", () => {
  it("karty scenariuszy dla 5 lat (scen. 40)", () => {
    const summary = summarizeHorizon(series(scen40Input()), 5);
    expect(summary.cards).toEqual([
      {
        scenario: 0,
        netWorth: 85_259,
        monthlyContribution: 1_000,
        diffFromBase: 0,
      },
      {
        scenario: 5,
        netWorth: 88_747,
        monthlyContribution: 1_050,
        diffFromBase: 3_488,
      },
      {
        scenario: 10,
        netWorth: 92_236,
        monthlyContribution: 1_100,
        diffFromBase: 6_977,
      },
      {
        scenario: 15,
        netWorth: 95_724,
        monthlyContribution: 1_150,
        diffFromBase: 10_465,
      },
    ]);
  });

  it("Wpłaty kontra zysk dla bazowego: legenda i zdanie dodatnie (scen. 40)", () => {
    const { layers } = summarizeHorizon(series(scen40Input()), 5);
    expect(layers[0].legend).toEqual({
      netWorthToday: 12_000,
      contributions: 60_000,
      profit: 13_259,
    });
    expect(layers[0].sentence).toEqual({
      kind: "positive",
      profitSharePct: 16,
      perZloty: 122, // 1,22 zł
    });
  });

  it("kamienie milowe: jeden próg 50 tys. zł, miesiące osiągnięcia (scen. 40)", () => {
    const { milestones } = summarizeHorizon(series(scen40Input()), 5);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].threshold).toBe(5_000_000);
    expect(milestones[0].reached[0]).toEqual({ k: 34, month: "2029-08" });
    expect(milestones[0].reached[5]).toEqual({ k: 32, month: "2029-06" });
    expect(milestones[0].reached[10]).toEqual({ k: 31, month: "2029-05" });
    expect(milestones[0].reached[15]).toEqual({ k: 30, month: "2029-04" });
  });

  it("tabela źródeł: wpłata, wartość dziś i na koniec horyzontu (scen. 40)", () => {
    const { sources } = summarizeHorizon(series(scen40Input()), 5);
    expect(sources).toEqual([
      { id: 1, contribution: 1_000, today: 10_000, end: 83_259 },
      { id: 2, contribution: 0, today: 2_000, end: 2_000 },
    ]);
  });

  it("zysk ujemny: majątek bazowy 55 421 zł i strata 16 579 zł (scen. 48)", () => {
    const negative = scen40Input({
      sources: [
        { id: 1, currency: "PLN", value: 1_000_000, rate: -1000 }, // −10,00%
        { id: 2, currency: "PLN", value: 200_000, rate: null },
      ],
    });
    const summary = summarizeHorizon(series(negative), 5);
    expect(summary.cards[0].netWorth).toBe(55_421);
    expect(summary.layers[0].legend).toEqual({
      netWorthToday: 12_000,
      contributions: 60_000,
      profit: -16_579,
    });
    expect(summary.layers[0].sentence).toEqual({
      kind: "negative",
      loss: 16_579,
    });
  });

  it("zysk ujemny zależy od horyzontu: 1 rok → strata 1 490 zł (scen. 48)", () => {
    const negative = scen40Input({
      sources: [
        { id: 1, currency: "PLN", value: 1_000_000, rate: -1000 },
        { id: 2, currency: "PLN", value: 200_000, rate: null },
      ],
    });
    const oneYear = summarizeHorizon(series(negative), 1);
    expect(oneYear.layers[0].sentence).toEqual({
      kind: "negative",
      loss: 1_490,
    });
    const twentyTwo = summarizeHorizon(series(negative), 22);
    expect(twentyTwo.layers[0].sentence.kind).toBe("negative");
  });

  it("majątek końcowy 0 i pule 0%: majątek 0 i zysk zerowy (scen. 48)", () => {
    const zero = scen40Input({
      sources: [{ id: 1, currency: "PLN", value: 0, rate: 600 }],
      plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
    });
    const summary = summarizeHorizon(series(zero), 10);
    expect(summary.cards[0].netWorth).toBe(0);
    expect(summary.layers[0].sentence).toEqual({ kind: "zero" });
  });

  it("brak stóp w ogóle: zdanie „żadne źródło nie ma stopy” (scen. 43)", () => {
    const noRate = scen40Input({
      sources: [
        { id: 1, currency: "PLN", value: 1_000_000, rate: null },
        { id: 2, currency: "PLN", value: 200_000, rate: null },
      ],
    });
    const summary = summarizeHorizon(series(noRate), 5);
    expect(summary.layers[0].sentence).toEqual({ kind: "no-rate" });
  });

  it("udział zysku poniżej 1% pokazany jako 0 (warstwa tekstu zmienia na „mniej niż 1%”)", () => {
    // Mała stopa i krótki horyzont: zysk dodatni, ale udział < 0,5% → 0.
    const tiny = scen40Input({
      sources: [{ id: 1, currency: "PLN", value: 1_000_000, rate: 1 }], // 0,01%
      plan: {
        savingsPct: 10_000,
        investmentsPct: 0,
        goals: [{ id: 10, pool: "savings", pct: 10_000, sourceId: 1 }],
      },
    });
    const summary = summarizeHorizon(series(tiny), 1);
    expect(summary.layers[0].sentence).toMatchObject({
      kind: "positive",
      profitSharePct: 0,
    });
  });

  it("perZloty pominięty, gdy wpłata scenariusza wynosi 0", () => {
    const noContribution = scen40Input({
      plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
    });
    const summary = summarizeHorizon(series(noContribution), 5);
    expect(summary.layers[0].sentence).toMatchObject({
      kind: "positive",
      perZloty: null,
    });
  });

  it("więcej niż 3 progi: trzy największe", () => {
    const big = scen40Input({
      sources: [{ id: 1, currency: "PLN", value: 20_000_000, rate: 2000 }], // 200 000 zł, 20%
      plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
    });
    const { milestones } = summarizeHorizon(series(big), 15);
    expect(milestones).toHaveLength(3);
    const thresholds = milestones.map((m) => m.threshold);
    // Rosnąco, same największe możliwe w zasięgu +15% na koniec.
    expect(thresholds[0]).toBeLessThan(thresholds[1]);
    expect(thresholds[1]).toBeLessThan(thresholds[2]);
  });

  it("brak progów, gdy żaden nie mieści się w zasięgu", () => {
    const small = scen40Input({
      sources: [{ id: 1, currency: "PLN", value: 100_000, rate: null }], // 1 000 zł
      plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
    });
    expect(summarizeHorizon(series(small), 1).milestones).toEqual([]);
  });

  it("źródło 2 mld zł ze stopą 20% przez 40 lat mieści się w zakresie", () => {
    const huge = scen40Input({
      sources: [{ id: 1, currency: "PLN", value: 200_000_000_000, rate: 2000 }],
      plan: { savingsPct: 0, investmentsPct: 0, goals: [] },
    });
    expect(() => summarizeHorizon(series(huge), 40)).not.toThrow();
  });
});

describe("parseHorizonYears (SPEC 7.1)", () => {
  it("przyjmuje liczby całkowite od 1 do 40", () => {
    expect(parseHorizonYears("25")).toEqual({ ok: true, value: 25 });
    expect(parseHorizonYears(" 10 ")).toEqual({ ok: true, value: 10 });
    expect(parseHorizonYears("1")).toEqual({ ok: true, value: 1 });
    expect(parseHorizonYears("40")).toEqual({ ok: true, value: 40 });
  });

  it("odrzuca 0, 41, ułamki i puste", () => {
    for (const bad of ["0", "41", "10,5", "10.5", "", "abc", "-5"]) {
      expect(parseHorizonYears(bad)).toEqual({
        ok: false,
        error: HORIZON_MESSAGE,
      });
    }
  });
});

describe("yearsPhrase (odmiana rok/lata/lat)", () => {
  it("odmienia zgodnie z regułą 6.14", () => {
    expect(yearsPhrase(1)).toBe("1 rok");
    expect(yearsPhrase(2)).toBe("2 lata");
    expect(yearsPhrase(4)).toBe("4 lata");
    expect(yearsPhrase(5)).toBe("5 lat");
    expect(yearsPhrase(10)).toBe("10 lat");
    expect(yearsPhrase(12)).toBe("12 lat");
    expect(yearsPhrase(22)).toBe("22 lata");
    expect(yearsPhrase(32)).toBe("32 lata");
  });
});
