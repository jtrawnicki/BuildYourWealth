import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closePool, getDb } from "@/db/client";
import { saveRates } from "@/db/rates";
import { exchangeRates, rateFetches } from "@/db/schema";
import { nbpClient, type FetchRates, type FetchedRate } from "./nbp";
import {
  expectedTableDay,
  loadRates,
  missingRanges,
  refreshRates,
} from "./refresh";

// Żaden test nie łączy się z NBP: klient jest atrapą albo `nbpClient`
// z podstawionym `fetch`. Kursy są wspólne dla kont, więc tylko ten plik
// zapisuje `exchange_rates` i `rate_fetches` i czyści je przed każdym testem.

afterAll(closePool);

beforeEach(async () => {
  await getDb().delete(exchangeRates);
  await getDb().delete(rateFetches);
});

const nbp = (effectiveDate: string, rate: number): FetchedRate => ({
  effectiveDate,
  rate,
  tableNo: `${effectiveDate}/A/NBP`,
});

/** Piątek 30.10.2026, 14:00 w Warszawie (CET). */
const FRIDAY_AFTERNOON = new Date("2026-10-30T13:00:00Z");
const OCTOBER_END = { from: "2026-10-25", to: "2026-10-31" };

async function lastFetch() {
  const [row] = await getDb().select().from(rateFetches);
  return row;
}

describe("tabela, która powinna już istnieć", () => {
  it.each([
    ["piątek po 12:30", "2026-10-30T11:30:00Z", "2026-10-30"],
    ["piątek przed 12:30", "2026-10-30T11:29:00Z", "2026-10-29"],
    ["sobota", "2026-10-31T10:00:00Z", "2026-10-30"],
    ["poniedziałek rano", "2026-11-02T07:00:00Z", "2026-10-30"],
  ])("%s", (_, now, expected) => {
    expect(expectedTableDay(new Date(now))).toBe(expected);
  });
});

