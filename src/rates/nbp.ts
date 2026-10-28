// Klient API NBP, tabela A (STACK 5 „Kurs NBP”). Wbudowany `fetch`, JSON,
// limit czasu 3 s. W zapytaniu są tylko waluta i daty.
//
// Testy nigdy nie łączą się z NBP: klient jest wstrzykiwany (`FetchRates`),
// a E2E kieruje `NBP_API_URL` na zamknięty port. Każde środowisko Vercel
// (ustawione `VERCEL_ENV`) ignoruje tę zmienną, jak `E2E_NOW` w `clock.ts`.

import { addDays } from "@/domain/time";

export type RateCurrency = "EUR";

/** Tabela NBP z odpowiedzi: data, kurs w dziesięciotysięcznych i numer tabeli. */
export type FetchedRate = {
  effectiveDate: string;
  rate: number;
  tableNo: string;
};

/** Tabele z zakresu `from`…`to` (włącznie); pusta lista, gdy NBP ich nie ma. */
export type FetchRates = (
  currency: RateCurrency,
  from: string,
  to: string,
) => Promise<FetchedRate[]>;

export const NBP_DEFAULT_URL = "https://api.nbp.pl";
const NBP_URL_ENV = "NBP_API_URL";
const TIMEOUT_MS = 3000;

/** Najdłuższy zakres jednego zapytania, w dniach włącznie (limit NBP). */
export const MAX_RANGE_DAYS = 93;

/** Adres API: stały, poza Vercel podmieniany zmienną `NBP_API_URL`. */
export function nbpBaseUrl(): string {
  if (process.env.VERCEL_ENV) return NBP_DEFAULT_URL;
  return process.env[NBP_URL_ENV] || NBP_DEFAULT_URL;
}

/** Dzieli zakres na kolejne zakresy po najwyżej `MAX_RANGE_DAYS` dni. */
export function splitRange(
  from: string,
  to: string,
): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];
  for (let start = from; start <= to;) {
    const end = addDays(start, MAX_RANGE_DAYS - 1);
    ranges.push({ from: start, to: end < to ? end : to });
    start = addDays(end, 1);
  }
  return ranges;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type RawRate = { effectiveDate?: unknown; mid?: unknown; no?: unknown };

/** Kurs `mid` (np. 4.2731) w dziesięciotysięcznych; `round` usuwa błąd zmiennoprzecinkowy. */
function toRate(mid: unknown): number {
  if (typeof mid !== "number" || !Number.isFinite(mid) || mid <= 0) {
    throw new Error("NBP: niepoprawny kurs w odpowiedzi.");
  }
  return Math.round(mid * 10_000);
}

function parseRate(r: RawRate): FetchedRate {
  if (typeof r.effectiveDate !== "string" || !DAY.test(r.effectiveDate)) {
    throw new Error("NBP: niepoprawna data tabeli w odpowiedzi.");
  }
  if (typeof r.no !== "string" || r.no === "") {
    throw new Error("NBP: brak numeru tabeli w odpowiedzi.");
  }
  return { effectiveDate: r.effectiveDate, rate: toRate(r.mid), tableNo: r.no };
}

function parseRates(body: unknown, currency: RateCurrency): FetchedRate[] {
  const data = body as { code?: unknown; rates?: unknown } | null;
  if (data?.code !== currency || !Array.isArray(data.rates)) {
    throw new Error("NBP: nieoczekiwany format odpowiedzi.");
  }
  return (data.rates as RawRate[]).map(parseRate);
}

/**
 * Klient NBP. Zakres dłuższy niż 93 dni dzieli na kolejne zapytania (wszystkie
 * w jednym limicie czasu). 404
 * oznacza „brak tabel w zakresie” (weekend, święto, przed publikacją), nie błąd.
 * Błąd sieci, przekroczenie limitu czasu i inne kody rzucają wyjątek.
 */
export function nbpClient(
  baseUrl: string = nbpBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): FetchRates {
  return async (currency, from, to) => {
    // Jeden limit na całe wywołanie: strona nie czeka dłużej, nawet przy kilku zakresach.
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const all: FetchedRate[] = [];
    for (const range of splitRange(from, to)) {
      const url = `${baseUrl}/api/exchangerates/rates/A/${currency}/${range.from}/${range.to}/?format=json`;
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal,
        cache: "no-store",
      });
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new Error(`NBP: odpowiedź ${response.status} dla ${url}.`);
      }
      all.push(...parseRates(await response.json(), currency));
    }
    return all;
  };
}
