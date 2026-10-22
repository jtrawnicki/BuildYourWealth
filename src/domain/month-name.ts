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

function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

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
