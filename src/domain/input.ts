// Parsowanie i walidacja pól formularzy (SPEC 7.1). Wynik to liczby całkowite:
// kwoty w groszach lub eurocentach, procenty w setnych procenta, kurs
// w dziesięciotysięcznych (STACK 4).

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const MESSAGES = {
  amount: "Wpisz kwotę, np. 1 234,56",
  incomePositive: "Kwota przychodu musi być większa od 0",
  actualRequired: "Wpisz kwotę albo 0",
  poolPercent: "Wpisz procent od 0 do 100",
  goalPercent: "Wpisz procent większy od 0",
  eurRate: "Wpisz kurs, np. 4,2850",
  name: "Wpisz nazwę",
} as const;

/** Największa kwota (2 mld zł lub €), zakres z STACK 4. Iloczyn z kursem może go przekroczyć; pilnują tego przeliczenia (T6). */
export const MAX_AMOUNT = 200_000_000_000;
export const MAX_PERCENT = 10_000;
export const MAX_NAME_LENGTH = 60;

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
  if (value === null || value === 0) return fail(MESSAGES.eurRate);
  return ok(value);
}

/** Nazwa źródła, celu lub przychodu; zwraca ją bez skrajnych spacji. */
export function parseName(input: string): Parsed<string> {
  const name = input.trim();
  if (name === "" || Array.from(name).length > MAX_NAME_LENGTH) {
    return fail(MESSAGES.name);
  }
  return ok(name);
}