describe("brakujące zakresy", () => {
  it("pusta baza: cały zakres, bez dat z przyszłości", () => {
    expect(
      missingRanges(null, "2026-10-01", "2026-10-31", FRIDAY_AFTERNOON),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-30" }]);
  });

  it("baza aktualna: nic do pobrania, także w weekend", () => {
    const stored = { first: "2026-10-01", last: "2026-10-30" };
    expect(
      missingRanges(stored, "2026-10-25", "2026-10-31", FRIDAY_AFTERNOON),
    ).toEqual([]);
    expect(
      missingRanges(
        stored,
        "2026-10-25",
        "2026-11-01",
        new Date("2026-11-01T12:00:00Z"),
      ),
    ).toEqual([]);
  });

  it("brak dzisiejszej tabeli po 12:30: koniec zakresu", () => {
    const stored = { first: "2026-10-01", last: "2026-10-29" };
    expect(
      missingRanges(stored, "2026-10-25", "2026-10-31", FRIDAY_AFTERNOON),
    ).toEqual([{ from: "2026-10-30", to: "2026-10-30" }]);
  });

  it("zakres przed najstarszą tabelą: początek, chyba że to sam weekend", () => {
    const stored = { first: "2026-10-26", last: "2026-10-30" };
    expect(
      missingRanges(stored, "2026-10-01", "2026-10-30", FRIDAY_AFTERNOON),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-25" }]);
    expect(
      missingRanges(stored, "2026-10-24", "2026-10-30", FRIDAY_AFTERNOON),
    ).toEqual([]);
  });
});

describe("leniwe pobieranie kursów", () => {
  it("brak odpowiedzi NBP nie rzuca błędu i zwraca kurs z bazy", async () => {
    const db = getDb();
    await saveRates(db, "EUR", [nbp("2026-10-27", 42600)]);
    const fetchRates = vi.fn<FetchRates>(async () => {
      throw new TypeError("fetch failed");
    });

    const rates = await loadRates(
      db,
      "EUR",
      OCTOBER_END,
      FRIDAY_AFTERNOON,
      fetchRates,
    );

    expect(fetchRates).toHaveBeenCalledOnce();
    expect(rates).toEqual([{ effectiveDate: "2026-10-27", rate: 42600 }]);
    expect(await lastFetch()).toMatchObject({ currency: "EUR", ok: false });
  });

  it("druga próba w ciągu godziny nie łączy się z NBP, po godzinie tak", async () => {
    const db = getDb();
    const fetchRates = vi.fn<FetchRates>(async () => {
      throw new TypeError("fetch failed");
    });

    await refreshRates(db, "EUR", OCTOBER_END, FRIDAY_AFTERNOON, fetchRates);
    const later = new Date(FRIDAY_AFTERNOON.getTime() + 59 * 60_000);
    await refreshRates(db, "EUR", OCTOBER_END, later, fetchRates);
    expect(fetchRates).toHaveBeenCalledOnce();

    const afterHour = new Date(FRIDAY_AFTERNOON.getTime() + 60 * 60_000);
    await refreshRates(db, "EUR", OCTOBER_END, afterHour, fetchRates);
    expect(fetchRates).toHaveBeenCalledTimes(2);
  });

  it("udana próba zapisuje tabele i ok; komplet w bazie nie łączy się z NBP", async () => {
    const db = getDb();
    const fetchRates = vi.fn<FetchRates>(async () => [
      nbp("2026-10-26", 42500),
      nbp("2026-10-27", 42550),
      nbp("2026-10-28", 42580),
      nbp("2026-10-29", 42600),
      nbp("2026-10-30", 42650),
    ]);

    const rates = await loadRates(
      db,
      "EUR",
      OCTOBER_END,
      FRIDAY_AFTERNOON,
      fetchRates,
    );
    expect(fetchRates).toHaveBeenCalledWith("EUR", "2026-10-25", "2026-10-30");
    expect(rates).toHaveLength(5);
    expect(rates.at(-1)).toEqual({ effectiveDate: "2026-10-30", rate: 42650 });
    expect(await lastFetch()).toMatchObject({ ok: true });

    const nextDay = new Date("2026-10-31T13:00:00Z");
    await refreshRates(db, "EUR", OCTOBER_END, nextDay, fetchRates);
    expect(fetchRates).toHaveBeenCalledOnce();
  });

  it("404 z NBP nie jest błędem", async () => {
    const db = getDb();
    const fetchImpl = vi.fn(
      async () => new Response("Brak danych", { status: 404 }),
    );

    const rates = await loadRates(
      db,
      "EUR",
      OCTOBER_END,
      FRIDAY_AFTERNOON,
      nbpClient("http://nbp.invalid", fetchImpl),
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(rates).toEqual([]);
    expect(await lastFetch()).toMatchObject({ ok: true });
  });

  it("zakres dłuższy niż 93 dni dzielony na zapytania", async () => {
    const db = getDb();
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      const from = String(url).split("/EUR/")[1].split("/")[0];
      return Response.json({
        code: "EUR",
        rates: [{ no: `${from}/A/NBP`, effectiveDate: from, mid: 4.25 }],
      });
    });

    await refreshRates(
      db,
      "EUR",
      { from: "2025-11-01", to: "2026-10-31" },
      FRIDAY_AFTERNOON,
      nbpClient("http://nbp.invalid", fetchImpl),
    );

    expect(urls).toHaveLength(4);
    expect(urls.every((u) => u.startsWith("http://nbp.invalid/"))).toBe(true);
    const saved = await db.select().from(exchangeRates);
    expect(saved).toHaveLength(4);
    expect(saved.every((r) => r.rate === 42500)).toBe(true);
  });

  it("ponowny zapis tej samej tabeli nie zmienia kursu", async () => {
    const db = getDb();
    await saveRates(db, "EUR", [nbp("2026-10-30", 42650)]);
    await saveRates(db, "EUR", [nbp("2026-10-30", 49999)]);
    const [row] = await db.select().from(exchangeRates);
    expect(row.rate).toBe(42650);
  });

  it("odczyt zwraca też ostatni kurs sprzed zakresu", async () => {
    const db = getDb();
    await saveRates(db, "EUR", [
      nbp("2026-10-01", 42000),
      nbp("2026-10-15", 42300),
      nbp("2026-10-30", 42650),
    ]);
    // Komplet w bazie: odczyt nie łączy się z NBP.
    const fetchRates = vi.fn<FetchRates>(async () => []);
    const rates = await loadRates(
      db,
      "EUR",
      { from: "2026-10-20", to: "2026-10-31" },
      FRIDAY_AFTERNOON,
      fetchRates,
    );
    expect(fetchRates).not.toHaveBeenCalled();
    expect(rates.map((r) => r.effectiveDate)).toEqual([
      "2026-10-15",
      "2026-10-30",
    ]);
  });
});
