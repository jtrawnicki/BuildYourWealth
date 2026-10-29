import { describe, expect, it } from "vitest";
import { buildChartView, formatAmountShort, niceMax } from "./chart-view";

describe("niceMax (oś Y od 0, SPEC 8.1)", () => {
  it("zaokrągla maksimum w górę do kroku podzielnego na 3", () => {
    expect(niceMax(4_823_000)).toBe(6_000_000); // 48 230 zł → 60 tys. zł
    expect(niceMax(1_533_800)).toBe(1_800_000); // 15 338 zł → 18 tys. zł
    expect(niceMax(0)).toBeGreaterThan(0); // same zera → skala dodatnia
  });
});

describe("formatAmountShort (etykiety osi Y)", () => {
  it("skraca do tys. i mln, 0 bez jednostki", () => {
    expect(formatAmountShort(5_000_000)).toBe("50 tys. zł");
    expect(formatAmountShort(120_000_000)).toBe("1,2 mln zł");
    expect(formatAmountShort(84_000)).toBe("840 zł");
    expect(formatAmountShort(0)).toBe("0");
  });
});

describe("buildChartView", () => {
  it("składa etykiety osi, skróty i dymki ze znakiem zmiany", () => {
    const view = buildChartView([
      { month: "2026-11", pln: 1_533_800, change: null },
      { month: "2026-12", pln: 1_200_000, change: -333_800 },
    ]);
    expect(view.yLabels[view.yLabels.length - 1]).toBe("0");
    expect(view.points[0]).toMatchObject({
      xLabel: "lis",
      title: "Listopad 2026",
      amount: "15 338,00 zł",
      change: null,
    });
    expect(view.points[1].change).toBe("−3 338,00 zł");
  });
});
