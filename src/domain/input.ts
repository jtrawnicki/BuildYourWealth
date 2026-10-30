// Parsowanie i walidacja pól formularzy (SPEC 7.1). Wynik to liczby całkowite:
// kwoty w groszach lub eurocentach, procenty w setnych procenta, kurs
// w dziesięciotysięcznych (STACK 4).

import { monthGenitive } from "./month-name";
import { compareMonths } from "./time";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const MESSAGES = {
  amount: "Wpisz kwotę, np. 1 234,56",
  incomePositive: "Kwota przychodu musi być większa od 0",
  actualRequired: "Wpisz kwotę albo 0",
  poolPercent: "Wpisz procent od 0 do 100",
  goalPercent: "Wpisz procent większy od 0",
  eurRate: "Wpisz kurs, np. 4,2850",
  expectedReturn: "Wpisz stopę od −50 do 20, np. 6,5",
  name: "Wpisz nazwę",
  deadlineNeedsTarget: "Termin wymaga kwoty docelowej",
} as const;

/** Najpóźniejszy dozwolony termin celu (SPEC 7.1): grudzień 2099. */
export const MAX_DEADLINE = "2099-12";

/** Poprawny zapis terminu: `YYYY-MM` z miesiącem 01–12. */
const DEADLINE_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Największa wpisywana kwota (2 mld zł lub €), STACK 4. */
export const MAX_AMOUNT = 200_000_000_000;
export const MAX_PERCENT = 10_000;
/** Zakładana stopa zwrotu w setnych procenta: od −50% do 20% (SPEC 7.1, P31). */
export const MIN_EXPECTED_RETURN = -5_000;
export const MAX_EXPECTED_RETURN = 2_000;
export const MAX_NAME_LENGTH = 60;
/** Największy kurs, jaki mieści kolumna `integer` (STACK 4): 214 748,3647. */
export const MAX_EUR_RATE = 2_147_483_647;

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

const isBlank = (input: string) => input.replace(/\s/g, "") === "";

/**
 * Zamienia zapis dziesiętny na liczbę całkowitą w jednostkach 10^-scale,
 * operując na cyfrach jako tekście. Zwraca null dla niepoprawnego zapisu.
 */
function parseScaled(input: string, scale: number): number | null {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(input.replace(/\s/g, ""));
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > scale) return null;
  const digits = (whole + fraction.padEnd(scale, "0")).replace(/^0+(?=\d)/, "");
  // 15 cyfr zawsze mieści się w Number.MAX_SAFE_INTEGER.
  if (digits.length > 15) return null;
  return Number(digits);
}

export function parseAmount(input: string): Parsed<number> {
  const value = parseScaled(input, 2);
  if (value === null || value > MAX_AMOUNT) return fail(MESSAGES.amount);
  return ok(value);
}

/** Kwota docelowa i startowa: puste pole oznacza brak (null). */
export function parseOptionalAmount(input: string): Parsed<number | null> {
  if (isBlank(input)) return ok(null);
  return parseAmount(input);
}

export function parseIncomeAmount(input: string): Parsed<number> {
  const result = parseAmount(input);
  if (result.ok && result.value === 0) return fail(MESSAGES.incomePositive);
  return result;
}

export function parseActualAmount(input: string): Parsed<number> {
  if (isBlank(input)) return fail(MESSAGES.actualRequired);
  return parseAmount(input);
}

export function parsePoolPercent(input: string): Parsed<number> {
  const value = parseScaled(input, 2);
  if (value === null || value > MAX_PERCENT) return fail(MESSAGES.poolPercent);
  return ok(value);
}

export function parseGoalPercent(input: string): Parsed<number> {
  const value = parseScaled(input, 2);
  if (value === null || value === 0 || value > MAX_PERCENT) {
    return fail(MESSAGES.goalPercent);
  }
  return ok(value);
}

export function parseEurRate(input: string): Parsed<number> {
  const value = parseScaled(input, 4);
  if (value === null || value === 0 || value > MAX_EUR_RATE) {
    return fail(MESSAGES.eurRate);
  }
  return ok(value);
}

/**
 * Zakładana stopa zwrotu źródła (SPEC 7.1): od −50 do 20, najwyżej 2 miejsca po
 * przecinku, separator `,` lub `.`, minus jako `-` albo `−` (U+2212), znak `%`
 * ignorowany. Puste = brak (null, liczona jako 0%). Wynik w setnych procenta
 * (6,5% = 650).
 */
export function parseExpectedReturn(input: string): Parsed<number | null> {
  if (isBlank(input)) return ok(null);
  const cleaned = input.replace(/%/g, "").replace(/\s/g, "");
  const negative = cleaned.startsWith("-") || cleaned.startsWith("−");
  const digits = negative ? cleaned.slice(1) : cleaned;
  const magnitude = parseScaled(digits, 2);
  if (magnitude === null) return fail(MESSAGES.expectedReturn);
  const value = negative ? -magnitude : magnitude;
  if (value < MIN_EXPECTED_RETURN || value > MAX_EXPECTED_RETURN) {
    return fail(MESSAGES.expectedReturn);
  }
  return ok(value);
}

/** Czy zapis terminu to pełne `YYYY-MM`; zakres sprawdza `validateDeadline`. */
export function isDeadline(input: string): boolean {
  return DEADLINE_FORMAT.test(input);
}

/**
 * Walidacja terminu celu (SPEC 7.1): poprawny zapis `YYYY-MM`, miesiąc nie
 * wcześniejszy niż pierwszy miesiąc wpłaty P (reguła 6.12) i nie późniejszy niż
 * grudzień 2099. Komunikat nazywa miesiąc P (jedyny komunikat tego pola wg SPEC
 * 7.1). Zgodność terminu z kwotą docelową pilnuje zapis (`db/plan.ts`) i CHECK;
 * komunikat dla formularza to `deadlineNeedsTarget`.
 */
export function validateDeadline(
  deadline: string,
  firstMonth: string,
): Parsed<string> {
  if (
    !DEADLINE_FORMAT.test(deadline) ||
    compareMonths(deadline, firstMonth) < 0 ||
    compareMonths(deadline, MAX_DEADLINE) > 0
  ) {
    return fail(
      `Wybierz termin od ${monthGenitive(firstMonth)} ${firstMonth.slice(0, 4)}`,
    );
  }
  return ok(deadline);
}

/** Nazwa źródła, celu lub przychodu; zwraca ją bez skrajnych spacji. */
export function parseName(input: string): Parsed<string> {
  const name = input.trim();
  if (name === "" || Array.from(name).length > MAX_NAME_LENGTH) {
    return fail(MESSAGES.name);
  }
  return ok(name);
}
