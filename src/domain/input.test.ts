import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MAX_EUR_RATE,
  MESSAGES,
  parseActualAmount,
  parseAmount,
  parseEurRate,
  parseGoalPercent,
  parseIncomeAmount,
  parseName,
  parseOptionalAmount,
  parsePoolPercent,
} from "./input";

const value = <T>(v: T) => ({ ok: true, value: v });
const error = (e: string) => ({ ok: false, error: e });

describe("kwoty (przychód, wartość źródła, faktyczna, docelowa, startowa)", () => {
  it.each([
    ["1 234,56", 123456],
    ["1234.56", 123456],
    ["1234,56", 123456],
    ["1 234,56", 123456],
    ["  12  ", 1200],
    ["0", 0],
    ["0,5", 50],
    ["0.05", 5],
    ["007", 700],
    ["9800", 980000],
    ["2 000 000 000,00", MAX_AMOUNT],
  ])("„%s” → %i", (input, minor) => {
    expect(parseAmount(input)).toEqual(value(minor));
  });

  it("„1 234,56” i „1234.56” dają ten sam wynik", () => {
    expect(parseAmount("1 234,56")).toEqual(parseAmount("1234.56"));
  });

  it("zachowuje dokładność tam, gdzie zmiennoprzecinkowe mnożenie się myli", () => {
    // 0.29 * 100 = 28.999999999999996, 1.15 * 100 = 114.99999999999999
    expect(parseAmount("0,29")).toEqual(value(29));
    expect(parseAmount("1.15")).toEqual(value(115));
    expect(parseAmount("1 999 999 999,99")).toEqual(value(199999999999));
  });

  it.each([
    "",
    "   ",
    "-5",
    "+5",
    "1,234",
    "1,2,3",
    "1.234,56",
    "12,",
    ",5",
    "1e3",
    "abc",
    "12 zł",
    "Infinity",
    "١٢",
    "2 000 000 000,01",
    "99999999999999999999",
  ])("„%s” → komunikat o kwocie", (input) => {
    expect(parseAmount(input)).toEqual(error(MESSAGES.amount));
  });
});

describe("kwota przychodu", () => {
  it("przyjmuje kwotę większą od 0", () => {
    expect(parseIncomeAmount("8 500")).toEqual(value(850000));
    expect(parseIncomeAmount("0,01")).toEqual(value(1));
  });

  it.each(["0", "0,00", "0.0"])(
    "„%s” → kwota musi być większa od 0",
    (input) => {
      expect(parseIncomeAmount(input)).toEqual(error(MESSAGES.incomePositive));
    },
  );

  it.each(["", "-1", "abc"])("„%s” → komunikat o kwocie", (input) => {
    expect(parseIncomeAmount(input)).toEqual(error(MESSAGES.amount));
  });
});

describe("kwota docelowa i startowa", () => {
  it.each(["", "  ", " "])("puste pole „%s” oznacza brak", (input) => {
    expect(parseOptionalAmount(input)).toEqual(value(null));
  });

  it("przyjmuje kwotę, także 0", () => {
    expect(parseOptionalAmount("5 000")).toEqual(value(500000));
    expect(parseOptionalAmount("0")).toEqual(value(0));
  });

  it("niepoprawna kwota → komunikat o kwocie", () => {
    expect(parseOptionalAmount("-5")).toEqual(error(MESSAGES.amount));
  });
});

describe("faktyczna kwota w rozliczeniu", () => {
  it("przyjmuje 0 i kwotę", () => {
    expect(parseActualAmount("0")).toEqual(value(0));
    expect(parseActualAmount("500")).toEqual(value(50000));
    expect(parseActualAmount("51,28")).toEqual(value(5128));
  });

  it.each(["", "   "])("puste pole „%s” → wpisz kwotę albo 0", (input) => {
    expect(parseActualAmount(input)).toEqual(error(MESSAGES.actualRequired));
  });

  it("niepoprawna kwota → komunikat o kwocie", () => {
    expect(parseActualAmount("1,234")).toEqual(error(MESSAGES.amount));
  });
});

describe("procent puli", () => {
  it.each([
    ["0", 0],
    ["20", 2000],
    ["33,33", 3333],
    ["12.5", 1250],
    ["100", 10000],
    ["100,00", 10000],
  ])("„%s” → %i", (input, hundredths) => {
    expect(parsePoolPercent(input)).toEqual(value(hundredths));
  });

  it.each(["", "100,01", "101", "-1", "33,333", "20%", "abc"])(
    "„%s” → wpisz procent od 0 do 100",
    (input) => {
      expect(parsePoolPercent(input)).toEqual(error(MESSAGES.poolPercent));
    },
  );
});

describe("procent celu", () => {
  it.each([
    ["0,01", 1],
    ["50", 5000],
    ["33,33", 3333],
    ["100", 10000],
  ])("„%s” → %i", (input, hundredths) => {
    expect(parseGoalPercent(input)).toEqual(value(hundredths));
  });

  it.each(["", "0", "0,00", "100,01", "-5", "12,345", "abc"])(
    "„%s” → wpisz procent większy od 0",
    (input) => {
      expect(parseGoalPercent(input)).toEqual(error(MESSAGES.goalPercent));
    },
  );
});

describe("kurs EUR", () => {
  it.each([
    ["4,2850", 42850],
    ["4.3", 43000],
    ["4", 40000],
    ["0,0001", 1],
    ["214 748,3647", MAX_EUR_RATE],
  ])("„%s” → %i", (input, rate) => {
    expect(parseEurRate(input)).toEqual(value(rate));
  });

  it.each(["", "0", "0,0000", "4,28501", "-4,28", "abc", "214748,3648"])(
    "„%s” → wpisz kurs",
    (input) => {
      expect(parseEurRate(input)).toEqual(error(MESSAGES.eurRate));
    },
  );
});

describe("nazwy (źródło, cel, przychód)", () => {
  it("zwraca nazwę bez skrajnych spacji", () => {
    expect(parseName("  Wakacje ")).toEqual(value("Wakacje"));
  });

  it("przyjmuje dokładnie 60 znaków, licząc znaki, a nie jednostki UTF-16", () => {
    expect(parseName("a".repeat(60))).toEqual(value("a".repeat(60)));
    expect(parseName("💰".repeat(60))).toEqual(value("💰".repeat(60)));
  });

  it.each(["", "   ", " ", "a".repeat(61)])("„%s” → wpisz nazwę", (input) => {
    expect(parseName(input)).toEqual(error(MESSAGES.name));
  });
});
