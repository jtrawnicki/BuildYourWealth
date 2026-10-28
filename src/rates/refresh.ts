// Leniwe pobieranie kursów NBP, bez crona (STACK 5 „Kurs NBP”). Odczyt kursu
// sprawdza `exchange_rates` i pobiera brakujący zakres, gdy od ostatniej próby
// (`rate_fetches`) minęła godzina. Błąd sieci kończy się użyciem kursów z bazy.
// Nie wywoływać w transakcji: zapytanie do NBP trwa do limitu czasu klienta.

import {
  claimRateFetch,
  markRateFetchOk,
  saveRates,
  storedRateBounds,
  storedRates,
} from "@/db/rates";
import type { Db } from "@/db/client";
import { addDays, currentDay, currentTime, isWeekend } from "@/domain/time";
import { nbpClient, type FetchRates, type RateCurrency } from "./nbp";
import type { NbpRate } from "./select";

/** Od tej godziny (Europe/Warsaw) tabela z dnia roboczego „powinna istnieć”. */
const PUBLICATION_TIME = "12:30";

type Range = { from: string; to: string };

/**
 * Data najnowszej tabeli, która w chwili `now` powinna już istnieć: dziś po
 * 12:30 w dzień roboczy, inaczej poprzedni dzień roboczy. Święta nie są znane;
 * NBP odpowie wtedy 404, co mieści się w limicie raz na godzinę.
 */
export function expectedTableDay(now: Date): string {
  let day = currentDay(now);
  if (currentTime(now) < PUBLICATION_TIME) day = addDays(day, -1);
  while (isWeekend(day)) day = addDays(day, -1);
  return day;
}

function hasWeekday(range: Range): boolean {
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    if (!isWeekend(day)) return true;
  }
  return false;
}

/**
 * Zakresy do pobrania, żeby baza miała tabele z `from`…`to`: początek przed
 * najstarszą zapisaną tabelą i koniec po najnowszej, do tabeli, która powinna
 * już istnieć. Daty z przyszłości NBP odrzuca kodem 400, więc ich nie ma.
 */
export function missingRanges(
  stored: { first: string; last: string } | null,
  from: string,
  to: string,
  now: Date,
): Range[] {
  const end = to < currentDay(now) ? to : currentDay(now);
  if (from > end) return [];
  if (!stored) return [{ from, to: end }];

  const ranges: Range[] = [];
  const head = { from, to: addDays(stored.first, -1) };
  if (head.from <= head.to && hasWeekday(head)) ranges.push(head);

  const expected = expectedTableDay(now);
  const tailEnd = end < expected ? end : expected;
  if (stored.last < tailEnd) {
    ranges.push({ from: addDays(stored.last, 1), to: end });
  }
  return ranges;
}

/**
 * Pobiera z NBP brakujące tabele z `from`…`to`, najwyżej raz na godzinę.
 * Nigdy nie rzuca z powodu NBP: brak odpowiedzi zostawia w bazie to, co było.
 */
export async function refreshRates(
  db: Db,
  currency: RateCurrency,
  range: Range,
  now: Date,
  fetchRates: FetchRates = nbpClient(),
): Promise<void> {
  const stored = await storedRateBounds(db, currency);
  const ranges = missingRanges(stored, range.from, range.to, now);
  if (ranges.length === 0) return;
  if (!(await claimRateFetch(db, currency, now))) return;

  try {
    for (const r of ranges) {
      await saveRates(db, currency, await fetchRates(currency, r.from, r.to));
    }
  } catch {
    // Próba zostaje zapisana z `ok = false`; następna najwcześniej za godzinę.
    return;
  }
  await markRateFetchOk(db, currency);
}

/**
 * Kursy do wyboru wg reguły 6.10 (`select.ts`) dla dni `from`…`to`: najpierw
 * leniwe uzupełnienie z NBP, potem odczyt z bazy (z ostatnim kursem przed `from`).
 */
export async function loadRates(
  db: Db,
  currency: RateCurrency,
  range: Range,
  now: Date,
  fetchRates?: FetchRates,
): Promise<NbpRate[]> {
  await refreshRates(db, currency, range, now, fetchRates);
  return storedRates(db, currency, range.from, range.to);
}
