// Polskie nazwy miesięcy do etykiet ekranu „Ten miesiąc" (SPEC 5.4). Klucz
// miesiąca to `YYYY-MM`; Intl nie daje stabilnie formy dopełniacza samodzielnie,
// więc nazwy są wypisane wprost.

const NOMINATIVE = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

const GENITIVE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

const LOCATIVE = [
  "styczniu",
  "lutym",
  "marcu",
  "kwietniu",
  "maju",
  "czerwcu",
  "lipcu",
  "sierpniu",
  "wrześniu",
  "październiku",
  "listopadzie",
  "grudniu",
] as const;

function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

const SHORT = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
] as const;

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** `2026-10` → `Październik 2026`: nagłówek miesiąca z rokiem. */
export function formatMonthTitle(key: string): string {
  const { year, month } = parseMonth(key);
  return `${capitalize(NOMINATIVE[month - 1])} ${year}`;
}

/** `2026-10` → `października`: dopełniacz do zdania „Wpisz przychód z …". */
export function monthGenitive(key: string): string {
  return GENITIVE[parseMonth(key).month - 1];
}

/** `2026-12` → `grudzień 2026`: miesiąc z rokiem w środku zdania (SPEC 5.12). */
export function formatMonthYear(key: string): string {
  const { year, month } = parseMonth(key);
  return `${NOMINATIVE[month - 1]} ${year}`;
}

/** `2026-12` → `grudnia 2026`: „Do grudnia 2026 brakuje…” (SPEC 5.12). */
export function formatMonthYearGenitive(key: string): string {
  const { year, month } = parseMonth(key);
  return `${GENITIVE[month - 1]} ${year}`;
}

/** `2027-01` → `styczniu 2027`: „Osiągniesz w styczniu 2027” (SPEC 5.12). */
export function formatMonthYearLocative(key: string): string {
  const { year, month } = parseMonth(key);
  return `${LOCATIVE[month - 1]} ${year}`;
}

/** `2026-11` → `Listopad`: nazwa miesiąca bez roku, wielką literą. */
export function formatMonthName(key: string): string {
  return capitalize(NOMINATIVE[parseMonth(key).month - 1]);
}

/**
 * Skrót miesiąca na oś X wykresu (SPEC 8.1): `2026-11` → `lis`; styczeń z rokiem
 * jako punkt orientacyjny na przełomie lat: `2027-01` → `sty 2027`.
 */
export function formatMonthShort(key: string): string {
  const { year, month } = parseMonth(key);
  const short = SHORT[month - 1];
  return month === 1 ? `${short} ${year}` : short;
}
