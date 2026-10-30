import { describe, expect, it } from "vitest";
import {
  cardContributionText,
  cardDiffText,
  controlSentenceText,
  formatMinorAsZloty,
  formatThresholdShort,
  formatZloty,
  incomeSourceNote,
  profitSentenceText,
  rateLabel,
  savedBreakdown,
  sourcesRateNote,
} from "./text";

// Format kwot używa twardej spacji (NBSP); jej poprawność pilnują testy
// `format.ts`. Tu porównujemy treść, więc NBSP sprowadzamy do zwykłej spacji.
const plain = (text: string) => text.replace(/ /g, " ");

describe("formatZloty", () => {
  it("pełne złote z minusem", () => {
    expect(plain(formatZloty(85_259))).toBe("85 259 zł");
    expect(plain(formatZloty(-16_579))).toBe("−16 579 zł");
    expect(plain(formatZloty(0))).toBe("0 zł");
  });

  it("z groszy zaokrągla połówki od zera", () => {
    expect(plain(formatMinorAsZloty(8_525_900))).toBe("85 259 zł");
    expect(plain(formatMinorAsZloty(50))).toBe("1 zł");
    expect(plain(formatMinorAsZloty(-150))).toBe("−2 zł");
  });
});

describe("incomeSourceNote", () => {
  it("odmiana liczby miesięcy (reguła 6.14)", () => {
    expect(incomeSourceNote({ kind: "recent", monthCount: 1 })).toBe(
      "ostatni miesiąc z przychodem",
    );
    expect(incomeSourceNote({ kind: "recent", monthCount: 2 })).toBe(
      "2 ostatnie miesiące z przychodem",
    );
    expect(incomeSourceNote({ kind: "recent", monthCount: 6 })).toBe(
      "6 ostatnich miesięcy z przychodem",
    );
    expect(incomeSourceNote({ kind: "current-only" })).toBe(
      "bieżący miesiąc, jeszcze niepełny",
    );
  });
});

describe("savedBreakdown", () => {
  it("rozbicie na pule z dwoma miejscami", () => {
    expect(savedBreakdown(2000, 1500)).toBe(
      "Oszczędności 20,00% · Inwestycje 15,00%",
    );
  });
});

describe("controlSentenceText (SPEC 5.13, scen. 41)", () => {
  it("trzy miesiące, mniej niż plan", () => {
    expect(
      plain(
        controlSentenceText({
          monthCount: 3,
          averageActual: 80_000,
          planContribution: 100_000,
          relation: "less",
        }),
      ),
    ).toBe(
      "W ostatnich 3 rozliczonych miesiącach faktycznie odkładasz średnio 800,00 zł, czyli mniej niż zakłada plan (1 000,00 zł). Prognoza liczy wpłaty według planu.",
    );
  });

  it("jeden miesiąc bez słowa średnio, więcej niż plan", () => {
    expect(
      plain(
        controlSentenceText({
          monthCount: 1,
          averageActual: 120_000,
          planContribution: 100_000,
          relation: "more",
        }),
      ),
    ).toBe(
      "W ostatnim rozliczonym miesiącu faktycznie odkładasz 1 200,00 zł, czyli więcej niż zakłada plan (1 000,00 zł). Prognoza liczy wpłaty według planu.",
    );
  });
});

describe("profitSentenceText (SPEC 5.13, scen. 40, 48)", () => {
  it("zysk dodatni z udziałem i złotówką", () => {
    expect(
      plain(
        profitSentenceText(
          { kind: "positive", profitSharePct: 16, perZloty: 122 },
          5,
        ),
      ),
    ).toBe(
      "Za 5 lat 16% majątku to zysk z założonych stóp zwrotu. Każda złotówka wpłacona według planu zamieni się średnio w 1,22 zł.",
    );
  });

  it("udział poniżej 1% i wpłata 0 (bez drugiego zdania)", () => {
    expect(
      profitSentenceText(
        { kind: "positive", profitSharePct: 0, perZloty: null },
        10,
      ),
    ).toBe("Za 10 lat mniej niż 1% majątku to zysk z założonych stóp zwrotu.");
  });

  it("zysk ujemny z odmianą lat", () => {
    expect(
      plain(profitSentenceText({ kind: "negative", loss: 16_579 }, 5)),
    ).toBe(
      "Przy założonych stopach majątek za 5 lat będzie o 16 579 zł niższy niż majątek dziś i suma wpłat.",
    );
    expect(
      plain(profitSentenceText({ kind: "negative", loss: 1_490 }, 1)),
    ).toBe(
      "Przy założonych stopach majątek za 1 rok będzie o 1 490 zł niższy niż majątek dziś i suma wpłat.",
    );
    expect(profitSentenceText({ kind: "negative", loss: 100 }, 22)).toContain(
      "za 22 lata",
    );
  });

  it("zysk zerowy i brak stopy", () => {
    expect(profitSentenceText({ kind: "zero" }, 10)).toBe(
      "Przy założonych stopach zysk za 10 lat wynosi 0 zł.",
    );
    expect(profitSentenceText({ kind: "no-rate" }, 5)).toBe(
      "Żadne źródło nie ma zakładanej stopy zwrotu, więc majątek rośnie tylko o wpłaty.",
    );
  });
});

describe("karty scenariuszy (SPEC 5.13, scen. 40)", () => {
  const card = (scenario: 0 | 5 | 10 | 15, netWorth: number, diff: number) => ({
    scenario,
    netWorth,
    monthlyContribution: 1_000,
    diffFromBase: diff,
  });

  it("wpłata i różnica względem bazowego", () => {
    expect(plain(cardContributionText(card(5, 88_747, 3_488)))).toBe(
      "wpłata 1 000 zł / mies.",
    );
    expect(cardDiffText(card(0, 85_259, 0))).toBe("średni przychód bez zmian");
    expect(plain(cardDiffText(card(5, 88_747, 3_488)))).toBe(
      "+3 488 zł względem bazowego",
    );
    expect(plain(cardDiffText(card(5, 85_259, 0)))).toBe(
      "+0 zł względem bazowego",
    );
  });
});

describe("tabela źródeł (SPEC 5.13)", () => {
  it("etykieta stopy", () => {
    expect(rateLabel(600)).toBe("6,00%");
    expect(rateLabel(null)).toBe("brak (0%)");
  });

  it("dopisek o źródłach bez stopy", () => {
    expect(sourcesRateNote(1, 2)).toBe(
      "1 z 2 źródeł bez zakładanej stopy zwrotu, liczone jako 0%.",
    );
    expect(sourcesRateNote(0, 3)).toBe(
      "Wszystkie źródła mają zakładaną stopę zwrotu.",
    );
  });

  it("skrót progu bez waluty", () => {
    expect(plain(formatThresholdShort(5_000_000))).toBe("50 tys.");
    expect(plain(formatThresholdShort(120_000_000))).toBe("1,2 mln");
  });
});
