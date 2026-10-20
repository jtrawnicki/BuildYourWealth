import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closePool, getDb } from "@/db/client";
import { users } from "@/db/schema";
import { deleteSession, storeSession, userForToken } from "./session-store";
import { hashToken } from "./token";

afterAll(closePool);

async function createUser(): Promise<{ id: number; email: string }> {
  const email = `sesja_${randomBytes(4).toString("hex")}@example.com`;
  const [user] = await getDb()
    .insert(users)
    .values({ email, passwordHash: "x" })
    .returning({ id: users.id });
  return { id: user.id, email };
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

describe("skrót tokenu", () => {
  it("jest deterministyczny i nie zawiera samego tokenu", () => {
    const value = "jawny-token-sesji";
    expect(hashToken(value)).toBe(hashToken(value));
    expect(hashToken(value)).not.toContain(value);
    expect(hashToken(value)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sesje w bazie", () => {
  it("znajduje użytkownika ważnej sesji, odrzuca nieznaną i wygasłą", async () => {
    const db = getDb();
    const user = await createUser();
    try {
      const valid = token();
      await storeSession(db, valid, user.id, new Date(Date.now() + 10_000));
      expect(await userForToken(db, valid)).toEqual(user);

      expect(await userForToken(db, token())).toBeNull();

      const expired = token();
      await storeSession(db, expired, user.id, new Date(Date.now() - 1_000));
      expect(await userForToken(db, expired)).toBeNull();
    } finally {
      // Kaskada usuwa też sesje użytkownika.
      await db.delete(users).where(eq(users.id, user.id));
    }
  });

  it("usuwa sesję, więc jej token przestaje działać", async () => {
    const db = getDb();
    const user = await createUser();
    try {
      const value = token();
      await storeSession(db, value, user.id, new Date(Date.now() + 10_000));
      expect(await userForToken(db, value)).not.toBeNull();

      await deleteSession(db, value);
      expect(await userForToken(db, value)).toBeNull();
    } finally {
      await db.delete(users).where(eq(users.id, user.id));
    }
  });
});
