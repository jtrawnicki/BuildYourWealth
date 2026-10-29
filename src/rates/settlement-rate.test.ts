import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getDb } from "@/db/client";
import { exchangeRates, settings, users } from "@/db/schema";
import { setUserPassword } from "@/db/users";
import { resolveSettlementRate } from "./settlement-rate";

afterAll(closePool);

// Klient NBP nigdy nie łączy się w testach: wstrzykujemy pusty wynik, więc
// `resolveSettlementRate` wybiera spośród kursów zasianych wprost do bazy
// (helper seedujący E2E robi to samo).
const noFetch = async () => [];

let userId: number;

async function createUser(): Promise<number> {
  const email = `rate_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

async function seedRates(rows: [string, number][]): Promise<void> {
  await getDb()
    .insert(exchangeRates)
    .values(
      rows.map(([effectiveDate, rate], i) => ({
        currency: "EUR" as const,
        effectiveDate,
        rate,
        tableNo: `T/${i}`,
      })),
    )
    .onConflictDoNothing();
}

async function setFallback(rate: number): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ userId, fallbackEurRate: rate })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { fallbackEurRate: rate },
    });
}

beforeEach(async () => {
  userId = await createUser();
});

afterEach(async () => {
  await getDb().delete(users).where(eq(users.id, userId));
  // Kursy są wspólne dla wszystkich kont (bez `user_id`), więc czyścimy je, żeby
  // nie przeciekały między testami.
  await getDb().delete(exchangeRates);
});

describe("kurs rozliczenia (reguła 6.10, SPEC 5.5)", () => {
  it("bierze najnowszą tabelę z okna D−6…D jako kurs NBP (scen. 23)", async () => {
    // 31.10.2026 to sobota; tabela z 04.11 jest poza oknem października.
    await seedRates([
      ["2026-10-30", 42650],
      ["2026-11-04", 43000],
    ]);
    const now = new Date("2026-11-05T09:00:00Z");
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-10", now, noFetch),
    ).toEqual({ source: "nbp", rate: 42650, date: "2026-10-30" });
  });

  it("przed publikacją tabeli z ostatniego dnia bierze poprzednią (scen. 35)", async () => {
    await seedRates([["2026-11-27", 42600]]);
    const morning = new Date("2026-11-30T06:00:00Z");
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-11", morning, noFetch),
    ).toEqual({ source: "nbp", rate: 42600, date: "2026-11-27" });

    // Po publikacji tabeli z 30.11 kurs rozliczenia to już ona.
    await seedRates([["2026-11-30", 42500]]);
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-11", morning, noFetch),
    ).toEqual({ source: "nbp", rate: 42500, date: "2026-11-30" });
  });

  it("bez tabeli w oknie używa kursu zapasowego, a bez niego zwraca null (scen. 24)", async () => {
    const now = new Date("2026-11-05T09:00:00Z");
    // Brak kursu zapasowego i brak tabel: kursu nie da się ustalić.
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-10", now, noFetch),
    ).toBeNull();

    await setFallback(43000);
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-10", now, noFetch),
    ).toEqual({ source: "fallback", rate: 43000 });
  });

  it("woli kurs NBP z okna niż kurs zapasowy", async () => {
    await seedRates([["2026-10-30", 42650]]);
    await setFallback(43000);
    const now = new Date("2026-11-05T09:00:00Z");
    expect(
      await resolveSettlementRate(getDb(), userId, "2026-10", now, noFetch),
    ).toEqual({ source: "nbp", rate: 42650, date: "2026-10-30" });
  });
});
