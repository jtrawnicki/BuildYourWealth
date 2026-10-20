// Czas i miesiące w strefie Europe/Warsaw (SPEC 5.4, 5.5). Funkcje są czyste:
// przyjmują bieżący moment `now` jako parametr. Jedynym źródłem bieżącego czasu
// dla aplikacji jest moduł `clock.ts` (STACK 5).

const WARSAW = "Europe/Warsaw";

type Ymd = { year: number; month: number; day: number };

// en-CA formatuje datę jako `YYYY-MM-DD`; używamy części, nie całego ciągu.
const warsawFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function warsawYmd(now: Date): Ymd {
  const parts = warsawFormat.formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function compareYmd(a: Ymd, b: Ymd): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Bieżący miesiąc kalendarzowy w strefie Europe/Warsaw jako `YYYY-MM`. */
export function currentMonth(now: Date): string {
  const { year, month } = warsawYmd(now);
  return monthKey(year, month);
}

/** Poprzedni miesiąc kalendarzowy, z przejściem przez granicę roku. */
export function previousMonth(key: string): string {
  const { year, month } = parseMonth(key);
  return month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
}

/** Liczba dni w miesiącu `YYYY-MM` (kalendarzowo, niezależnie od strefy). */
export function daysInMonth(key: string): number {
  const { year, month } = parseMonth(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Czy miesiąc `key` można rozliczyć w chwili `now` (SPEC 5.5): od jego
 * ostatniego dnia w strefie Europe/Warsaw. Miesiące z przeszłości zawsze,
 * przyszłe nigdy.
 */
export function canSettleMonth(key: string, now: Date): boolean {
  const { year, month } = parseMonth(key);
  const lastDay: Ymd = { year, month, day: daysInMonth(key) };
  return compareYmd(warsawYmd(now), lastDay) >= 0;
}

/**
 * Czy miesiąc `key` wolno utworzyć w chwili `now` (SPEC 5.4): tylko bieżący
 * albo bezpośrednio poprzedni. Starszych ani przyszłych tworzyć nie wolno.
 */
export function canCreateMonth(key: string, now: Date): boolean {
  const current = currentMonth(now);
  return key === current || key === previousMonth(current);
}
