import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closePool, getDb } from "./client";
import { sources, users } from "./schema";
import { getFallbackEurRate, setFallbackEurRate } from "./settings";
import { setUserPassword } from "./users";

afterAll(closePool);

async function createUser(): Promise<number> {
  const email = `kurs_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

describe("kurs zapasowy EUR w ustawieniach", () => {
  it("brak kursu, zapis i zmiana dotyczą tylko danego konta", async () => {
    const db = getDb();
    const userId = await createUser();
    const otherId = await createUser();
    try {
      expect(await getFallbackEurRate(db, userId)).toBeNull();

      await setFallbackEurRate(db, userId, 42850);
      expect(await getFallbackEurRate(db, userId)).toBe(42850);

      await setFallbackEurRate(db, userId, 43000);
      expect(await getFallbackEurRate(db, userId)).toBe(43000);
      expect(await getFallbackEurRate(db, otherId)).toBeNull();
    } finally {
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(users).where(eq(users.id, otherId));
    }
  });

  it("zmiana kursu zapasowego nie zmienia wartości źródła w EUR", async () => {
    const db = getDb();
    const userId = await createUser();
    try {
      await setFallbackEurRate(db, userId, 42850);
      const [source] = await db
        .insert(sources)
        .values({
          userId,
          name: "Konto EUR",
          kind: "savings",
          currency: "EUR",
          value: 100000,
        })
        .returning({ id: sources.id });

      await setFallbackEurRate(db, userId, 45000);

      const [row] = await db
        .select({ value: sources.value })
        .from(sources)
        .where(eq(sources.id, source.id));
      expect(row.value).toBe(100000);
    } finally {
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
