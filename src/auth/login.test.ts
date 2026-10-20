import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closePool, getDb } from "@/db/client";
import { loginAttempts, users } from "@/db/schema";
import { MAX_FAILED_ATTEMPTS } from "./constants";
import { attemptLogin } from "./login";
import { hashPassword } from "./password";

afterAll(closePool);

const PASSWORD = "poprawne-haslo-123";
const emails: string[] = [];

async function createAccount(): Promise<string> {
  const email = `login_${randomBytes(4).toString("hex")}@example.com`;
  emails.push(email);
  await getDb()
    .insert(users)
    .values({ email, passwordHash: await hashPassword(PASSWORD) });
  return email;
}

function unknownEmail(): string {
  const email = `brak_${randomBytes(4).toString("hex")}@example.com`;
  emails.push(email);
  return email;
}

afterEach(async () => {
  const db = getDb();
  for (const email of emails.splice(0)) {
    await db.delete(users).where(eq(users.email, email));
    await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
  }
});

describe("attemptLogin", () => {
  const now = new Date();

  it("przyjmuje poprawne dane i zwraca id konta", async () => {
    const email = await createAccount();
    expect(await attemptLogin(getDb(), email, PASSWORD, now)).toMatchObject({
      ok: true,
    });
  });

  it("odrzuca błędne hasło i nieistniejące konto tym samym powodem", async () => {
    const db = getDb();
    const email = await createAccount();
    expect(await attemptLogin(db, email, "zle-haslo", now)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await attemptLogin(db, unknownEmail(), "cokolwiek", now)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("blokuje po serii nieudanych prób, nawet przy poprawnym haśle", async () => {
    const db = getDb();
    const email = await createAccount();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(await attemptLogin(db, email, "zle-haslo", now)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(await attemptLogin(db, email, PASSWORD, now)).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("blokuje też nieistniejący adres, więc blokada nie zdradza istnienia konta", async () => {
    const db = getDb();
    const email = unknownEmail();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await attemptLogin(db, email, "cokolwiek", now);
    }
    expect(await attemptLogin(db, email, "cokolwiek", now)).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("zeruje licznik po udanym logowaniu", async () => {
    const db = getDb();
    const email = await createAccount();
    await attemptLogin(db, email, "zle-haslo", now);
    await attemptLogin(db, email, "zle-haslo", now);
    expect(await attemptLogin(db, email, PASSWORD, now)).toMatchObject({
      ok: true,
    });
    const [left] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, email));
    expect(left).toBeUndefined();
  });
});
