import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  canCreateMonth,
  canSettleMonth,
  compareMonths,
  currentDay,
  currentMonth,
  currentTime,
  daysInMonth,
  isWeekend,
  lastDayOfMonth,
  previousMonth,
  startOfMonthInstant,
} from "./time";

describe("currentMonth w strefie Europe/Warsaw (SPEC 5.4)", () => {
  it("granica 31.10 23:59 i 1.11 00:00 czasu warszawskiego", () => {
    // Październik 2026 po końcu czasu letniego (CET, UTC+1).
    expect(currentMonth(new Date("2026-10-31T22:59:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-10-31T23:00:00Z"))).toBe("2026-11");
  });

  it("granica miesiąca mimo czasu letniego (marzec/kwiecień, CEST, UTC+2)", () => {
    expect(currentMonth(new Date("2026-03-31T21:59:00Z"))).toBe("2026-03");
    expect(currentMonth(new Date("2026-03-31T22:00:00Z"))).toBe("2026-04");
  });

  it("stabilny w chwili zmiany czasu letniego na zimowy", () => {
    // Noc z 24 na 25 października 2026, cofnięcie zegara o 02:00 warszawskiego.
    expect(currentMonth(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-10-25T01:30:00Z"))).toBe("2026-10");
  });

  it("granica grudzień → styczeń przechodzi przez rok", () => {
    expect(currentMonth(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12");
    expect(currentMonth(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01");
  });
});

describe("previousMonth", () => {
  it.each([
    ["2026-10", "2026-09"],
    ["2026-01", "2025-12"],
    ["2027-01", "2026-12"],
  ])("poprzedni przed %s to %s", (key, expected) => {
    expect(previousMonth(key)).toBe(expected);
  });
});

describe("daysInMonth", () => {
  it.each([
    ["2026-02", 28],
    ["2024-02", 29], // rok przestępny
    ["2026-04", 30],
    ["2026-10", 31],
    ["2025-12", 31],
  ])("%s ma %i dni", (key, expected) => {
    expect(daysInMonth(key)).toBe(expected);
  });
});

describe("canSettleMonth (SPEC 5.5)", () => {
  it("bieżący miesiąc można rozliczyć dopiero od ostatniego dnia", () => {
    expect(canSettleMonth("2026-10", new Date("2026-10-15T12:00:00Z"))).toBe(
      false,
    );
    expect(canSettleMonth("2026-10", new Date("2026-10-30T22:59:00Z"))).toBe(
      false,
    );
    // 31.10 23:59 warszawskiego — ostatni dzień października.
    expect(canSettleMonth("2026-10", new Date("2026-10-31T22:59:00Z"))).toBe(
      true,
    );
  });

  it("miesiąc z przeszłości zawsze, przyszły nigdy", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canSettleMonth("2026-09", now)).toBe(true);
    expect(canSettleMonth("2026-11", now)).toBe(false);
  });
});

describe("canCreateMonth (SPEC 5.4, scenariusz 18)", () => {
  it("wolno utworzyć bieżący i bezpośrednio poprzedni miesiąc", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canCreateMonth("2026-10", now)).toBe(true);
    expect(canCreateMonth("2026-09", now)).toBe(true);
  });

  it("starszych ani przyszłych miesięcy tworzyć nie wolno", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canCreateMonth("2026-08", now)).toBe(false);
    expect(canCreateMonth("2026-11", now)).toBe(false);
  });

  it("poprzedni miesiąc działa przez granicę roku", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(canCreateMonth("2025-12", now)).toBe(true);
    expect(canCreateMonth("2025-11", now)).toBe(false);
  });
});

describe("currentDay w strefie Europe/Warsaw", () => {
  it("granica północy czasu warszawskiego, nie UTC", () => {
    expect(currentDay(new Date("2026-10-30T22:59:00Z"))).toBe("2026-10-30");
    expect(currentDay(new Date("2026-10-30T23:00:00Z"))).toBe("2026-10-31");
    expect(currentDay(new Date("2026-06-30T22:00:00Z"))).toBe("2026-07-01");
  });
});

describe("lastDayOfMonth i addDays", () => {
  it.each([
    ["2026-10", "2026-10-31"],
    ["2026-11", "2026-11-30"],
    ["2028-02", "2028-02-29"],
  ])("ostatni dzień %s to %s", (key, expected) => {
    expect(lastDayOfMonth(key)).toBe(expected);
  });

  it("przesuwa przez granice miesiąca i roku", () => {
    expect(addDays("2026-10-31", -6)).toBe("2026-10-25");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("currentTime i isWeekend", () => {
  it("godzina w strefie Europe/Warsaw, także w czasie letnim", () => {
    expect(currentTime(new Date("2026-10-30T11:29:00Z"))).toBe("12:29");
    expect(currentTime(new Date("2026-06-30T10:30:00Z"))).toBe("12:30");
    expect(currentTime(new Date("2026-10-30T23:05:00Z"))).toBe("00:05");
  });

  it("sobota i niedziela to weekend", () => {
    expect(isWeekend("2026-10-30")).toBe(false);
    expect(isWeekend("2026-10-31")).toBe(true);
    expect(isWeekend("2026-11-01")).toBe(true);
    expect(isWeekend("2026-11-02")).toBe(false);
  });
});

describe("addMonths i compareMonths (reguły 6.12–6.13)", () => {
  it("przesuwa miesiąc przez granice lat w obie strony", () => {
    expect(addMonths("2026-11", 0)).toBe("2026-11");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-12", 3)).toBe("2027-03");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(addMonths("2026-11", -14)).toBe("2025-09");
    expect(addMonths("2026-11", 13)).toBe("2027-12");
  });

  it("porównuje miesiące chronologicznie", () => {
    expect(compareMonths("2026-11", "2026-12")).toBeLessThan(0);
    expect(compareMonths("2027-01", "2026-12")).toBeGreaterThan(0);
    expect(compareMonths("2026-11", "2026-11")).toBe(0);
  });
});

describe("startOfMonthInstant w strefie Europe/Warsaw (reguła 6.11)", () => {
  it("początek listopada 2026 to 31.10 23:00 UTC (CET, UTC+1)", () => {
    expect(startOfMonthInstant("2026-11").toISOString()).toBe(
      "2026-10-31T23:00:00.000Z",
    );
  });

  it("początek lipca 2026 to 30.06 22:00 UTC (czas letni, UTC+2)", () => {
    expect(startOfMonthInstant("2026-07").toISOString()).toBe(
      "2026-06-30T22:00:00.000Z",
    );
  });

  it("początek stycznia 2027 to 31.12 23:00 UTC (przełom roku)", () => {
    expect(startOfMonthInstant("2027-01").toISOString()).toBe(
      "2026-12-31T23:00:00.000Z",
    );
  });
});
