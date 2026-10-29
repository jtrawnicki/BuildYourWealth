// Formaty liczb z SPEC 8, liczone na liczbach całkowitych z STACK 4.

export type Currency = "PLN" | "EUR";

/** Twarda spacja: separator tysięcy i odstęp przed symbolem waluty. */
export const NBSP = " ";

const SYMBOL: Record<Currency, string> = { PLN: "zł", EUR: "€" };

function assertInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Oczekiwano liczby całkowitej, otrzymano ${value}`);
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Dzieli wartość na część całkowitą i ułamek o `scale` cyfrach, bez dzielenia zmiennoprzecinkowego. */
function splitScaled(value: number, scale: number) {
  assertInteger(value);
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(value)).padStart(scale + 1, "0");
  return {
    sign,
    whole: digits.slice(0, digits.length - scale),
    fraction: digits.slice(digits.length - scale),
  };
}

/** `196000` → `1 960,00`; nadaje się też do wstępnego wypełnienia pola kwoty. */
export function formatAmount(minor: number): string {
  const { sign, whole, fraction } = splitScaled(minor, 2);
  return `${sign}${groupThousands(whole)},${fraction}`;
}

/** `196000, "PLN"` → `1 960,00 zł`; `22050, "EUR"` → `220,50 €`. */
export function formatMoney(minor: number, currency: Currency): string {
  return `${formatAmount(minor)}${NBSP}${SYMBOL[currency]}`;
}

/**
 * Postęp celu bez groszy: `310000, 500000, "PLN"` → `3 100 / 5 000 zł`.
 * Grosze są obcinane, żeby niepełna kwota nie wyglądała na osiągniętą.
 */
export function formatProgress(
  progressMinor: number,
  targetMinor: number,
  currency: Currency,
): string {
  const whole = (minor: number) => {
    const { sign, whole } = splitScaled(minor, 2);
    return `${sign}${groupThousands(whole)}`;
  };
  return `${whole(progressMinor)}${NBSP}/${NBSP}${whole(targetMinor)}${NBSP}${SYMBOL[currency]}`;
}

/** Procent w setnych bez zbędnych zer: `2000` → `20%`, `3333` → `33,33%`, `1250` → `12,5%`. */
export function formatPercent(hundredths: number): string {
  const { sign, whole, fraction } = splitScaled(hundredths, 2);
  const trimmed = fraction.replace(/0+$/, "");
  return `${sign}${whole}${trimmed ? `,${trimmed}` : ""}%`;
}

/** Kurs w dziesięciotysięcznych: `42850` → `4,2850`. */
export function formatEurRate(rate: number): string {
  const { sign, whole, fraction } = splitScaled(rate, 4);
  return `${sign}${whole},${fraction}`;
}

/** Data tabeli NBP `YYYY-MM-DD` → `DD.MM.RRRR` (SPEC 5.9). */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

const SOURCE_FORMS = { one: "źródło", few: "źródła", many: "źródeł" } as const;
const plural = new Intl.PluralRules("pl-PL");

/** Liczba źródeł z polską odmianą: `1 źródło`, `3 źródła`, `6 źródeł`. */
export function formatSourceCount(count: number): string {
  const form = plural.select(count) as keyof typeof SOURCE_FORMS;
  return `${count}${NBSP}${SOURCE_FORMS[form] ?? SOURCE_FORMS.many}`;
}
