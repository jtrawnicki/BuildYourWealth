import { describe, expect, it } from "vitest";
import {
  NBSP,
  formatAmount,
  formatEurRate,
  formatMoney,
  formatPercent,
  formatProgress,
} from "./format";
import { parseAmount } from "./input";

// Oczekiwane teksty zapisujemy zwykłą spacją, jak w SPEC 8.
const spec = (text: string) => text.replace(/ /g, NBSP);

describe("kwoty z walutą", () => {
  it.each([
    [196000, "PLN", "1 960,00 zł"],
    [22050, "EUR", "220,50 €"],
    [637000, "PLN", "6 370,00 zł"],
    [144749, "PLN", "1 447,49 zł"],
    [0, "PLN", "0,00 zł"],
    [5, "EUR", "0,05 €"],
    [99, "PLN", "0,99 zł"],
    [100000, "EUR", "1 000,00 €"],
    [123456789, "PLN", "1 234 567,89 zł"],
    [200_000_000_000, "PLN", "2 000 000 000,00 zł"],
  ] as const)("%i %s → %s", (minor, currency, text) => {
    expect(formatMoney(minor, currency)).toBe(spec(text));
  });

  it("separatory to twarde spacje, żeby kwota się nie łamała", () => {
    expect(formatMoney(196000, "PLN")).toBe("1 960,00 zł");
  });

  it("kwota bez waluty wraca do tej samej liczby po parsowaniu", () => {
    for (const minor of [0, 7, 5128, 98000, 123456789, 200_000_000_000]) {
      expect(parseAmount(formatAmount(minor))).toEqual({
        ok: true,
        value: minor,
      });
    }
  });

  it("odrzuca wartości, które nie są bezpiecznymi liczbami całkowitymi", () => {
    expect(() => formatMoney(1.5, "PLN")).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN, "PLN")).toThrow(RangeError);
    expect(() => formatMoney(2 ** 53, "PLN")).toThrow(RangeError);
  });
});

describe("postęp celu bez groszy", () => {
  it("scen. 11: 3 100 / 5 000 zł", () => {
    expect(formatProgress(310000, 500000, "PLN")).toBe(
      spec("3 100 / 5 000 zł"),
    );
  });

  it("scen. 17: 551 / 2 000 € przy postępie 551,28 €", () => {
    expect(formatProgress(55128, 200000, "EUR")).toBe(spec("551 / 2 000 €"));
  });

  it("obcina grosze, więc 4 999,99 nie wygląda na 5 000", () => {
    expect(formatProgress(499999, 500000, "PLN")).toBe(
      spec("4 999 / 5 000 zł"),
    );
  });

  it("zero i kwoty poniżej złotówki", () => {
    expect(formatProgress(0, 99, "PLN")).toBe(spec("0 / 0 zł"));
  });
});

describe("procenty", () => {
  it.each([
    [2000, "20%"],
    [3333, "33,33%"],
    [1250, "12,5%"],
    [5, "0,05%"],
    [0, "0%"],
    [10000, "100%"],
  ])("%i → %s", (hundredths, text) => {
    expect(formatPercent(hundredths)).toBe(text);
  });
});

describe("kurs EUR", () => {
  it.each([
    [42850, "4,2850"],
    [43000, "4,3000"],
    [1, "0,0001"],
    [123456, "12,3456"],
  ])("%i → %s", (rate, text) => {
    expect(formatEurRate(rate)).toBe(text);
  });
});
