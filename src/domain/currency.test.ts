import { describe, expect, it } from "vitest";
import {
  convertEurToPln,
  convertPlnToEur,
  netWorthPln,
  type SourceValue,
} from "./currency";

describe("przeliczenia PLN↔EUR (SPEC 6.8)", () => {
  it("scenariusz 6: 220,50 zł przy kursie 4,3000 → 51,28 €", () => {
    // 51,279… zaokrąglone do najbliższego centa.
    expect(convertPlnToEur(22_050, 43_000)).toBe(5128);
  });

  it("scenariusz 6: 1 051,28 € przy kursie 4,3000 → 4 520,50 zł", () => {
    expect(convertEurToPln(105_128, 43_000)).toBe(452_050);
  });

  it("zaokrągla połówki w górę", () => {
    // 1 grosz ÷ 2 = 0,5 centa → 1 cent.
    expect(convertPlnToEur(1, 20_000)).toBe(1);
    // 1 cent × 2,0000 = 2 grosze (bez zaokrąglenia).
    expect(convertEurToPln(1, 20_000)).toBe(2);
  });

  it("liczy na BigInt przy kwocie i kursie z granicy (STACK 4)", () => {
    // 2 mld € × 4,5036 → iloczyn pośredni > MAX_SAFE_INTEGER, wynik dokładny.
    expect(convertEurToPln(200_000_000_000, 45_036)).toBe(900_720_000_000);
  });
});

describe("majątek w PLN (SPEC 6.7)", () => {
  it("sumuje źródła PLN i przeliczone źródła EUR, każde osobno", () => {
    const sources: SourceValue[] = [
      { currency: "PLN", value: 500_000 },
      { currency: "EUR", value: 105_128 },
      { currency: "PLN", value: 250_000 },
    ];
    expect(netWorthPln(sources, 43_000)).toEqual({ ok: true, pln: 1_202_050 });
  });

  it("bez źródeł EUR nie potrzebuje kursu", () => {
    const sources: SourceValue[] = [{ currency: "PLN", value: 500_000 }];
    expect(netWorthPln(sources, null)).toEqual({ ok: true, pln: 500_000 });
  });

  it("źródło EUR bez kursu → prośba o kurs (SPEC 7)", () => {
    const sources: SourceValue[] = [
      { currency: "PLN", value: 500_000 },
      { currency: "EUR", value: 100_000 },
    ];
    expect(netWorthPln(sources, null)).toEqual({
      ok: false,
      reason: "brak-kursu",
    });
  });

  it("pusta lista źródeł → majątek 0", () => {
    expect(netWorthPln([], null)).toEqual({ ok: true, pln: 0 });
  });
});
