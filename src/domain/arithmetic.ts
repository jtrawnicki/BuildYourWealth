// Działania na liczbach całkowitych dla reguł z SPEC 6. Iloczyny pośrednie
// (kwota × procent, kwota × kurs) liczone na `BigInt`, bo przy kwocie z granicy
// 2 mld i kursie powyżej ok. 4,5 iloczyn przekracza `Number.MAX_SAFE_INTEGER`
// (STACK 4). Wynik wraca jako `number` dopiero po sprawdzeniu, że mieści się
// w bezpiecznym zakresie liczb całkowitych.

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const ONE = BigInt(1);
const TWO = BigInt(2);

/** Zamienia `BigInt` na `number`, zgłaszając błąd poza bezpiecznym zakresem. */
export function toSafeInteger(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new RangeError(
      `Wynik ${value} poza bezpiecznym zakresem liczb całkowitych`,
    );
  }
  return Number(value);
}

/**
 * Zaokrąglenie w dół ilorazu `(a × b) / divisor` dla nieujemnych `a` i `b`.
 * Dzielenie `BigInt` obcina w stronę zera, co dla wartości nieujemnych jest
 * zaokrągleniem w dół (SPEC 6.2–6.3).
 */
export function floorMulDiv(a: number, b: number, divisor: number): number {
  return toSafeInteger((BigInt(a) * BigInt(b)) / BigInt(divisor));
}

/**
 * Zaokrąglenie ilorazu `(a × b) / divisor` do najbliższej liczby całkowitej,
 * połówki w górę, dla nieujemnych wartości (SPEC 6.8).
 */
export function roundMulDivHalfUp(
  a: number,
  b: number,
  divisor: number,
): number {
  const numerator = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  return toSafeInteger((numerator * TWO + d) / (d * TWO));
}

/**
 * Zaokrąglenie w górę ilorazu `(a × b) / divisor` dla nieujemnych `a` i `b`
 * oraz dodatniego `divisor` (SPEC 6.12–6.13: liczba wpłat, wymagana wpłata,
 * sugerowany procent).
 */
export function ceilMulDiv(a: number, b: number, divisor: number): number {
  const numerator = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  return toSafeInteger((numerator + d - ONE) / d);
}
